const LRU = require('lru-cache');

const cacheBackend = new LRU(200);
const sourceIdMapping = {};
const imbaCode = {
  reloadFlag: false,
  styleFlag: false,
  cacheHit: 0,
  reset: ()=>{
    imbaCode.reloadFlag = false;
    imbaCode.styleFlag = false;
    imbaCode.cacheHit = 0;
  },
  update: (sourceId, path) => sourceIdMapping[sourceId] = path,
  path: new Proxy({}, {
    get: (_, prop) => cacheBackend.get(prop),
    set: (_, prop, val) => cacheBackend.set(prop, val),
  }),
  sourceId: new Proxy({}, {
    get: (_, prop) => cacheBackend.get(sourceIdMapping[prop]),
    set: (_, prop, val) => cacheBackend.set(sourceIdMapping[prop], val),
  }),
};

export {imbaCode};