const assert = require('assert');
const {join} = require('path');
const {startService} = require('esbuild');
const {FSWatcher} = require('chokidar');
const escexit = require('esc-exit');
const open = require('open');
import {bundler} from './corebundler';
import {koaServer, activeSocket} from './koaserver';
import {imbaCode} from './cache';
import {showErrors, copyAssets} from './utils';
import {generateTimestamps, checkTimestamps} from './timestamps';

async function dowatch(args) {
  // console.log('dowatch args:', args);
  /*
  check timestamps
  do initial compilation
  copy assets

  start esbuild service
  check for ctrl-c & esc
  start watcher (include assets!!)
  start webserver
  open webpage in browser

  onWatchedFile:
  which file(s) triggered chokidar?
    - if assets: copy over modified assets (watch whole subdirectory and not just individual files!)
    - if srcdir: do bundling
  start timer
  compile & bundle all entrypoints (only some? Is the speed difference worth the troubles?)
  stop timer
  change set of watched files
  depending on modifications: reload page, refresh css, copy over assets
  display text and warning messages
  reset cache hits

  onExit:
  stop webserver
  stop watcher
  uncheck for ESC
  stop esbuild service
  generate timestamps
  */
  assert(args.files.length);
  let lastSources = args.files.map(x=>join(args.srcdir,x));
  const esbuild = await startService();  // Start the esbuild child process once
  const watcher = new FSWatcher();
  watcher.add(lastSources);
  const endEscexit = escexit();
  checkTimestamps(args.outdir); await copyAssets(args.assets, args.outdir); generateTimestamps(args.outdir); // still unsure where to place this code. Should also be inside loop()

  const app = koaServer(args);
  // const app = koaServer();
  // console.log('PORT:',args.port);
  app.listen(args.port); // !!!! include address as well

  process.on('exit', (code) => {
    esbuild.stop();
    endEscexit();
    console.log("Finished!");
  });
  async function loop() {
    checkTimestamps(args.outdir);
    const timerStart = Date.now();
    const out = await bundler(esbuild, {
      entrypoints:args.files.map(x=>join(args.srcdir,x)),
      sourcemap:!args.prod,
      outdir:args.outdir,
      minify:args.prod,
      solo:false,
    });
    const delta = Date.now() - timerStart;
    const d = new Date();
    // if(!out.errors.length && !solo) await copyAssets(args.assets, args.outdir);
    generateTimestamps(args.outdir);
    if (out.sources.length) {
      watcher.unwatch(lastSources);
      watcher.add(out.sources);
      lastSources = out.sources;
      if (activeSocket) {
        if (imbaCode.reloadFlag) {
          // console.log("Triggering reload");
          activeSocket.send("reload");
        } else if (imbaCode.styleFlag) {
          // console.log("Triggering style refresh");
          activeSocket.send("refreshcss");
        }
        // else console.log("Nothing to do????");
      }
    }
    console.clear();
    console.log("Imba bundler, based on esbuild\n------------------------------\n");
    if (!out.errors.length) console.log("%d:%d:%d - Bundled %d source files (%d compiled, %d from cache) in %d miliseconds\n",
    d.getHours(), d.getMinutes(), d.getSeconds(), out.sources.length, out.sources.length-imbaCode.cacheHit, imbaCode.cacheHit, delta);
    showErrors(out);
    console.log("\nPress ESC to quit.");
    imbaCode.reset();
    // if (!doWatch) process.exit();
    // setImmediate(loop); // release execution to the event loop...
    // setTimeout(loop, 100);
  };
  await loop();
  // await copyAssets(args.assets, args.outdir); // this should be inside loop()
  // open(`http://${args.address}:${args.port}`);
  open(`http://localhost:${args.port}`);
  watcher.on('change', loop);
}

export {dowatch};