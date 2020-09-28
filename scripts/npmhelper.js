#!/usr/bin/env node

const fs = require('fs');
const {buildSync} = require('esbuild')

function bundleSources() {
  console.log('start bundling esimba sources');
  buildSync({
    bundle:true,
    entryPoints: ['../src/index.js'],
    outfile:'./esimba.js',
    platform:'node',
    target:'node12',
    format:'cjs',
    minify: false,
    metafile:'meta.json',
    loader:{'.jst':'text'},
    external:['imba', 'esbuild', 'lru-cache', 'koa', 'koa-static-resolver', 'koa-easy-ws', 'chokidar', 'esc-exit', 'open', 'commander'],
  });
  console.log('end bundling esimba sources');
}

function patchVersion() {
  console.log('Version');
  const {version, name} = require('./package.json');
  const pkg = JSON.parse(fs.readFileSync(`./pkg/package.json`, 'utf8'));
  fs.writeFileSync(`./pkg/package.json`, JSON.stringify({...pkg, version}, null, 2));
}

function copyFiles() {
  fs.copyFileSync('../README.md', './README.md');
}

function cleanupFiles() {
  console.log('Cleaning up...');
  fs.unlinkSync('./README.md');
  fs.unlinkSync('./esimba.js');
}

console.log(`Doing ${process.env.npm_lifecycle_event} inside ${process.cwd()}`);
switch(process.env.npm_lifecycle_event) {
  case 'version': patchVersion(); break;
  case 'build': bundleSources(); copyFiles(); break;
  // case 'build': console.log('Building'); break;
  // case 'prepublishOnly': console.log('prepublishOnly'); break;
  default:
    console.log('This script got called at a different lifecycle event:', process.env.npm_lifecycle_event);
}
