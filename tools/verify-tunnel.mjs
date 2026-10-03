import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocket} from 'ws';
import {runSession} from '../launcher/session.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=path.join(root,'.runtime',`tunnel-check-${Date.now()}`);
const binary=path.join(root,'.runtime/build-cache/cloudflared.exe');
const sessions=[],sockets=[];
let endpoints=[];
function connect(address,message,predicate) {
  return new Promise((resolve,reject)=>{
    const ws=new WebSocket(address);sockets.push(ws);
    const timer=setTimeout(()=>reject(Error('External WebSocket timed out')),15000);
    ws.once('error',error=>{clearTimeout(timer);reject(error);});
    ws.once('open',()=>ws.send(JSON.stringify(message)));
    ws.on('message',raw=>{const value=JSON.parse(raw);if(predicate(value)){clearTimeout(timer);resolve(value);}});
  });
}
try {
  for(let index=0;index<2;index++) {
    const state=path.join(directory,String(index));await mkdir(state,{recursive:true});
    let ready,failed;
    const waiting=new Promise((resolve,reject)=>{ready=resolve;failed=reject;});
    const running=runSession({mode:'internet',launchGame:false,statusPath:path.join(state,'session.json'),cloudflared:binary,onReady:({app,close})=>ready({app,close})});
    running.catch(failed);sessions.push(running);
    const endpoint=await waiting;endpoints.push(endpoint);
    console.log(`Tunnel ${index+1} verified: ${endpoint.app.addresses[0]}`);
  }
  const [a,b]=endpoints;
  assert.notEqual(a.app.addresses[0],b.app.addresses[0]);assert.notEqual(a.app.room,b.app.room);
  for(const {app} of endpoints) {
    const address=app.addresses[0];
    const config=await (await fetch(address+'/config')).json();
    assert.equal(config.adminKey,null);assert.equal(config.joinAddress,address);
    assert((await (await fetch(address+'/controller')).text()).includes('<html'));
    assert.equal((await fetch(address+'/qr')).status,200);
    await Promise.all(Array.from({length:16},(_,index)=>connect(address.replace('https:','wss:'),{type:'join',room:app.room,name:`Phone ${index+1}`},m=>m.type==='joined')));
    assert.equal(app.match.players.size,16);
    const rejected=await connect(address.replace('https:','wss:'),{type:'host',key:'invalid'},m=>m.type==='error');
    assert.match(rejected.message,/접속 정보/);
  }
  const rejected=await connect(b.app.addresses[0].replace('https:','wss:'),{type:'join',room:a.app.room,name:'Wrong room'},m=>m.type==='error');
  assert.match(rejected.message,/접속 정보/);
  await writeFile(path.join(root,'.runtime/tunnel-verification.json'),JSON.stringify({ok:true,rooms:2,playersPerRoom:16,publicConfigHidesHostKey:true,wrongRoomRejected:true},null,2));
  console.log('PASS: two independent automatic tunnels, 32 external WebSockets, QR/controller, hidden host credentials and wrong-room rejection.');
} finally {
  for(const ws of sockets)ws.terminate();
  await Promise.all(endpoints.map(endpoint=>endpoint.close()));
  await Promise.allSettled(sessions);
}
