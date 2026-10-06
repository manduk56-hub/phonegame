// Device axes follow the W3C Device Orientation and Motion specification.
export function landscapeFrame(beta,gamma,rotation){
  if(![beta,gamma,rotation].every(Number.isFinite))return null;
  const b=beta*Math.PI/180,g=gamma*Math.PI/180,r=rotation*Math.PI/180;
  const gx=-Math.cos(b)*Math.sin(g),gy=Math.sin(b),gz=Math.cos(b)*Math.cos(g);
  const sx=gx*Math.cos(r)+gy*Math.sin(r),sy=-gx*Math.sin(r)+gy*Math.cos(r);
  return {roll:-Math.atan2(sx,Math.hypot(sy,gz))*180/Math.PI,pitch:Math.atan2(sy,gz)*180/Math.PI};
}
export function angleDelta(a,b){return Math.atan2(Math.sin((a-b)*Math.PI/180),Math.cos((a-b)*Math.PI/180))*180/Math.PI;}
export function reelDelta(previous,next){
  const d=Math.atan2(Math.sin(next-previous),Math.cos(next-previous));
  return d>0&&d<.8?d:0; // Screen coordinates: positive angle is clockwise.
}
export function createHookDetector(){
  let prior=null,last=0;
  return {reset(){prior=null;last=0;},sample(frame,time){
    if(!frame){prior=null;return false;}
    const old=prior;prior={pitch:frame.pitch,time};
    if(!old||time-old.time>200||time-old.time<8||time-last<850)return false;
    // Top of screen rotates toward the holder: positive screen-X pitch, in either landscape orientation.
    const speed=angleDelta(frame.pitch,old.pitch)/((time-old.time)/1000);
    if(speed > 145){last=time;return true;}return false;
  }};
}
