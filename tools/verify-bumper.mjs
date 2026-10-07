import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from '../server.mjs';
import {chromium} from 'file:///C:/Users/USER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const app=await createServer({host:'127.0.0.1',port:0,manualTick:true}),base=`http://127.0.0.1:${app.port}`;
let browser,renderer;const errors=[];
try{
  await mkdir('.runtime',{recursive:true});browser=await chromium.launch({channel:'chrome',headless:true});
  const host=await browser.newPage({viewport:{width:1440,height:1000}});host.on('pageerror',e=>errors.push(e.message));
  await host.goto(base);await host.locator('[data-game="1"]').click();await host.locator('#hub-play').click();
  await host.locator('[data-track="bumper-arena"]').click();await host.waitForFunction(()=>document.querySelector('[data-track="bumper-arena"]').getAttribute('aria-pressed')==='true');
  const phone=await browser.newPage({viewport:{width:844,height:390}});phone.on('pageerror',e=>errors.push(e.message));
  const source=await readFile('public/race-scene.js','utf8');
  await phone.route('**/race-scene.js',r=>r.fulfill({contentType:'text/javascript',body:source.replace('camera.updateProjectionMatrix();renderer.render(scene,camera);','window.bumperCheck={y:camera.position.y,fov:camera.fov,blasts:[...cars.values()].filter(c=>c.userData.blast?.visible).length};camera.updateProjectionMatrix();renderer.render(scene,camera);')}));
  await phone.goto(base+'/controller?room='+app.room);await phone.locator('#name').fill('범퍼 드라이버');await phone.locator('#join-button').click();await phone.locator('#race-garage').waitFor();
  app.match.join('상대');await phone.locator('#race-garage-view-third').click();await host.locator('#start').click();app.match.countdown=0;
  await phone.waitForFunction(()=>document.querySelector('#race-garage').hidden&&window.bumperCheck?.fov===68);
  assert(await host.locator('#race-overview').isVisible());assert(!(await host.locator('.race-broadcast').isVisible()));
  for(const id of ['race-view-first','race-view-third','race-brake','race-throttle']){const b=await phone.locator('#'+id).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=844.1&&b.y+b.height<=390.1,id);}
  await phone.screenshot({path:'.runtime/bumper-phone.png'});await host.locator('#race-overview').screenshot({path:'.runtime/bumper-web.png'});
  await phone.locator('#race-view-first').click();await phone.waitForFunction(()=>window.bumperCheck.fov===78);await phone.locator('#race-view-third').click();
  const p=[...app.match.players.values()][0];p.x=0;p.z=43;p.yaw=0;p.pushZ=25;
  app.match.tick(.05,performance.now());assert(p.falling);for(let i=0;i<20;i++)app.match.tick(.05,performance.now());
  assert.equal(p.landedAt,null);await phone.waitForFunction(()=>window.bumperCheck.y<0);await phone.screenshot({path:'.runtime/bumper-fall.png'});
  while(p.landedAt===null)app.match.tick(.05,performance.now());app.match.tick(.2,performance.now());
  await phone.waitForFunction(()=>window.bumperCheck.blasts===1);await phone.screenshot({path:'.runtime/bumper-explosion-phone.png'});await host.locator('#race-overview').screenshot({path:'.runtime/bumper-explosion-web.png'});
  const engine=process.env.GODOT_EXE||'.runtime/build-cache/godot-4.6.2/Godot_v4.6.2-stable_win64_console.exe';
  renderer=spawn(engine,['--path','game','--windowed','--resolution','1600x900','--','--race-capture',`--server=${base}`],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';renderer.stdout.on('data',b=>output+=b);renderer.stderr.on('data',b=>output+=b);
  const completed=new Promise((resolve,reject)=>{renderer.once('exit',resolve);renderer.once('error',reject);}),timeout=setTimeout(()=>renderer.kill(),15000);
  const code=await completed;clearTimeout(timeout);assert.equal(code,0,output);assert(!/SCRIPT ERROR|^ERROR:/m.test(output),output);
  const metrics=JSON.parse(await readFile('.runtime/racing-render.json','utf8'));assert.equal(metrics.track,'bumper-arena');assert.equal(metrics.players,2);assert(metrics.updates>20);assert(metrics.fps>15);
  for(let i=0;i<35;i++)app.match.tick(.05,performance.now());await phone.locator('#race-finish').waitFor();assert.match(await phone.locator('#race-finish').innerText(),/생존/);
  assert.deepEqual(errors,[]);console.log('PASS: bumper selection, single PC overview, landscape controls, both phone cameras, fall and floor explosion, results, native Godot render.',metrics);
}finally{renderer?.kill();await browser?.close();await app.close();}
