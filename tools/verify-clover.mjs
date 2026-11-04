import assert from 'node:assert/strict';
import {createServer} from '../server.mjs';
import {WebSocket} from 'ws';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
const app=await createServer({host:'127.0.0.1',port:0,manualTick:true}),base=`http://127.0.0.1:${app.port}`,clients=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));let browser,child;
async function connect(hello){const ws=new WebSocket(base.replace('http:','ws:')),messages=[];clients.push(ws);ws.on('message',b=>messages.push(JSON.parse(b)));await once(ws,'open');ws.send(JSON.stringify(hello));return {ws,messages,send:m=>ws.send(JSON.stringify(m))};}
async function wait(c,predicate){for(let i=0;i<300;i++){const m=c.messages.find(predicate);if(m)return m;await delay(10);}throw Error('WebSocket timeout');}
try{
 for(const path of ['/clover-scene.js','/clover-controller.js','/clover.css'])assert.equal((await fetch(base+path)).status,200);
 const config=await fetch(base+'/config').then(r=>r.json()),host=await connect({type:'host',key:config.adminKey});await wait(host,m=>m.type==='host-ready');host.send({type:'game',game:'clover'});await wait(host,m=>m.game==='clover');
 const phones=await Promise.all(Array.from({length:16},(_,i)=>connect({type:'join',room:app.room,name:`클로버 ${i+1}`}))),joined=await Promise.all(phones.map(p=>wait(p,m=>m.type==='joined')));
 host.send({type:'start'});await wait(host,m=>m.game==='clover'&&m.phase==='running');const [a,b]=joined.map(p=>app.match.players.get(p.id)),s=app.match.clover,t=s.plants[s.target];
 Object.assign(a,{x:t.x,z:t.z});Object.assign(b,{x:t.x,z:t.z});phones[0].send({type:'action',action:'crouch',id:b.id});await delay(50);assert(a.crouching);assert(!b.crouching);
 phones[1].send({type:'action',action:'crouch'});await delay(30);for(const p of phones.slice(0,2))p.send({type:'action',action:'clover-select',round:s.round,plant:s.target});await delay(40);assert.equal(a.selected,s.target);assert.equal(b.selected,s.target);
 for(const p of phones.slice(0,2))p.send({type:'action',action:'pull',round:s.round});await delay(40);assert.equal(a.clovers+b.clovers,1);assert(s.reset>0);
 for(let i=0;i<25;i++)app.match.tick(.1);assert.equal(app.match.clover.round,2);assert.notEqual(app.match.clover.target,s.target);
 const score=a.clovers;phones[0].ws.close();await delay(50);const again=await connect({type:'join',room:app.room,token:joined[0].token});assert.equal((await wait(again,m=>m.type==='joined')).id,a.id);assert.equal(a.clovers,score);
 await writeFile('.runtime/clover-fixture.json',JSON.stringify(app.match.snapshot()));
 if(process.argv.includes('--render')){child=spawn(process.env.GODOT_EXE||'.runtime/godot/Godot_v4.7.2-stable_win64_console.exe',['--path','game','--windowed','--resolution','1600x900','res://clover.tscn','--','--clover-fixture=../.runtime/clover-fixture.json'],{windowsHide:true,stdio:['ignore','pipe','pipe']});let out='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>out+=b);const timer=setTimeout(()=>child.kill(),25000);const [code]=await once(child,'exit');clearTimeout(timer);assert.equal(code,0,out);assert(!/SCRIPT ERROR|^ERROR:/m.test(out),out);console.log('PASS: actual Godot PC render');}
 if(process.argv.includes('--browser')){
  const {chromium}=await import('file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');browser=await chromium.launch({channel:'chrome',headless:true});app.match.lobby();for(const p of [...app.match.players.values()])app.match.remove(p.id);
  const errors=[],page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('[data-game="7"]').click();await page.locator('#hub-play').click();await page.locator('#clover-overview').waitFor();
  const phone=await browser.newPage({viewport:{width:844,height:390}});phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base+'/controller?room='+app.room);await phone.locator('#name').fill('탐색자');await phone.locator('#join-button').click();await phone.locator('#clover-controller').waitFor();await page.locator('#start').click();await phone.waitForFunction(()=>!document.querySelector('.cl-crouch').disabled);
  const p=[...app.match.players.values()][0],s=app.match.clover,t=s.plants[s.target];Object.assign(p,{x:t.x,z:t.z+1,yaw:Math.PI});await phone.locator('.cl-crouch').click();await delay(200);assert(p.crouching);
  // Touch the rendered leaf in the actual camera, rather than injecting selection.
  const canvas=phone.locator('#clover-controller>canvas'),bounds=await canvas.boundingBox();let found=false;
  for(let y=130;y<bounds.height-15&&!found;y+=16)for(let x=220;x<bounds.width-150&&!found;x+=16){await canvas.click({position:{x,y}});await delay(12);found=p.selected===t.id;}
  assert(found,'target must be touchable in crouching first-person view');await phone.locator('.cl-pull').click();await delay(100);assert.equal(p.clovers,1);assert(app.match.clover.reset>0);for(let i=0;i<25;i++)app.match.tick(.1);await delay(100);
  for(const size of [{width:844,height:390},{width:568,height:320}]){await phone.setViewportSize(size);await delay(120);for(const sel of ['.cl-pad','.cl-crouch','.cl-pull','.cl-turn']){const b=await phone.locator(sel).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=size.width&&b.y+b.height<=size.height,sel);}await phone.screenshot({path:`.runtime/clover-phone-${size.width}.png`});}
  await page.locator('#clover-overview').screenshot({path:'.runtime/clover-web.png'});app.match.lobby();app.match.selectGame('krill');await phone.locator('#krill-controller').waitFor();assert(!(await phone.locator('#clover-controller').isVisible()));assert.deepEqual(errors,[]);console.log('PASS: browser menu, first-person touch and pull, phone layouts, switch to another game; no page errors');
 }
 console.log('PASS: 16 WebSocket players, action ownership, single winner, automatic reset, different target, reconnect score');
}finally{child?.kill();await browser?.close();for(const ws of clients)ws.terminate();await app.close();}
