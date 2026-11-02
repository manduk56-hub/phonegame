// Shared by the server and the private/public renderers. Angles face +Z.
export const COMBAT={range:2.8,halfAngle:Math.PI/3,bodyRadius:.32,windup:.28,recovery:.24};
export function rayBox(a,b,o,padding=0){
 let lo=0,hi=1;
 for(const [key,size]of [['x','w'],['z','d']]){const delta=b[key]-a[key],min=o[key]-o[size]/2-padding,max=o[key]+o[size]/2+padding;if(Math.abs(delta)<1e-10){if(a[key]<min||a[key]>max)return null;}else{let t0=(min-a[key])/delta,t1=(max-a[key])/delta;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)return null;}}
 return lo;
}
export function lineClear(a,b,solids,padding=0){return !solids.some(o=>rayBox(a,b,o,padding)!==null);}
export function circleInSector(origin,target,yaw,range=COMBAT.range,halfAngle=COMBAT.halfAngle,radius=COMBAT.bodyRadius){
 const dx=target.x-origin.x,dz=target.z-origin.z,d=Math.hypot(dx,dz),angle=Math.abs(Math.atan2(Math.sin(Math.atan2(dx,dz)-yaw),Math.cos(Math.atan2(dx,dz)-yaw)));
 if(angle<=halfAngle)return d<=range+radius+1e-8;
 const a=yaw+(Math.atan2(Math.sin(Math.atan2(dx,dz)-yaw),Math.cos(Math.atan2(dx,dz)-yaw))<0?-halfAngle:halfAngle),ux=Math.sin(a),uz=Math.cos(a),t=Math.max(0,Math.min(range,dx*ux+dz*uz));
 return Math.hypot(dx-ux*t,dz-uz*t)<=radius+1e-8;
}
export function sectorPolygon(origin,yaw,solids=[],range=COMBAT.range,halfAngle=COMBAT.halfAngle){
 const points=[{x:origin.x,z:origin.z}];for(let i=0;i<=32;i++){const angle=yaw-halfAngle+2*halfAngle*i/32,end={x:origin.x+Math.sin(angle)*range,z:origin.z+Math.cos(angle)*range};let fraction=1;for(const o of solids){const t=rayBox(origin,end,o);if(t!==null)fraction=Math.min(fraction,Math.max(0,t-.008));}points.push({x:origin.x+(end.x-origin.x)*fraction,z:origin.z+(end.z-origin.z)*fraction});}return points;
}
