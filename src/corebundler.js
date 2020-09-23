const {dirname} = require('path');
const {existsSync, promises} = require('fs');
const {mkdir, writeFile} = promises;
import {imbaPlugin} from './imbaplugin';

async function bundler(esbuild, bundlerOptions) {
  const sources = [];
  const metafile = 'metafile.json';
  let result = {};
  const opt = {
    entrypoints:['./src/index.js'], // only js or imba, no html
    sourcemap:true,
    outdir:'./dist',
    minify:false,
    solo:false,
    esbuildOptions:{},
    ...bundlerOptions
  };
  try {
    result = await esbuild.build({
      bundle: !opt.solo,
      entryPoints: opt.entrypoints,
      resolveExtensions: [".imba", ".tsx", ".ts", ".jsx", ".mjs", ".cjs", ".js", ".json"], // better to append '.imba' instead of overwriting whole array
      sourcemap: opt.sourcemap,  // [true, false, 'inline', 'external'] - true is like 'external', but also updates JS file to point to external map
      metafile,
      plugins: [
        imbaPlugin({sourceMap:opt.sourcemap,standalone:opt.solo,css:opt.solo||'separate'}),
      ],
      outdir: opt.outdir,
      minify: opt.minify,
      write: false,
      logLevel: 'silent',
      ...opt.esbuildOptions
    });
  } catch(e) {
    return {
      sources: [],
      errors: e.errors,
      warnings: e.warnings,
    }
  }
  for(k of result.outputFiles||[]) {
    if(k.path.endsWith(metafile)) {
      const meta = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(k.contents)));
      sources.push(...Object.keys(meta.inputs));
    } else {
      const dir = dirname(k.path);
      if (!existsSync(dir)) await mkdir(dir, {recursive:true});
      await writeFile(k.path, k.contents);
    }
  }
  return {
    sources,
    errors: [],
    warnings: result.warnings,
  }
}

export {bundler};