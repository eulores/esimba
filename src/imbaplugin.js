// support official plugin interface from esbuild

/*
Things to fix urgently:

- Error: File not found: dist/.timestamps.json

*/

// add debug package for nicer console.log statements
// rewrite loadFiles and saveFiles into a main function returning a function for callbacks

// patch `console` to do log full object hierarchy
const {Console} = require('console');
const console = new Console({ stdout: process.stdout, stderr: process.stderr, inspectOptions: {depth:null} });

// const path = require('path');
const {existsSync, promises} = require('fs');
const {readFile} = promises;
const {compile} = require('imba/dist/compiler.js');
// const {compile, identifierForPath} = require('imba/dist/compiler.js');
const {startService} = require('esbuild')
// old imports below:
// const {readFileSync, statSync} = require('fs');
// import {imbaCode} from './cache';

function convertMsg(code, msg) {
  const loc = msg.region || msg.loc
  const lines = code.slice(0,loc[0]).split('\n');
  return {
    location: {
      file: path,
      line: lines.length,
      column: lines[lines.length-1].length
    },
    text: msg.message
  }
}

const resets = `
*,::before,::after {
  box-sizing: border-box;
  border-width: 0;
  border-style: solid;
  border-color: currentColor;
}
`

const embedCSS = (css, sourceId) => css && `
const newStyle = document.createElement('style');
newStyle.className = 'virtualCSS';
newStyle.id = '${sourceId||"undefined"}';
newStyle.textContent = ${JSON.stringify(css)};
document.head.appendChild(newStyle);` || '';
  
const embedSourcemap = (map) => map && `
//# sourceMappingURL=data:application/json;charset=utf-8;base64,` +
Buffer.from(JSON.stringify(map), 'utf8').toString('base64') || '';

/*

async function XloadFiles(inputPath, options) {
  // console.log(inputPath);
  const code = await readFile(inputPath, 'utf8');
  return {sourceCode:code.replace(/\r\n/g, '\n')};
}

async function XsaveFiles(inputPath, out, options) {
  return;
}

const cache = new Map() // set has get

async function loadFiles(inputPath, options) {
  // console.log(inputPath);
  const out = cache.get(inputPath);
  if (out) return out;
  const code = await readFile(inputPath, 'utf8');
  return {sourceCode:code.replace(/\r\n/g, '\n')};
}

async function saveFiles(inputPath, out, options) {
  cache.set(inputPath, out);
  return;
}

*/

async function noCache(inputPath, options) {
  const sourceCode = (await readFile(inputPath, 'utf8')).replace(/\r\n/g, '\n');
  return {
    empty: true,
    sourceCode,
    inputPath,
    // sourceId: '',
    // sourcemap: '',
    _js: '',
    get js() { return this._js },
    set js(jsCcode) { this._js = jsCcode },
  }
}

// const cache = await openCache(inputPath, options); // fetches stuff from cache if possible, expecting { sourceCode, js, css, map }
// if (cache.empty) compile(cache.source)
// cache.js = out.js // this is a getter method that also compares new code against old, and sets a flag accordingly
// result = {js:cache.js, css:cache.css}

// const memCache = {}

