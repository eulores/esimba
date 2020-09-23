#!/usr/bin/env node

const { build } = require('esbuild')

console.log('start');
build({
  bundle:true,
  entryPoints: ['./src/index.js'],
  outfile:'pkg/esimba.js',
  platform:'node',
  target:'node12',
  format:'cjs',
  minify: false,
  metafile:'meta.json',
  loader:{'.jst':'text'},
  external:['imba', 'esbuild', 'lru-cache', 'koa', 'koa-static-resolver', 'koa-easy-ws', 'chokidar', 'esc-exit', 'open', 'commander'],
}).catch((e) => {console.log(e);process.exit(1);})
// }).catch(() => process.exit(1))
console.log('end');
