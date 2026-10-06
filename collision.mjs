import {readFileSync} from 'node:fs';
import {Box3,BoxGeometry,BufferGeometry,CylinderGeometry,Float32BufferAttribute,Group,Mesh} from 'three';

// Measure the same model geometry used by the PC and phone renderers once at startup.
const shapes=JSON.parse(readFileSync(new URL('./game/car-shapes.json',import.meta.url),'utf8'));
const carBounds=new Map();
for(const [id,shape] of Object.entries(shapes)){
  const root=new Group();
  for(const part of shape.parts){
    const mesh=new Mesh(new BoxGeometry(...part.size));
    mesh.position.set(...part.pos);mesh.rotation.set(...part.rot);root.add(mesh);
  }
  for(const part of shape.cylinders){
    const mesh=new Mesh(new CylinderGeometry(part.radius,part.radius,part.height,part.segments));
    mesh.position.set(...part.pos);
    if(part.axis==='x')mesh.rotation.z=Math.PI/2;
    else if(part.axis==='z')mesh.rotation.x=Math.PI/2+(part.tilt||0);
    root.add(mesh);
  }
  for(const part of shape.panels){
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute(part.points.flat(),3));
    root.add(new Mesh(geometry));
  }
  const bounds=new Box3().setFromObject(root);
  carBounds.set(id,{minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z});
  root.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});
}

function body(p,bounds,yaw=p.yaw){
  const right={x:Math.cos(yaw),z:-Math.sin(yaw)},forward={x:Math.sin(yaw),z:Math.cos(yaw)};
  const x=(bounds.minX+bounds.maxX)/2,z=(bounds.minZ+bounds.maxZ)/2;
  return {x:p.x+right.x*x+forward.x*z,z:p.z+right.z*x+forward.z*z,right,forward,
    halfX:(bounds.maxX-bounds.minX)/2,halfZ:(bounds.maxZ-bounds.minZ)/2};
}
export const raceBody=p=>body(p,carBounds.get(p.car)||carBounds.get('gt'));
export function excavatorBodies(p){
  // Tracks including end treads; upper body includes the cab and rear counterweight.
  return [body(p,{minX:-.97,maxX:.97,minZ:-1.23,maxZ:1.23}),
    body(p,{minX:-.82,maxX:.8,minZ:-1.13,maxZ:.6},p.yaw+(p.turret||0))];
}
const dot=(a,b)=>a.x*b.x+a.z*b.z;
export const bodyRadius=(box,axis)=>box.halfX*Math.abs(dot(box.right,axis))+box.halfZ*Math.abs(dot(box.forward,axis));
export function bodyContact(a,b){
  const delta={x:a.x-b.x,z:a.z-b.z};
  let depth=Infinity,normal;
  // Separating axis test: long ends and rotated corners participate in contact.
  for(const axis of [a.right,a.forward,b.right,b.forward]){
    const offset=dot(delta,axis),overlap=bodyRadius(a,axis)+bodyRadius(b,axis)-Math.abs(offset);
    if(overlap<=1e-8)return null;
    if(overlap<depth){depth=overlap;const sign=offset<0?-1:1;normal={x:axis.x*sign,z:axis.z*sign};}
  }
  return {depth,...normal};
}
export function excavatorOverlap(p,q){
  let depth=0;
  for(const a of excavatorBodies(p))for(const b of excavatorBodies(q))depth=Math.max(depth,bodyContact(a,b)?.depth||0);
  return depth;
}
