const LRU = require('lru-cache');

const cacheBackend = new LRU(200);
const fidMapping = {};
const imbaCode = {
  reloadFlag: false,
  styleFlag: false,
  cacheHit: 0,
  reset: ()=>{
    imbaCode.reloadFlag = false;
    imbaCode.styleFlag = false;
    imbaCode.cacheHit = 0;
  },
  update: (fid, path) => fidMapping[fid] = path,
  path: new Proxy({}, {
    get: (_, prop) => cacheBackend.get(prop),
    set: (_, prop, val) => cacheBackend.set(prop, val),
  }),
  fid: new Proxy({}, {
    get: (_, prop) => cacheBackend.get(fidMapping[prop]),
    set: (_, prop, val) => cacheBackend.set(fidMapping[prop], val),
  }),
};

export {imbaCode};