const imbaPlugin = (pluginOptions = {openCache:noCache} ) => ({
// const imbaPlugin = (pluginOptions = {pepe='abc', openCache=noCache}) => ({
  name: 'imba',
  setup(build) {
    // console.log('inside setup');
    build.onLoad(
      options = {filter:/\.imba$/},
      callback = async ({path:inputPath}) => {
        // console.log(`running onLoad. args:`);
        // console.log('path:', inputPath);
        /*
        const warnings = [];
        const stats = statSync(path);
        const cache = imbaCode.path[path] || {}
        if (cache.mtimeMs==stats.mtimeMs) {
          imbaCode.cacheHit++;
        } else {
          const code = readFileSync(path, 'utf8').split(/\r\n|\r/).join('\n');
        */

        let options = {
          sourcePath: inputPath,
          platform: 'web',
          format: 'esm',
          sourcemap: false,
          styles: 'inline',
          verbosity: 0,
          imbaPath: undefined,
          hmr: false,
          mode: 'prod',
          // ENV_NODE: true,
          // ENV_WEB: false,
          sourceRoot: '', // should be filled with something!
          targetPath: '', // should be filled with something!
          ...pluginOptions
        }
        // deprecated options below:
        options = {
          ...options,
          filename: options.sourcePath,
          target: options.platform,
          sourceMap: options.sourcemap,
          css: (options.styles=='extern') && 'separate',
          standalone: (options.imbaPath===null),
          evaling: (options.verbosity>=1),
        }
        let out = {};
        // const cache = await loadFiles(inputPath, options); // fetches stuff from cache if possible, expecting { sourceCode, js, css, map }
        const cache = await (pluginOptions.openCache||noCache)(inputPath, options); // fetches stuff from cache if possible, expecting { sourceCode, js, css, map }
        /*
        cache.js(out.js) // this function call will compare old code with new code and set a flag if it was modified
        cache.css(out.css) // -same-
        return(cache.result)

        Use getter and setter:
        const cache = await openCache(inputPath, options); // fetches stuff from cache if possible, expecting { sourceCode, js, css, map }
        if (cache.empty) compile(cache.source)
        cache.js = out.js // this is a getter method that also compares new code against old, and sets a flag accordingly
        result = {js:cache.js, css:cache.css}
        */
        if (cache.empty) {
          try {
            console.log('About to compile', cache.inputPath);
            out = compile(cache.sourceCode, options);
            // expecting { js, sourceId, warnings, css, sourcemap }
          }
          catch(e) {
            // debug(e);
            console.log(e);
            // return { errors: [convertMsg(e)]
            throw(e); // TODO: do something with the error, like pass it on
          }

          if (options.style=='inline') {
            out.css = false; // reset, as css is already embedded
          } else {
            out.js += `\nimba.styles.register('resets', resets);`
          }
          cache.js = out.js;
          cache.css = out.css;
          cache.sourceId = out.sourceId;
          cache.sourcemap = out.sourcemap;
          /*
          warnings.push(...out.warnings.map(warning=>convertMsg(warning)));
          // refresh cache
          imbaCode.update(out.sourceId, path);
          cache.sourceId = out.sourceId;
          cache.mtimeMs = stats.mtimeMs;
          if(options.sourceMap) {
            cache.sm = '\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,' +
            Buffer.from(JSON.stringify(out.sourcemap), 'utf8').toString('base64');
          }
          if(out.css && options.styles=='extern') {
            out.js += `\nimba.styles.register('resets', resets);`
            if(out.css!=cache.css) {
              cache.css = out.css;
              imbaCode.styleFlag = true;
            }
          } else cache.css = false;
          if(out.js!=cache.js) {
            cache.js = out.js;
            imbaCode.reloadFlag = true;
          }
          imbaCode.path[path] = cache;
          */
          // if(out.css && out.css!=cache.css) out.cssDirty = true;
          // if(out.js!=cache.js) out.jsDirty = true;
          // await saveFiles(inputPath, out, options); // will be no-op if cache disabled, otherwise also stores compiler output in cache
        } // end cache miss
        return {
          // contents: out.js + embedCSS(out.css, out.sourceId) + embedSourcemap(out.sourcemap),
          contents: cache.js + embedCSS(cache.css, cache.sourceId) + embedSourcemap(cache.sourcemap),
          loader: 'js',
          warnings: out.warnings || [],
          errors: out.errors || [],
          // contents: cache.js + styleWrapper(cache.css, cache.sourceId) + cache.sm||'',
          // warnings
        }
      } // end callback
    ); // end onLoad
  }, // end setup
});

export {imbaPlugin};