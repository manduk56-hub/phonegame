// Each control owns one pointer; other controls remain independently usable.
export function bindPad(el, callback, {vertical=false, eightWay=false, radius=.36, knobTravel=.36, enabled=()=>true}={}) {
  let pointer=null;
  const knob=el.querySelector('.knob');
  function reset() {
    const previous=pointer;
    pointer=null;
    if(previous!==null&&el.hasPointerCapture(previous))el.releasePointerCapture(previous);
    knob.style.transform='translate(-50%,-50%)';
    if(el.dataset)el.dataset.direction='center';
    callback(0,0);
  }
  function update(e) {
    if(!enabled()) {reset();return;}
    const b=el.getBoundingClientRect(), fraction=vertical?.38:radius;
    let x=vertical?0:(e.clientX-b.left-b.width/2)/(b.width*radius);
    let y=(e.clientY-b.top-b.height/2)/(b.height*fraction);
    if(eightWay&&!vertical){
      const strength=Math.min(1,Math.max(Math.abs(x),Math.abs(y)));
      if(strength<.1){x=0;y=0;if(el.dataset)el.dataset.direction='center';}
      else{
        const direction=(Math.round(Math.atan2(y,x)/(Math.PI/4))+8)%8;
        const axes=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];
        [x,y]=axes[direction].map(v=>v*strength);
        if(el.dataset)el.dataset.direction=['e','se','s','sw','w','nw','n','ne'][direction];
      }
    }else{
      const length=Math.hypot(x,y);
      if(length>1){x/=length;y/=length;}
      if(Math.abs(x)<.06)x=0;
      if(Math.abs(y)<.06)y=0;
    }
    knob.style.transform=`translate(calc(-50% + ${x*b.width*knobTravel}px), calc(-50% + ${y*b.height*(vertical?fraction:knobTravel)}px))`;
    callback(x,y);
  }
  el.onpointerdown=e=>{
    if(pointer!==null||!enabled())return;
    pointer=e.pointerId;el.setPointerCapture(pointer);update(e);
  };
  el.onpointermove=e=>{if(e.pointerId===pointer)update(e);};
  const release=e=>{if(e.pointerId===pointer)reset();};
  el.onpointerup=release;el.onpointercancel=release;el.onlostpointercapture=release;
  return reset;
}

// Inner disc: fine movement. Outer ring: smoothly face the finger's heading,
// measured from the facing direction at the start of this gesture.
export function createRimSteering(){
  let x=0,y=0,anchor=null;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  return {
    set(nextX,nextY,yaw){x=nextX;y=nextY;if(Math.hypot(x,y)<.12){x=y=0;anchor=null;}else if(anchor===null)anchor=yaw;},
    rotate(delta){if(anchor!==null)anchor+=delta;},
    step(yaw,dt){
      const strength=Math.min(1,Math.hypot(x,y));
      if(anchor===null)return {yaw,forward:0,strafe:0,rim:0};
      const t=clamp((strength-.65)/.3,0,1),rim=t*t*(3-2*t);
      const target=anchor-Math.atan2(x,-y),delta=Math.atan2(Math.sin(target-yaw),Math.cos(target-yaw));
      const turn=clamp(delta,-4.2*dt,4.2*dt)*rim;
      return {yaw:yaw+turn,forward:-y*(1-rim)+strength*.25*rim,strafe:x*(1-rim),rim};
    }
  };
}
