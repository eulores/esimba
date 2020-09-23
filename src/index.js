#!/usr/bin/env node

const assert = require('assert');
const {readFileSync} = require('fs');
const {join} = require('path');
const {build} = require('esbuild');
import {bundler} from './corebundler';
import {showErrors, copyAssets, readJSON} from './utils';
import {generateTimestamps, checkTimestamps} from './timestamps';
import {dowatch} from './dowatch';
import {version} from '../package.json';

async function dobundle(args, prod, solo=false) {
  assert(args.files.length);
  checkTimestamps(args.outdir);
  if (solo) prod = false;
  const esbuild = {build};
  const out = await bundler(esbuild, {
    entrypoints:args.files.map(x=>join(args.srcdir,x)),
    sourcemap:!prod,
    outdir:args.outdir,
    minify:prod,
    solo:solo,
  });
  showErrors(out);
  if(!out.errors.length && !solo) await copyAssets(args.assets, args.outdir);
  generateTimestamps(args.outdir);
}

// merges files into args.files
function getArgs(args, files) {
  if(Array.isArray(args.files)) files.unshift(...args.files);
  args.files = files;
  return args;
}

const args = require('commander').program;

args
  .name('esimba')
  .usage('watch|prod|dev|solo -options [files..]')
  .version(version)
  .option('-s, --srcdir <path>', 'directory containing source files (.html|.imba|.js)')
  .option('-a, --assets <path>', 'static assets to copy to outdir (images, fonts, css, robots.txt)')
  .option('-o, --outdir <path>', 'distribution directory, containing transpiled sources and unmodified assets')
  .option('-f, --files <files...>', 'entrypoint files in srcdir (.html|.imba|.js)')
  .option('-e, --erase', 'erase all files from outdir before bundling')

args
  .command('watch <files...>', {isDefault: false})
  .description('Keep bundling imba sources, watching for file changes')
  .option('--port <number>', 'port of webserver')
  .option('--address <string>', 'address of webserver')
  .option('-p, --prod', 'production ready: minimize bundle and skip sourcemap generation')
  .action(files=>dowatch(getArgs(args, files)));

args
  .command('prod <files...>', {isDefault: false})
  .description('Bundle imba sources for production, minify enabled')
  .action((files)=>dobundle(getArgs(args, files), true, false));

args
  .command('dev <files...>', { isDefault: false })
  .description('Bundle imba sources for development, sourcemaps enabled, minify disabled')
  .action((files)=>dobundle(getArgs(args, files), false, false));

args
  .command('solo <files...>', { isDefault: false })
  .description('Compile imba sources to bare js, no bundling, no runtime included')
  .action((files)=>dobundle(getArgs(args, files), false, true));

// deal with default arguments and try loading from package.json/esimba & esimba.config.json
Object.assign(args, {
  srcdir: './src',
  assets: './static',
  outdir: './dist',
  files: [],
  clean: false,
  port: 9000,
},
readJSON('package.json').esimba,
readJSON('esimba.config.json'),
);

args.parse();