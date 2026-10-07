import {createServer} from '../server.mjs';
import {WebSocket} from 'ws';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {writeFile,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const app=await createServer({host:'127.0.0.1',port:0,manualTick:true}),base=`http://127.0.0.1:${app.port}`,clients=[];
let renderer;
async function connect(hello){const ws=new WebSocket(base.replace('http:','ws:')),messages=[];clients.push(ws);ws.on('message',b=>messages.push(JSON.parse(b)));await once(ws,'open');ws.send(JSON.stringify(hello));return {ws,messages,send:m=>ws.send(JSON.stringify(m))};}
async function wait(c,predicate){for(let i=0;i<300;i++){const message=c.messages.find(predicate);if(message)return message;await new Promise(r=>setTimeout(r,10));}throw Error('WebSocket state timeout');}
try{
  const config=await fetch(base+'/config').then(r=>r.json()),host=await connect({type:'host',key:config.adminKey});await wait(host,m=>m.type==='host-ready');host.send({type:'game',game:'bull'});await wait(host,m=>m.game==='bull');
  const phone=await connect({type:'join',room:app.room,name:'생존자'}),joined=await wait(phone,m=>m.type==='joined');
  phone.send({type:'bull-map',map:'gates'});await new Promise(r=>setTimeout(r,50));assert.equal(app.match.bullMap,'classic');
  host.send({type:'bull-map',map:'gates'});await wait(host,m=>m.bull?.map==='gates');host.send({type:'start'});await wait(host,m=>m.phase==='running');
  const player=app.match.players.get(joined.id);assert.equal(player.role,'human');phone.send({type:'input',forward:1,steer:1});await new Promise(r=>setTimeout(r,50));assert.equal(player.input.forward,1);
  // Hold runners outside collision paths only while arranging a late-wave visual fixture.
  for(let i=0;i<600;i++){player.flight={x:100,z:100,endX:100,endZ:100,start:0,duration:1};app.match.tick(.1);}
  Object.assign(player,{flight:null,x:-8,z:0,y:0,yaw:1,alive:true,survival:60});
  for(let i=0;i<3;i++)app.match.players.set(`preview-${i}`,{...player,id:`preview-${i}`,name:`생존자 ${i+2}`,x:(i-1)*12,z:12,token:`preview-token-${i}`});
  await writeFile('.runtime/bull-gates-fixture.json',JSON.stringify(app.match.snapshot()));
  renderer=spawn(process.env.GODOT_EXE||'.runtime/godot/Godot_v4.7.2-stable_win64_console.exe',['--path','game','res://bull.tscn','--windowed','--resolution','1600x900','--','--bull-fixture=../.runtime/bull-gates-fixture.json',`--server=${base}`],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';renderer.stdout.on('data',b=>output+=b);renderer.stderr.on('data',b=>output+=b);const timer=setTimeout(()=>renderer.kill(),20000);const code=await new Promise((r,j)=>{renderer.once('exit',r);renderer.once('error',j);});clearTimeout(timer);assert.equal(code,0,output);assert(!/SCRIPT ERROR|^ERROR:/m.test(output),output);
  await copyFile('.runtime/bull-pc.png','.runtime/bull-gates-pc.png');
  console.log(`PASS: host-only map selection, single-player start, phone movement, Godot rendering; ${app.match.bull.spawned} spawned, ${app.match.bull.bulls.length} concurrent bulls.`);
}finally{renderer?.kill();for(const ws of clients)ws.terminate();await app.close();}
