import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {spawn} from 'node:child_process';
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createServer} from '../server.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),runtime=path.join(root,'.runtime');
await mkdir(runtime,{recursive:true});
let godot=process.env.GODOT_EXE;
if(!godot){const files=await readdir(path.join(runtime,'godot'));godot=path.join(runtime,'godot',files.find(f=>f.endsWith('_console.exe')));}
const endpoint=process.argv.find(a=>a.startsWith('--endpoint='))?.slice('--endpoint='.length);
if(endpoint&&new URL(endpoint).protocol!=='https:')throw Error('Remote verification requires HTTPS.');
const app=endpoint?null:await createServer({port:0,host:'127.0.0.1'});
const base=endpoint||`http://127.0.0.1:${app.port}`;
const key=endpoint?(process.env.DIRT_RALLY_HOST_KEY||(await readFile(path.join(runtime,'remote-host-key'),'utf8')).trim()):null;
const peers=[];
let renderer;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function client() {
  const ws=new WebSocket(base.replace(/^http/,'ws'));
  peers.push(ws);
  const c={ws,messages:[],arrivals:[],state:null,send:m=>ws.send(JSON.stringify(m))};
  c.open=new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
  ws.on('message',raw=>{const m=JSON.parse(raw);c.messages.push(m);if(m.type==='state'){c.state=m;c.arrivals.push(performance.now());}});
  c.wait=async predicate=>{const end=performance.now()+4000;while(performance.now()<end){const m=c.messages.find(predicate);if(m)return m;await delay(10);}throw Error('WebSocket state timeout');};
  return c;
}
try {
  const config=await fetch(`${base}/config`).then(r=>r.json());
  if(endpoint){assert.equal(config.adminKey,null);assert.equal(config.hostAuth,'token');assert.equal(config.joinAddress,base);}
  const host=client();await host.open;host.send({type:'host',key:key||config.adminKey});await host.wait(m=>m.type==='host-ready');
  host.send({type:'configure',teams:8,duration:60});await host.wait(m=>m.teamCount===8);
  const phones=Array.from({length:16},client);await Promise.all(phones.map(c=>c.open));
  phones.forEach((c,i)=>c.send({type:'join',room:config.room,name:`Driver ${i+1}`}));
  const identities=await Promise.all(phones.map(c=>c.wait(m=>m.type==='joined')));
  const before=await host.wait(m=>m.type==='state'&&m.players.length===16);
  host.send({type:'start'});await host.wait(m=>m.phase==='running');
  const captureName=endpoint?'remote-live-preview.png':'live-preview.png';
  renderer=spawn(godot,['--path',path.join(root,'game'),'--','--capture',`--capture-name=${captureName}`,`--server=${base}`],{cwd:root,env:{...process.env,DIRT_RALLY_HOST_KEY:key||''},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';renderer.stdout.on('data',b=>stdout+=b);renderer.stderr.on('data',b=>stderr+=b);
  const completion=new Promise((resolve,reject)=>{renderer.once('error',reject);renderer.once('exit',code=>resolve(code));});
  const begin=performance.now();
  for(let step=0;step<40;step++) {
    phones.forEach((c,i)=>c.send(step<20?{type:'input',travelL:-1,travelR:-1}:{type:'input',boom:.15+i*.025,stick:.1,curl:.1,swing:(i%2?1:-1)*.1}));
    await delay(50);
  }
  phones.forEach(c=>c.send({type:'input'}));
  await delay(150);
  for(let i=0;i<16;i++) {
    const previous=before.players[i],p=phones[i].state.players.find(p=>p.id===identities[i].id);
    assert(Math.hypot(p.x-previous.x,p.z-previous.z)>2,`Driver ${i+1} did not move`);
    assert(p.boom>previous.boom,`Driver ${i+1} articulation did not update`);
    assert(phones[i].arrivals.length>=20,`Driver ${i+1} did not receive sustained state`);
  }
  // A controller supplies another player's ID; the server still binds input to the authenticated sender.
  const ownershipBefore=phones[0].state.players;
  for(let i=0;i<4;i++){phones[0].send({type:'input',id:identities[1].id,swing:1});await delay(50);}
  await delay(100);
  if(app){
    assert.equal(app.match.players.get(identities[0].id).input.swing,1);
    assert.equal(app.match.players.get(identities[1].id).input.swing,0);
  } else {
    const ownershipAfter=phones[0].state.players;
    assert(ownershipAfter.find(p=>p.id===identities[0].id).turret>ownershipBefore.find(p=>p.id===identities[0].id).turret);
    assert.equal(ownershipAfter.find(p=>p.id===identities[1].id).turret,ownershipBefore.find(p=>p.id===identities[1].id).turret);
  }
  phones[0].send({type:'input'});
  const timeout=setTimeout(()=>renderer.kill(),10000);
  const code=await completion;clearTimeout(timeout);
  process.stdout.write(stdout);process.stderr.write(stderr);
  assert.equal(code,0,'Godot failed to capture live state');assert(!/SCRIPT ERROR|^ERROR:/m.test(stderr));
  const metrics=JSON.parse(await readFile(path.join(runtime,'render-metrics.json'),'utf8'));
  assert.equal(metrics.players,16);assert.equal(metrics.phase,'running');assert(metrics.network_updates>=10);assert(metrics.qr_ready);assert(metrics.fps>0);
  const stateIntervals=phones.map(c=>(c.arrivals.at(-1)-c.arrivals[0])/(c.arrivals.length-1));
  const report={...metrics,physicalPhones:false,transport:endpoint?'16 remote WSS clients + live Godot renderer':'16 local WebSocket clients + live Godot renderer',endpoint:base,durationMs:Math.round(performance.now()-begin),stateIntervalMs:stateIntervals.map(n=>Math.round(n*100)/100),playerOwnershipVerified:true};
  await writeFile(path.join(runtime,endpoint?'remote-live-report.json':'live-report.json'),JSON.stringify(report,null,2));
  if(endpoint){host.send({type:'lobby'});for(const id of identities)host.send({type:'remove',id:id.id});await delay(150);}
  console.log('PASS: all 16 controllers moved and articulated their own excavators; live Godot received state and QR. Physical phones were not tested.');
} finally {
  if(renderer&&renderer.exitCode===null)renderer.kill();
  for(const ws of peers)ws.terminate();
  if(app)await app.close();
}
