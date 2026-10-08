import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindPad,protectGameControls} from '../public/pointer-pad.js';
test('all game surfaces block native long-press actions while input and chat remain editable',()=>{
  const handlers=new Map();
  protectGameControls({addEventListener(type,handler,options){assert.equal(options.capture,true);handlers.set(type,handler);}});
  for(const surface of ['.phone-controller .controls','#race-controller','#bull-controller','#fps-controller','#fishing-controller','#krill-controller',null]){
    for(const editable of [false,true])for(const handler of handlers.values()){
      let prevented=false;
      handler({target:{closest(selector){return selector.startsWith('input,')?editable:surface&&selector.split(',').includes(surface);}},preventDefault(){prevented=true;}});
      assert.equal(prevented,Boolean(surface)&&!editable);
    }
  }
});
function element() {
  const captured=new Set(), knob={style:{}};
  return {querySelector:()=>knob,getBoundingClientRect:()=>({left:0,top:0,width:200,height:200}),setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
}
const event=(pointerId,x,y)=>({pointerId,clientX:x,clientY:y});
test('eight-way square pads snap all directions, keep analog strength and cancel both axes',()=>{
  const el=element();el.dataset={};let value;
  bindPad(el,(x,y)=>value=[x,y],{eightWay:true});
  const samples=[[172,100,1,0,'e'],[172,172,1,1,'se'],[100,172,0,1,'s'],[28,172,-1,1,'sw'],[28,100,-1,0,'w'],[28,28,-1,-1,'nw'],[100,28,0,-1,'n'],[172,28,1,-1,'ne']];
  for(const [x,y,a,b,dir] of samples){el.onpointerdown(event(1,x,y));assert.deepEqual(value,[a,b]);assert.equal(el.dataset.direction,dir);el.onpointerup(event(1,x,y));assert.deepEqual(value,[0,0]);}
  el.onpointerdown(event(2,136,64));assert.deepEqual(value,[.5,-.5]);
  el.onpointermove(event(2,136,97));assert.deepEqual(value,[.5,0]);
  el.onpointermove(event(2,104,104));assert.deepEqual(value,[0,0]);
  el.onpointermove(event(2,200,-100));assert.deepEqual(value,[1,-1]);
  el.onpointercancel(event(2,200,-100));assert.deepEqual(value,[0,0]);assert.equal(el.dataset.direction,'center');
});
test('four independent touches can drive both tracks and both joysticks, with selective cancellation',()=>{
  const elements=Array.from({length:4},element), values=Array(4).fill(null);
  const resets=elements.map((el,i)=>bindPad(el,(x,y)=>values[i]=[x,y],{vertical:i>1}));
  elements.forEach((el,i)=>el.onpointerdown(event(i,150,50)));
  assert(values.every(v=>v[1]<0));assert(values[0][0]>0);assert.equal(values[2][0],0);
  const before=values[0];elements[0].onpointermove(event(99,0,0));assert.equal(values[0],before);
  elements[0].onpointercancel(event(0,0,0));assert.deepEqual(values[0],[0,0]);assert(values[1][0]>0);
  for(const reset of resets)reset();assert(values.every(v=>v[0]===0&&v[1]===0));
  elements[0].onpointerdown(event(8,100,28));assert.equal(values[0][1],-1);
});
test('disabled controls ignore touches; focus reset discards captured pointers and later moves',()=>{
  const el=element();let enabled=false,value=[0,0];const reset=bindPad(el,(x,y)=>value=[x,y],{enabled:()=>enabled});
  el.onpointerdown(event(1,172,100));assert.deepEqual(value,[0,0]);
  enabled=true;el.onpointerdown(event(1,172,100));assert.equal(value[0],1);
  reset();el.onpointermove(event(1,172,100));assert.deepEqual(value,[0,0]);
  el.onpointerdown(event(2,172,100));enabled=false;el.onpointermove(event(2,172,100));assert.deepEqual(value,[0,0]);
});
