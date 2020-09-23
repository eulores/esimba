#!/usr/bin/env node

// src/cache.js
const LRU = require("lru-cache");
const cacheBackend = new LRU(200);
const fidMapping = {};
const imbaCode = {
  reloadFlag: false,
  styleFlag: false,
  cacheHit: 0,
  reset: () => {
    imbaCode.reloadFlag = false;
    imbaCode.styleFlag = false;
    imbaCode.cacheHit = 0;
  },
  update: (fid, path2) => fidMapping[fid] = path2,
  path: new Proxy({}, {
    get: (_, prop) => cacheBackend.get(prop),
    set: (_, prop, val) => cacheBackend.set(prop, val)
  }),
  fid: new Proxy({}, {
    get: (_, prop) => cacheBackend.get(fidMapping[prop]),
    set: (_, prop, val) => cacheBackend.set(fidMapping[prop], val)
  })
};

// src/imbaplugin.js
const {readFileSync, statSync} = require("fs");
const {basename} = require("path");
const {compile} = require("imba/dist/compiler.js");
function convertMsg(code, msg) {
  const loc = msg.region || msg.loc;
  const lines = code.slice(0, loc[0]).split("\n");
  return {
    location: {
      file: path,
      line: lines.length,
      column: lines[lines.length - 1].length
    },
    text: msg.message
  };
}
const resets = `
*,::before,::after {
  box-sizing: border-box;
  border-width: 0;
  border-style: solid;
  border-color: currentColor;
}
`;
function styleWrapper(css, fid) {
  if (!css)
    return "";
  return `
const newStyle = document.createElement('style');
newStyle.className = 'virtualCSS';
newStyle.id = '${fid}';
newStyle.textContent = ${JSON.stringify(css)};
document.head.appendChild(newStyle);
`;
}
const imbaPlugin = (pluginOptions = {}) => function(plugin) {
  plugin.setName("imba");
  plugin.addLoader(options = {filter: /.imba$/}, callback = ({path: path2}) => {
    const warnings = [];
    const stats = statSync(path2);
    const cache4 = imbaCode.path[path2] || {};
    if (cache4.mtimeMs == stats.mtimeMs) {
      imbaCode.cacheHit++;
    } else {
      const code = readFileSync(path2, "utf8").split(/\r\n|\r/).join("\n");
      let options2 = {
        target: "web",
        format: "esm",
        es6: true,
        standalone: false,
        sourceMap: true,
        evaling: false,
        css: "separate",
        filename: basename(path2),
        sourceRoot: "",
        sourcePath: basename(path2),
        targetPath: "",
        ...pluginOptions
      };
      let out;
      try {
        out = compile(code, options2);
      } catch (e) {
        return {errors: [convertMsg(e)]};
      }
      warnings.push(...out.warnings.map((warning) => convertMsg(warning)));
      imbaCode.update(out.fid, path2);
      cache4.fid = out.fid;
      cache4.mtimeMs = stats.mtimeMs;
      if (options2.sourceMap) {
        cache4.sm = "\n//# sourceMappingURL=data:application/json;charset=utf-8;base64," + Buffer.from(JSON.stringify(out.sourcemap), "utf8").toString("base64");
      }
      if (out.css && !out.styles.inlined) {
        out.js += `
imba.inlineStyles(${JSON.stringify(resets)}, 'root');`;
        if (out.css != cache4.css) {
          cache4.css = out.css;
          imbaCode.styleFlag = true;
        }
      } else
        cache4.css = false;
      if (out.js != cache4.js) {
        cache4.js = out.js;
        imbaCode.reloadFlag = true;
      }
      imbaCode.path[path2] = cache4;
    }
    return {
      contents: cache4.js + styleWrapper(cache4.css, cache4.fid) + cache4.sm || "",
      loader: "js",
      warnings
    };
  });
};

