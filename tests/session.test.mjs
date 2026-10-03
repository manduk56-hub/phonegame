import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import QRCode from 'qrcode';
import {createServer} from '../server.mjs';
import {runSession,tunnelAddress,verifyTunnel} from '../launcher/session.mjs';

test('publishing and replacing a tunnel preserves players, room and host authorization',async()=>{
  const key='session-test-key-'.repeat(4);
  const app=await createServer({port:0,host:'127.0.0.1',hostKey:key,keepLanAddresses:true});
  try {
    const localUrl=`http://127.0.0.1:${app.port}`;
    const player=app.match.join('친구');
    for(const url of ['https://first-room.trycloudflare.com','https://replacement.trycloudflare.com']) {
      app.setPublicUrl(url);
      const cfg=await (await fetch(localUrl+'/config')).json();
      assert.equal(cfg.joinAddress,url);assert.equal(cfg.room,app.room);
      assert.equal(cfg.internetStatus,'online');assert.equal(cfg.adminKey,null);
      assert(!JSON.stringify(cfg).includes(key));assert(cfg.addresses.length>=2);
      assert.equal(await (await fetch(localUrl+'/qr')).text(),await QRCode.toString(`${url}/controller?room=${app.room}`,{type:'svg',margin:2}));
    }
    app.setPublicUrl('','reconnecting');
    const cfg=await (await fetch(localUrl+'/config')).json();
    assert.equal(cfg.internetStatus,'reconnecting');assert.equal(cfg.publicAddress,'');
    assert(!cfg.addresses.some(url=>url.includes('trycloudflare')));
    assert.equal(app.match.players.get(player.id),player);
    await verifyTunnel(localUrl,app.room,{timeout:1000});
    await assert.rejects(verifyTunnel(localUrl,'wrong-room',{timeout:20}),/외부 연결/);
  } finally {await app.close();}
});

test('two local servers reject each other room codes',async()=>{
  const a=await createServer({port:0,host:'127.0.0.1'}),b=await createServer({port:0,host:'127.0.0.1'});
  const ws=new WebSocket(`ws://127.0.0.1:${b.port}`);
  try {
    assert.notEqual(a.room,b.room);assert.notEqual(a.port,b.port);
    await once(ws,'open');const response=once(ws,'message');
    ws.send(JSON.stringify({type:'join',room:a.room,name:'잘못된 방'}));
    assert.equal(JSON.parse((await response)[0]).type,'error');
    assert.equal(b.match.players.size,0);
  } finally {ws.terminate();await Promise.all([a.close(),b.close()]);}
});

test('managed LAN session needs no credentials, closes its port and removes its lock',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'playroom-session-'));
  let url;
  try {
    await runSession({mode:'lan',launchGame:false,statusPath:path.join(dir,'session.json'),onReady:async({app,localUrl,close})=>{
      url=localUrl;
      const config=await (await fetch(url+'/config')).json();
      assert.equal(config.hostAuth,'token');assert.equal(config.adminKey,null);
      assert.equal(config.internetStatus,'local');assert.equal(config.room,app.room);
      await close();
    }});
    assert.equal(JSON.parse(await readFile(path.join(dir,'session.json'),'utf8')).stage,'stopped');
    await assert.rejects(readFile(path.join(dir,'session.lock')),error=>error.code==='ENOENT');
    await assert.rejects(fetch(url+'/config'));
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('failed tunnel startup leaves no running session or lock',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'playroom-failure-'));
  try {
    await assert.rejects(runSession({mode:'internet',launchGame:false,cloudflared:path.join(dir,'missing-binary'),statusPath:path.join(dir,'session.json')}),/터널/);
    assert.equal(JSON.parse(await readFile(path.join(dir,'session.json'),'utf8')).stage,'error');
    await assert.rejects(readFile(path.join(dir,'session.lock')),error=>error.code==='ENOENT');
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('tunnel log parsing accepts only HTTPS Quick Tunnel addresses',()=>{
  assert.equal(tunnelAddress('Ready https://one-two.trycloudflare.com |'),'https://one-two.trycloudflare.com');
  for(const value of ['http://room.trycloudflare.com','https://example.com','https://trycloudflare.com'])assert.equal(tunnelAddress(value),'');
});
