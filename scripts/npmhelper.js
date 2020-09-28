#!/usr/bin/env node

const fs = require('fs');
const {buildSync} = require('esbuild')

function bundleSources() {
  buildSync({
    bundle:true,
    entryPoints: ['./src/index.js'],
    outfile:'./pkg/esimba.js',
    platform:'node',
    target:'node12',
    format:'cjs',
    minify: false,
    metafile:'meta.json',
    loader:{'.jst':'text'},
    external:['imba', 'esbuild', 'lru-cache', 'koa', 'koa-static-resolver', 'koa-easy-ws', 'chokidar', 'esc-exit', 'open', 'commander'],
  });
}

function patchVersion() {
  const {version, name} = require('../package.json');
  const pkg = JSON.parse(fs.readFileSync(`./pkg/package.json`, 'utf8'));
  fs.writeFileSync(`./pkg/package.json`, JSON.stringify({...pkg, version, name}, null, 2));
}

function copyFiles() {
  fs.copyFileSync('./README.md', './pkg/README.md');
}

function cleanupFiles() {
  fs.unlinkSync('./README.md');
  fs.unlinkSync('./esimba.js');
}

console.log(`Doing ${process.env.npm_lifecycle_event} inside ${process.cwd()}`);
switch(process.env.npm_lifecycle_event) {
  case 'version': patchVersion(); bundleSources(); copyFiles(); break;
  case 'build': bundleSources(); copyFiles(); break;
  default:
    console.log('This script got called at a different lifecycle event:', process.env.npm_lifecycle_event);
}
