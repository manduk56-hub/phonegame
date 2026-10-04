// Project gravity into screen coordinates so either landscape direction works.
export function screenTilt(beta,gamma,rotation){
  if(![beta,gamma,rotation].every(Number.isFinite))return null;
  const b=beta*Math.PI/180,g=gamma*Math.PI/180,r=rotation*Math.PI/180;
  const gx=Math.cos(b)*Math.sin(g),gy=Math.sin(b),sx=gx*Math.cos(r)+gy*Math.sin(r),sy=-gx*Math.sin(r)+gy*Math.cos(r);
  if(Math.hypot(sx,sy)<.2)return null;
  return Math.atan2(sx,Math.abs(sy))*180/Math.PI;
}