// src/corebundler.js
const {dirname} = require("path");
const {existsSync, promises} = require("fs");
const {mkdir, writeFile} = promises;
async function bundler(esbuild, bundlerOptions) {
  const sources = [];
  const metafile = "metafile.json";
  let result = {};
  const opt = {
    entrypoints: ["./src/index.js"],
    sourcemap: true,
    outdir: "./dist",
    minify: false,
    solo: false,
    esbuildOptions: {},
    ...bundlerOptions
  };
  try {
    result = await esbuild.build({
      bundle: !opt.solo,
      entryPoints: opt.entrypoints,
      resolveExtensions: [".imba", ".tsx", ".ts", ".jsx", ".mjs", ".cjs", ".js", ".json"],
      sourcemap: opt.sourcemap,
      metafile,
      plugins: [
        imbaPlugin({sourceMap: opt.sourcemap, standalone: opt.solo, css: opt.solo || "separate"})
      ],
      outdir: opt.outdir,
      minify: opt.minify,
      write: false,
      logLevel: "silent",
      ...opt.esbuildOptions
    });
  } catch (e) {
    return {
      sources: [],
      errors: e.errors,
      warnings: e.warnings
    };
  }
  for (k of result.outputFiles || []) {
    if (k.path.endsWith(metafile)) {
      const meta = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(k.contents)));
      sources.push(...Object.keys(meta.inputs));
    } else {
      const dir = dirname(k.path);
      if (!existsSync(dir))
        await mkdir(dir, {recursive: true});
      await writeFile(k.path, k.contents);
    }
  }
  return {
    sources,
    errors: [],
    warnings: result.warnings
  };
}

// src/utils.js
const {dirname: dirname2, join} = require("path");
const {exit} = require("process");
const {readdirSync, readFileSync: readFileSync2, existsSync: existsSync2, promises: promises2} = require("fs");
const {mkdir: mkdir2, copyFile} = promises2;
function walkDir(root, fn = (x) => join(root, ...x), initial) {
  const paths = [];
  if (existsSync2(root)) {
    const dirs = [[]];
    let i = k = 0;
    while (i <= k) {
      const segments2 = dirs[i];
      const dirents = readdirSync(join(root, ...segments2), {withFileTypes: true});
      dirents.forEach((dirent) => (dirent.isDirectory() ? ++k && dirs : paths).push(segments2.concat(dirent.name)));
      i++;
    }
  }
  return fn ? initial === void 0 ? paths.map(fn) : paths.reduce(fn, initial) : paths;
}
async function copyAssets(src, dst) {
  const assets = walkDir(src, false);
  for (segments of assets) {
    const dstFile = join(dst, ...segments);
    const dstDir = dirname2(dstFile);
    if (!existsSync2(dstDir))
      await mkdir2(dstDir, {recursive: true});
    await copyFile(join(src, ...segments), dstFile);
  }
}
function showErrors(out) {
  const q = (x) => x && x + ":" || "";
  const esbuildMsg = (type, text, loc) => (loc && q(loc.file) + q(loc.line) + q(loc.column) + " " || "") + `${type}: ${text}`;
  for (const {location, text} of out.warnings || [])
    console.log(esbuildMsg("warning", text, location));
  for (const {location, text} of out.errors || [])
    console.log(esbuildMsg("error", text, location));
  if (out.errors.length + out.warnings.length == 0)
    console.log("No warnings");
}
function readJSON(path2) {
  let report = false;
  try {
    const contents = readFileSync2(path2, "utf8");
    report = true;
    return JSON.parse(contents);
  } catch (e) {
    if (report) {
      console.log(e.message);
      exit(-1);
    }
    return {};
  }
}

