import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {screenTilt} from '../public/race-sensors.js';
const source=readFileSync(new URL('../public/race-controller.js',import.meta.url),'utf8').replace(/^import .*\r?\n/gm,'').replace('export function createRaceController','function createRaceController');
function setup({permission='granted',secure=true}={}){
  const elements=new Map(),events=new Map(),sent=[],views=[];let tick,clock=100,root;
  const element=()=>({hidden:false,children:[],style:{setProperty(){}},classList:{add(){},remove(){},toggle(){}},listeners:{},attributes:{},setAttribute(key,value){this.attributes[key]=value;},setPointerCapture(){},addEventListener(type,fn){this.listeners[type]=fn;}});
  const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const body={append(e){root=e;},classList:{add(){},remove(){}}};
  const document={body,visibilityState:'visible',createElement(){const e=element();e.querySelector=selector=>get(selector);e.querySelectorAll=()=>[get('#race-brake'),get('#race-throttle')];return e;}};
  const context=vm.createContext({document,window:{isSecureContext:secure,DeviceOrientationEvent:{},addEventListener(type,fn){events.set(type,fn);}},DeviceOrientationEvent:{requestPermission:async()=>permission},screen:{orientation:{angle:90,addEventListener(){}}},performance:{now:()=>clock},matchMedia:()=>({matches:false}),setInterval(fn){tick=fn;},setTimeout(){return 1;},clearTimeout(){},screenTilt,createRaceScene:()=>({update(){},setViewMode(mode){views.push(mode);}}),renderCarPreview(){},drawRaceMinimap(){}});
  vm.runInContext(source+';globalThis.create=createRaceController;',context);
  const controller=context.create({send:value=>sent.push(JSON.parse(JSON.stringify(value))),fullscreen(){}});
  const player={id:'one',name:'driver',color:'#ffaa22',rank:1,lap:0,speed:0,finishedAt:null,offroad:false};
  controller.update({game:'racing',phase:'running',race:{countdown:0,laps:3},players:[player]},player);
  const pointer=(id,type,pointerId)=>get(id).listeners[type]({pointerId,preventDefault(){}});
  return {controller,get,sent,views,tick:()=>{clock+=50;tick();},sensor:sample=>events.get('deviceorientation')(sample),pointer,root};
}
test('permitted sensor samples rotate the visible wheel and send the same calibrated steering to the server',async()=>{
  const s=setup();await s.get('#race-sensor').onclick();s.sensor({beta:0,gamma:90});s.sensor({beta:15,gamma:90});s.tick();assert(Math.abs(s.sent.at(-1).steer-.3)<1e-8);assert(Math.abs(parseFloat(s.get('#race-wheel').style.transform.slice(7))-34.5)<1e-8);
  s.get('#race-calibrate').onclick();s.tick();assert.equal(s.sent.at(-1).steer,0);
});
test('independent pedal touches coexist; releasing one and cancellation reset the correct controls',()=>{
  const s=setup();s.pointer('#race-throttle','pointerdown',1);s.pointer('#race-brake','pointerdown',2);s.tick();assert.deepEqual(s.sent.at(-1),{type:'input',steer:0,throttle:1,brake:1});
  s.pointer('#race-brake','pointerup',2);s.tick();assert.equal(s.sent.at(-1).throttle,1);assert.equal(s.sent.at(-1).brake,0);
  s.pointer('#race-throttle','pointercancel',1);s.tick();assert.equal(s.sent.at(-1).throttle,0);
  s.controller.stop();assert.equal(s.sent.at(-1).steer,0);
  s.pointer('#race-throttle','pointerdown',3);s.controller.stop();s.pointer('#race-throttle','pointerdown',4);s.tick();assert.equal(s.sent.at(-1).throttle,1);
});
test('permission denial and insecure access expose touch steering instead of leaving controls unusable',async()=>{
  for(const options of [{permission:'denied'},{secure:false}]){const s=setup(options);await s.get('#race-sensor').onclick();assert.equal(s.get('.race-touch-steer').hidden,false);s.pointer('#race-right','pointerdown',9);s.tick();assert.equal(s.sent.at(-1).steer,1);}
});

test('live and garage view selectors stay synchronized and notify the renderer and server',()=>{
  const s=setup();
  for(const [button,mode]of [['#race-view-first','first'],['#race-garage-view-third','third']]){
    s.get(button).onclick();
    assert.equal(s.views.at(-1),mode);
    assert.deepEqual(s.sent.at(-1),{type:'race-view',viewMode:mode});
    for(const prefix of ['#race-view-','#race-garage-view-'])for(const choice of ['first','third'])assert.equal(s.get(prefix+choice).attributes['aria-pressed'],String(mode===choice));
    assert.match(s.get('#race-view').attributes['aria-label'],mode==='third'?/3인칭 추적/:/1인칭/);
  }
});
