const Koa = require('koa');
const KSR = require('koa-static-resolver');
const websocket = require('koa-easy-ws')
const {basename} = require('path');
import {imbaCode} from './cache';
import hmrClient from './hmrClient.jst';

let activeSocket = false;

function koaServer(args) {
  const app = new Koa();
  app.use(websocket());
  app.use(KSR({
    dirs: [args.outdir],
    defaultIndex: 'index.html',
    livereload: `\n<script>${hmrClient}</script>\n`,
  }));
  app.use(async (ctx, next) => {
    if(ctx.path.startsWith('/virtualCSS/')) {
      const sourceId = basename(ctx.path, '.css');
      ctx.body = imbaCode.sourceId[sourceId].css;
      ctx.type = 'css';
      return;
    }
    await next();
  })
  app.use(async (ctx, next) => {
    if (ctx.ws) {
      const ws = await ctx.ws(); // retrieve socket
      activeSocket = ws;
      return;
    }
    await next();
  })
  return app;
}

export {koaServer, activeSocket};