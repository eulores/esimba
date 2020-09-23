const {dirname, join} = require('path');
const {exit} = require('process');
const {readdirSync, readFileSync, existsSync, promises} = require('fs');
const {mkdir, copyFile} = promises;

/*
Some usage rules
----------------
a) Default: return list of paths, prefixed by root.

b) fn=false: return list of path segments, excluding root.

c) List based map (no initial defined).
The function fn maps each sequence of path segments (excluding root) to anything.

d) List based reduce (initial defined as an empty array []).
The function fn may push into the first argument, based on second argument (list of path segments excluding root).
The function fn always returns the first argument (the initial list that keeps growing because of the push).
Do not return a different object than the initial seed, otherwise the garbage collector keeps busy!

e) Map based reduce (initial defined as an empty object {}).
The function fn may update the object as it pleases.
The function fn always returns the first argument (the initial object).
Do not return a different object than the initial seed, otherwise the garbage collector keeps busy!
*/
function walkDir(root, fn=x=>join(root, ...x), initial) {
  const paths = [];
  if(existsSync(root)) {
    const dirs = [[]];
    let i = k = 0;
    while (i <= k) {
      const segments = dirs[i];
      const dirents = readdirSync(join(root, ...segments), {withFileTypes: true});
      dirents.forEach(dirent=>(dirent.isDirectory()?++k&&dirs:paths).push(segments.concat(dirent.name)));
      i++;
    }
  }
  return fn?((initial===undefined)?paths.map(fn):paths.reduce(fn, initial)):paths;
}

async function copyAssets(src, dst) {
  const assets = walkDir(src, false);
  for (segments of assets) {
    const dstFile = join(dst, ...segments);
    const dstDir = dirname(dstFile);
    if (!existsSync(dstDir)) await mkdir(dstDir, {recursive:true});
    await copyFile(join(src, ...segments), dstFile);
  }
}

function showErrors(out) {
  const q = (x) => x&&(x+':')||''
  const esbuildMsg = (type, text, loc) => (loc&&(q(loc.file)+q(loc.line)+q(loc.column)+' ')||'') + `${type}: ${text}`;
  for (const {location, text} of out.warnings||[]) console.log(esbuildMsg('warning', text, location));
  for (const {location, text} of out.errors||[]) console.log(esbuildMsg('error', text, location));
  if (out.errors.length + out.warnings.length == 0) console.log("No warnings");
}

function readJSON(path) {
  let report = false;
  try {
    const contents = readFileSync(path, 'utf8');
    report = true;
    return(JSON.parse(contents))
  } catch(e) {
    if (report) {
      console.log(e.message);
      exit(-1);
    }
    return {}
  }
}

export {walkDir, copyAssets, showErrors, readJSON};