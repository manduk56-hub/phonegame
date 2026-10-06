import {createServer} from '../server.mjs';
import {WebSocket} from 'ws';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const app=await createServer({host:'127.0.0.1',port:0,manualTick:true}),base=`http://127.0.0.1:${app.port}`,clients=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));let renderer;
async function connect(hello){const ws=new WebSocket(base.replace('http:','ws:')),messages=[];clients.push(ws);ws.on('message',b=>messages.push(JSON.parse(b)));await once(ws,'open');ws.send(JSON.stringify(hello));return {ws,messages,send:m=>ws.send(JSON.stringify(m))};}
async function wait(c,fn){for(let i=0;i<300;i++){const m=c.messages.find(fn);if(m)return m;await delay(10);}throw Error('WebSocket state timeout');}
async function render(args){const engine=process.env.GODOT_EXE||'.runtime/build-cache/godot-4.6.2/Godot_v4.6.2-stable_win64_console.exe';renderer=spawn(engine,['--path','game','res://krill.tscn','--windowed','--resolution','1600x900','--',...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';renderer.stdout.on('data',b=>output+=b);renderer.stderr.on('data',b=>output+=b);const timer=setTimeout(()=>renderer.kill(),20000);const code=await new Promise((r,j)=>{renderer.once('exit',r);renderer.once('error',j);});clearTimeout(timer);assert.equal(code,0,output);assert(!/SCRIPT ERROR|^ERROR:/m.test(output),output);}
try{
 for(const path of ['/krill-models.json','/krill-controller.js','/krill-scene.js','/krill.css','/assets/krill-card.png'])assert.equal((await fetch(base+path)).status,200,path);
 const config=await fetch(base+'/config').then(r=>r.json()),host=await connect({type:'host',key:config.adminKey});await wait(host,m=>m.type==='host-ready');host.send({type:'game',game:'krill'});await wait(host,m=>m.game==='krill');
 const phones=await Promise.all(Array.from({length:16},(_,i)=>connect({type:'join',room:app.room,name:`크릴 ${i+1}`})));const joined=await Promise.all(phones.map(p=>wait(p,m=>m.type==='joined')));host.send({type:'start'});await wait(host,m=>m.phase==='running');
 const a=app.match.players.get(joined[0].id),b=app.match.players.get(joined[1].id);phones[0].send({type:'input',moveX:1,moveY:-1,id:b.id});await delay(30);assert.equal(a.input.moveX,1);assert.equal(b.input.moveX,0);
 a.x=0;a.y=0;b.x=1;b.y=0;phones[0].send({type:'action',action:'tail',id:b.id});await delay(30);assert(a.tail>0);assert(b.vx>0);assert.equal(b.tail,0);
 app.match.krill.cycleTime=4.8;app.match.tick(.1);app.match.krill.obstacles=[{id:98,x:-5,y:3,z:-6,r:.8,kind:'fish'},{id:99,x:5,y:-3,z:-10,r:.8,kind:'rock'}];
 await render(['--krill-capture',`--server=${base}`]);const metrics=JSON.parse(await readFile('.runtime/krill-render.json','utf8'));assert.equal(metrics.players,16);assert(metrics.qr);assert.equal(metrics.phase,'running');assert(metrics.fps>15);
 await writeFile('.runtime/krill-running.json',JSON.stringify(app.match.snapshot()));
 for(const p of app.match.players.values())if(p!==a)p.alive=false;app.match.tick(.1);assert.equal(app.match.phase,'finished');assert.deepEqual(app.match.results.winnerIds,[a.id]);phones[0].send({type:'input',moveX:1,moveY:0});await delay(30);app.match.tick(.1);assert(app.match.krill.ride.x>0);
 await writeFile('.runtime/krill-winner.json',JSON.stringify(app.match.snapshot()));await render(['--krill-fixture=../.runtime/krill-winner.json']);await copyFile('.runtime/krill-pc.png','.runtime/krill-winner.png');
 host.send({type:'lobby'});await delay(60);phones[0].ws.close();await delay(60);const again=await connect({type:'join',room:app.room,token:joined[0].token});assert.equal((await wait(again,m=>m.type==='joined')).id,a.id);
 console.log('PASS: 16 WebSocket phones, input/action ownership, tail push, winner riding, reconnect, reference assets and actual Godot rendering',metrics);
}finally{renderer?.kill();for(const ws of clients)ws.terminate();await app.close();}
