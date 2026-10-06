import {createServer} from '../server.mjs';
import {WebSocket} from 'ws';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const app=await createServer({host:'127.0.0.1',port:0,manualTick:true}),base=`http://127.0.0.1:${app.port}`,clients=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));let renderer;
async function connect(hello){const ws=new WebSocket(base.replace('http:','ws:'));clients.push(ws);const messages=[];ws.on('message',b=>messages.push(JSON.parse(b)));await once(ws,'open');ws.send(JSON.stringify(hello));return {ws,messages,send:m=>ws.send(JSON.stringify(m))};}
async function wait(c,fn){for(let i=0;i<300;i++){const m=c.messages.find(fn);if(m)return m;await delay(10);}throw Error('WebSocket state timeout');}
try{
 for(const path of ['/fishing-models.json','/fishing-controller.js','/fishing-controls.js','/fishing-scene.js','/fishing.css','/assets/fishing-card.png'])assert.equal((await fetch(base+path)).status,200,path);
 const config=await fetch(base+'/config').then(r=>r.json()),host=await connect({type:'host',key:config.adminKey});await wait(host,m=>m.type==='host-ready');host.send({type:'game',game:'fishing'});await wait(host,m=>m.game==='fishing');
 const phones=await Promise.all(Array.from({length:16},(_,i)=>connect({type:'join',room:app.room,name:`낚시꾼 ${i+1}`})));const joined=await Promise.all(phones.map(p=>wait(p,m=>m.type==='joined')));
 host.send({type:'start'});await wait(host,m=>m.phase==='running');assert.equal(app.match.players.size,16);
 const a=app.match.players.get(joined[0].id),b=app.match.players.get(joined[1].id);
 phones[0].send({type:'action',action:'cast',id:b.id});await delay(30);assert.equal(a.fishing.stage,'casting');assert.equal(b.fishing.stage,'ready');
 app.match.tick(.7);a.fishing.timer=.01;app.match.tick(.05);phones[0].send({type:'action',action:'hook'});await delay(30);assert.equal(a.fishing.stage,'fighting');
 phones[0].send({type:'input',tilt:a.fishing.direction,reel:1,id:b.id});await delay(30);assert.equal(a.input.reel,1);assert.equal(b.input.reel,0);
 for(let i=0;i<300;i++){a.input={tilt:a.fishing.direction,reel:1};a.lastInput=Date.now();app.match.tick(.05);}assert.equal(a.caught,1);
 // Live PC receives all 16 states and a real QR through the common host channel.
 for(const p of app.match.players.values()){app.match.action(p.id,'cast');app.match.tick(.7);p.fishing.timer=1.4;}
 const engine=process.env.GODOT_EXE||'.runtime/build-cache/godot-4.6.2/Godot_v4.6.2-stable_win64_console.exe';
 renderer=spawn(engine,['--path','game','res://fishing.tscn','--windowed','--resolution','1600x900','--','--fishing-capture',`--server=${base}`],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';renderer.stdout.on('data',b=>output+=b);renderer.stderr.on('data',b=>output+=b);const timer=setTimeout(()=>renderer.kill(),15000);const code=await new Promise((r,j)=>{renderer.once('exit',r);renderer.once('error',j);});clearTimeout(timer);assert.equal(code,0,output);assert(!/SCRIPT ERROR|^ERROR:/m.test(output),output);
 const metrics=JSON.parse(await readFile('.runtime/fishing-render.json','utf8'));assert.equal(metrics.players,16);assert(metrics.qr);assert.equal(metrics.phase,'running');assert(metrics.fps>15);
 app.match.remaining=.01;app.match.tick(.05);await wait(phones[0],m=>m.phase==='finished');assert.equal(app.match.results.players[0].score,1);assert.deepEqual(app.match.results.winnerIds,[a.id]);
 host.send({type:'lobby'});await delay(60);phones[0].ws.close();await delay(60);const again=await connect({type:'join',room:app.room,token:joined[0].token});assert.equal((await wait(again,m=>m.type==='joined')).id,a.id);
 console.log('PASS: 16 real WebSocket phones, owned actions/input, cast/hook/catch, individual result, reconnect, assets and actual Godot PC rendering',metrics);
}finally{renderer?.kill();for(const ws of clients)ws.terminate();await app.close();}
