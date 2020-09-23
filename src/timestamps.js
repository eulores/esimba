const {statSync, writeFileSync} = require('fs');
const {join} = require('path');
const {exit} = require('process');
import {walkDir, readJSON} from './utils';

const sentinel = '.timestamps.json'

// store timestamps of all files in target directory
function generateTimestamps(dir='.') {
  const lookup = {};
  walkDir(dir, path => lookup[join(...path)] = statSync(join(dir, ...path)).mtimeMs);
  writeFileSync(join(dir, sentinel), JSON.stringify(lookup));
}

// abort if timestamp isn't matching or was not previously recorded
function checkTimestamps(dir='.') {
  const lookup = readJSON(join(dir, sentinel));
  const tampered = [];
  walkDir(dir, x => x[x.length-1]!=sentinel && lookup[join(...x)]!=statSync(join(dir, ...x)).mtimeMs && tampered.push(...x));
  if (tampered.length) {
    console.log(`Directory ${dir} can only contain generated code. Detected manually modified files: ${tampered.join(', ')}\nAborting due to risk of overwriting...`);
    exit(1);
  }
}

export {generateTimestamps, checkTimestamps};