// src/timestamps.js
const {statSync: statSync2, writeFileSync} = require("fs");
const {join: join2} = require("path");
const {exit: exit2} = require("process");
const sentinel = ".timestamps.json";
function generateTimestamps(dir = ".") {
  const lookup = {};
  walkDir(dir, (path2) => lookup[join2(...path2)] = statSync2(join2(dir, ...path2)).mtimeMs);
  writeFileSync(join2(dir, sentinel), JSON.stringify(lookup));
}
function checkTimestamps(dir = ".") {
  const lookup = readJSON(join2(dir, sentinel));
  const tampered = [];
  walkDir(dir, (x) => x[x.length - 1] != sentinel && lookup[join2(...x)] != statSync2(join2(dir, ...x)).mtimeMs && tampered.push(...x));
  if (tampered.length) {
    console.log(`Directory ${dir} can only contain generated code. Detected manually modified files: ${tampered.join(", ")}
Aborting due to risk of overwriting...`);
    exit2(1);
  }
}

// src/hmrClient.jst
var hmrClient_default = "function refreshCSS() {\n	console.log('Refreshing CSS');\n	allElems = document.getElementsByClassName('virtualCSS');\n	for (let i=allElems.length; i>0; --i) {\n		const oldNode = allElems[i-1];\n		const newNode = document.createElement('link');\n		newNode.className = oldNode.className;\n		newNode.id = oldNode.id;\n		newNode.rel = 'stylesheet';\n		newNode.href = '/virtualCSS/'+oldNode.id+'.css?'+new Date().valueOf();\n		newNode.onload = ()=>oldNode.parentNode.removeChild(oldNode); // avoid ugly fouc\n		oldNode.parentNode.appendChild(newNode);\n	}\n}\nif ('WebSocket' in window) {\n	var protocol = window.location.protocol === 'http:' ? 'ws://' : 'wss://';\n	var address = protocol + window.location.host + '/ws';\n	var socket = new WebSocket(address);\n	socket.onmessage = function (msg) {\n		console.log('Received', msg.data);\n		if (msg.data == 'reload') window.location.reload();\n		else if (msg.data == 'refreshcss') refreshCSS();\n	};\n} else {\n	console.error('Upgrade your browser. This Browser does not support WebSocket for Live-Reloading.');\n}";

// src/koaserver.js
const Koa = require("koa");
const KSR = require("koa-static-resolver");
const websocket = require("koa-easy-ws");
const {basename: basename2} = require("path");
let activeSocket = false;
function koaServer(args2) {
  const app = new Koa();
  app.use(websocket());
  app.use(KSR({
    dirs: [args2.outdir],
    defaultIndex: "index.html",
    livereload: `
<script>${hmrClient_default}</script>
`
  }));
  app.use(async (ctx, next) => {
    if (ctx.path.startsWith("/virtualCSS/")) {
      const fid = basename2(ctx.path, ".css");
      ctx.body = imbaCode.fid[fid].css;
      ctx.type = "css";
      return;
    }
    await next();
  });
  app.use(async (ctx, next) => {
    if (ctx.ws) {
      const ws = await ctx.ws();
      activeSocket = ws;
      return;
    }
    await next();
  });
  return app;
}

