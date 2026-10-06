import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {WebSocket} from 'ws';
import {createServer} from '../server.mjs';
import {CIRCUIT,nearestTrack} from '../racing.mjs';
const app=await createServer({port:0,host:'127.0.0.1'}),base=`http://127.0.0.1:${app.port}`,clients=[];
const chosenCar=process.argv.find(arg=>arg.startsWith('--car='))?.slice(6)||'classic';
let renderer;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function connect(hello){
  const ws=new WebSocket(base.replace('http:','ws:'));clients.push(ws);const messages=[];ws.on('message',b=>messages.push(JSON.parse(b)));
  await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify(hello));
  const wait=async predicate=>{for(let i=0;i<500;i++){const message=messages.find(predicate);if(message)return message;await delay(10);}throw Error('Socket message timeout');};
  return {ws,wait,send:m=>ws.send(JSON.stringify(m))};
}
try{
  const config=await fetch(base+'/config').then(r=>r.json());const host=await connect({type:'host',key:config.adminKey});await host.wait(m=>m.type==='host-ready');host.send({type:'game',game:'racing'});await host.wait(m=>m.game==='racing');
  const phones=await Promise.all(Array.from({length:16},(_,i)=>connect({type:'join',room:app.room,name:`드라이버 ${i+1}`})));
  const ids=await Promise.all(phones.map(p=>p.wait(m=>m.type==='joined')));phones.forEach((p,i)=>{p.send({type:'car',car:chosenCar});p.send({type:'race-view',viewMode:i%2?'third':'first'});});await delay(150);
  assert.equal(app.match.players.size,16);assert.equal(new Set([...app.match.players.values()].map(p=>p.color)).size,16);assert([...app.match.players.values()].every(p=>p.car===chosenCar));
  host.send({type:'start'});await host.wait(m=>m.phase==='running');const before=app.match.snapshot();
  phones[0].send({type:'input',id:ids[1].id,steer:.5,throttle:1});await delay(50);assert.equal(app.match.players.get(ids[0].id).input.steer,.5);assert.equal(app.match.players.get(ids[1].id).input.steer,0);
  await mkdir('.runtime',{recursive:true});
  const engine=process.env.GODOT_EXE||'.runtime/build-cache/godot-4.6.2/Godot_v4.6.2-stable_win64_console.exe';
  renderer=spawn(engine,['--path','game','--windowed','--resolution','1600x900','--','--race-capture',`--server=${base}`],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';renderer.stdout.on('data',b=>output+=b);renderer.stderr.on('data',b=>output+=b);const completed=new Promise((resolve,reject)=>{renderer.once('exit',resolve);renderer.once('error',reject);});
  const pump=setInterval(()=>phones.forEach((phone,i)=>{const p=app.match.players.get(ids[i].id),track=nearestTrack(p.x,p.z),target=CIRCUIT.points[(track.index+8)%CIRCUIT.points.length],yaw=Math.atan2(target.x-p.x,target.z-p.z),error=Math.atan2(Math.sin(yaw-p.yaw),Math.cos(yaw-p.yaw));phone.send({type:'input',throttle:p.speed<18?1:0,brake:p.speed>21?1:0,steer:Math.max(-1,Math.min(1,-error*1.7))});}),50);
  const timeout=setTimeout(()=>renderer.kill(),20000);const exitCode=await completed;clearTimeout(timeout);clearInterval(pump);assert.equal(exitCode,0,output);assert(!/SCRIPT ERROR|^ERROR:/m.test(output),output);
  const metrics=JSON.parse(await readFile('.runtime/racing-render.json','utf8'));assert.equal(metrics.game,'racing');assert.equal(metrics.players,16);assert(metrics.updates>20);assert(metrics.qr);assert(metrics.fps>15);
  assert.equal(metrics.isometricCameras,17,'main broadcast and all 16 tiles must stay 2.5D with mixed phone views');
  for(const [i,p]of [...app.match.players.values()].entries())assert(Math.hypot(p.x-before.players[i].x,p.z-before.players[i].z)>1,'driver did not move');
  for(const file of ['/race-controller.js','/race-scene.js','/race-sensors.js','/race.css','/car-shapes.json','/assets/racing-models.png'])assert.equal((await fetch(base+file)).status,200,file);
  console.log('PASS: 16 racing clients, shared vehicle selection with unique colors, authenticated input ownership, actual movement, QR and live PC renderer.',metrics);
}finally{renderer?.kill();for(const ws of clients)ws.terminate();await app.close();}
