import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/controller.js',import.meta.url),'utf8');
const fullscreenCode=source.slice(source.indexOf('const root=document.documentElement;'),source.indexOf('const send=m=>'));
function setup({prefixed=false,never=false,rejected=false,orientationPending=false}={}){
  const document=new EventTarget(),elements=new Map();
  const $=id=>{if(!elements.has(id))elements.set(id,{disabled:false,textContent:'',classList:{add(){},remove(){}}});return elements.get(id);};
  let fullCalls=0,lockCalls=0;
  document.documentElement={};
  document.documentElement[prefixed?'webkitRequestFullscreen':'requestFullscreen']=()=>{
    fullCalls++;
    if(rejected)return Promise.reject(new Error('Denied'));
    if(never)return new Promise(()=>{});
    setTimeout(()=>{document[prefixed?'webkitFullscreenElement':'fullscreenElement']=document.documentElement;document.dispatchEvent(new Event(prefixed?'webkitfullscreenchange':'fullscreenchange'));},25);
    // Legacy API returns no promise and completes on the later event.
    return prefixed?undefined:Promise.resolve();
  };
  const context=vm.createContext({document,$,navigator:{userAgent:'Android'},portrait:{matches:true},standalone:false,stop(){},screen:{orientation:{lock(){lockCalls++;assert(document.fullscreenElement||document.webkitFullscreenElement,'lock requires completed fullscreen');return orientationPending?new Promise(()=>{}):Promise.resolve();}}},setTimeout,clearTimeout});
  vm.runInContext(fullscreenCode,context);
  return {run:()=>vm.runInContext('landscapeFullscreen(true)',context),$,counts:()=>({fullCalls,lockCalls})};
}
test('wait for delayed Samsung fullscreen event before orientation lock; merge repeated taps',async()=>{
  const app=setup({prefixed:true});
  const pending=app.run();await app.run();
  assert.equal(app.$('landscape-button').disabled,true);
  assert.deepEqual(app.counts(),{fullCalls:1,lockCalls:0});
  await pending;
  assert.deepEqual(app.counts(),{fullCalls:1,lockCalls:1});
  assert.equal(app.$('landscape-button').disabled,false);
});
test('resolved fullscreen promise still waits for actual fullscreen state',async()=>{
  const app=setup();await app.run();
  assert.deepEqual(app.counts(),{fullCalls:1,lockCalls:1});
});
test('rejected fullscreen leaves orientation alone and re-enables retry',async()=>{
  const app=setup({rejected:true});await app.run();
  assert.deepEqual(app.counts(),{fullCalls:1,lockCalls:0});
  assert.match(app.$('fullscreen-notice-text').textContent,/거절/);
  assert.equal(app.$('landscape-button').disabled,false);
  await app.run();assert.equal(app.counts().fullCalls,2);
});
test('fullscreen and orientation promises that never settle release the button',async()=>{
  const apps=[setup({never:true}),setup({orientationPending:true})];
  await Promise.all(apps.map(app=>app.run()));
  for(const app of apps)assert.equal(app.$('landscape-button').disabled,false);
  assert.match(apps[0].$('rotation-help').textContent,/거절/);
  assert.match(apps[1].$('rotation-help').textContent,/직접 변경/);
});