// src/dowatch.js
const assert = require("assert");
const {join: join3} = require("path");
const {startService} = require("esbuild");
const {FSWatcher} = require("chokidar");
const escexit = require("esc-exit");
const open = require("open");
async function dowatch(args2) {
  console.log("dowatch args:", args2);
  assert(args2.files.length);
  let lastSources = args2.files.map((x) => join3(args2.srcdir, x));
  const esbuild = await startService();
  const watcher = new FSWatcher();
  watcher.add(lastSources);
  const endEscexit = escexit();
  checkTimestamps(args2.outdir);
  await copyAssets(args2.assets, args2.outdir);
  generateTimestamps(args2.outdir);
  const app = koaServer(args2);
  app.listen(args2.port);
  process.on("exit", (code) => {
    esbuild.stop();
    endEscexit();
    console.log("Finished!");
  });
  async function loop() {
    checkTimestamps(args2.outdir);
    const timerStart = Date.now();
    const out = await bundler(esbuild, {
      entrypoints: args2.files.map((x) => join3(args2.srcdir, x)),
      sourcemap: !args2.prod,
      outdir: args2.outdir,
      minify: args2.prod,
      solo: false
    });
    const delta = Date.now() - timerStart;
    const d = new Date();
    generateTimestamps(args2.outdir);
    if (out.sources.length) {
      watcher.unwatch(lastSources);
      watcher.add(out.sources);
      lastSources = out.sources;
      if (activeSocket) {
        if (imbaCode.reloadFlag) {
          activeSocket.send("reload");
        } else if (imbaCode.styleFlag) {
          activeSocket.send("refreshcss");
        }
      }
    }
    console.clear();
    console.log("Imba bundler, based on esbuild\n------------------------------\n");
    if (!out.errors.length)
      console.log("%d:%d:%d - Bundled %d source files (%d compiled, %d from cache) in %d miliseconds\n", d.getHours(), d.getMinutes(), d.getSeconds(), out.sources.length, out.sources.length - imbaCode.cacheHit, imbaCode.cacheHit, delta);
    showErrors(out);
    console.log("\nPress ESC to quit.");
    imbaCode.reset();
  }
  ;
  await loop();
  open(`http://${args2.address}:${args2.port}`);
  watcher.on("change", loop);
}

// package.json
var version = "0.1.0";

// src/index.js
const assert2 = require("assert");
const {readFileSync: readFileSync3} = require("fs");
const {join: join4} = require("path");
const {build} = require("esbuild");
async function dobundle(args2, prod, solo = false) {
  assert2(args2.files.length);
  checkTimestamps(args2.outdir);
  if (solo)
    prod = false;
  const esbuild = {build};
  const out = await bundler(esbuild, {
    entrypoints: args2.files.map((x) => join4(args2.srcdir, x)),
    sourcemap: !prod,
    outdir: args2.outdir,
    minify: prod,
    solo
  });
  showErrors(out);
  if (!out.errors.length && !solo)
    await copyAssets(args2.assets, args2.outdir);
  generateTimestamps(args2.outdir);
}
function getArgs(args2, files) {
  if (Array.isArray(args2.files))
    files.unshift(...args2.files);
  args2.files = files;
  return args2;
}
const args = require("commander").program;
args.name("esimba").usage("watch|prod|dev|solo -options [files..]").version(version).option("-s, --srcdir <path>", "directory containing source files (.html|.imba|.js)").option("-a, --assets <path>", "static assets to copy to outdir (images, fonts, css, robots.txt)").option("-o, --outdir <path>", "distribution directory, containing transpiled sources and unmodified assets").option("-f, --files <files...>", "entrypoint files in srcdir (.html|.imba|.js)").option("-e, --erase", "erase all files from outdir before bundling");
args.command("watch <files...>", {isDefault: false}).description("Keep bundling imba sources, watching for file changes").option("--port <number>", "port of webserver").option("--address <string>", "address of webserver").option("-p, --prod", "production ready: minimize bundle and skip sourcemap generation").action((files) => dowatch(getArgs(args, files)));
args.command("prod <files...>", {isDefault: false}).description("Bundle imba sources for production, minify enabled").action((files) => dobundle(getArgs(args, files), true, false));
args.command("dev <files...>", {isDefault: false}).description("Bundle imba sources for development, sourcemaps enabled, minify disabled").action((files) => dobundle(getArgs(args, files), false, false));
args.command("solo <files...>", {isDefault: false}).description("Compile imba sources to bare js, no bundling, no runtime included").action((files) => dobundle(getArgs(args, files), false, true));
Object.assign(args, {
  srcdir: "./src",
  assets: "./static",
  outdir: "./dist",
  files: [],
  clean: false,
  port: 9e3
}, readJSON("package.json").esimba, readJSON("esimba.config.json"));
args.parse();
