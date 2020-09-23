const {readFileSync, statSync} = require('fs');
const {basename} = require('path');
const {compile} = require('imba/dist/compiler.js');
import {imbaCode} from './cache';

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

function styleWrapper(css, fid) {
  if(!css) return '';
  return `
const newStyle = document.createElement('style');
newStyle.className = 'virtualCSS';
newStyle.id = '${fid}';
newStyle.textContent = ${JSON.stringify(css)};
document.head.appendChild(newStyle);
`
}

const imbaPlugin = (pluginOptions = {}) => function(plugin) {
  plugin.setName('imba');
  plugin.addLoader(
    options = { filter: /.imba$/ },
    callback = ({path}) => {
      const warnings = [];
      const stats = statSync(path);
      const cache = imbaCode.path[path] || {}
      if (cache.mtimeMs==stats.mtimeMs) {
        imbaCode.cacheHit++;
      } else {
        const code = readFileSync(path, 'utf8').split(/\r\n|\r/).join('\n');
        let options = {
          target: 'web',
          format: 'esm',
          es6: true,
          standalone: false,
          sourceMap: true,
          evaling: false,
          css: 'separate',
          filename: basename(path),
          sourceRoot: '',
          sourcePath: basename(path),
          targetPath: '',
          ...pluginOptions
        };
        let out;
        try {
          out = compile(code, options);
        } catch(e) { return { errors: [convertMsg(e)] } }
        // delete sourcemap.maps; // debugging leftover?
        // let { js, sourcemap, css, styles, fid, warnings } = out; // styles contains scss & sass style definitions from multi-line comments (purpose unclear)
        warnings.push(...out.warnings.map(warning=>convertMsg(warning)));
        // refresh cache
        imbaCode.update(out.fid, path);
        cache.fid = out.fid;
        cache.mtimeMs = stats.mtimeMs;
        if(options.sourceMap) {
          cache.sm = '\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,' +
          Buffer.from(JSON.stringify(out.sourcemap), 'utf8').toString('base64');
        }
        if(out.css && !out.styles.inlined) {
          out.js += `\nimba.inlineStyles(${JSON.stringify(resets)}, 'root');`
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
      }
      return {
        contents: cache.js + styleWrapper(cache.css, cache.fid) + cache.sm||'',
        loader: 'js',
        warnings
      }
    }
  ); // end addLoader
};

export {imbaPlugin};