// Bake solid volumes into stepped, colored surfaces. Interior cube faces are
// removed; each animated joint becomes one mesh shared by all participants.
export function brickModel(model,cell){
 const result={...model,style:'brick',parts:[]};
 for(const joint of model.joints){
  const volume=new Map();
  for(const p of model.parts.filter(p=>p.joint===joint.id)){
   let min,max,inside;
   if(p.shape==='loft'){
    const sections=p.sections;min=[-Math.max(...sections.map(v=>v[1])),Math.min(...sections.map(v=>v[2]-v[3]/2)),sections[0][0]];max=[-min[0],Math.max(...sections.map(v=>v[2]+v[3]/2)),sections.at(-1)[0]];
    inside=q=>{const i=sections.findIndex(s=>s[0]>=q[2]);if(i<0)return false;const a=sections[Math.max(0,i-1)],b=sections[i],t=a===b?0:(q[2]-a[0])/(b[0]-a[0]),w=a[1]+(b[1]-a[1])*t,y=a[2]+(b[2]-a[2])*t,h=a[3]+(b[3]-a[3])*t;return (q[0]/w)**2+((q[1]-y)/(h/2))**2<=1;};
   }else if(p.shape==='prism'){
    const axes=p.axes,depth=[0,1,2].find(i=>!axes.includes(i));min=[0,0,0];max=[0,0,0];for(let i=0;i<2;i++){min[axes[i]]=Math.min(...p.points.map(v=>v[i]));max[axes[i]]=Math.max(...p.points.map(v=>v[i]));}min[depth]=-p.thickness/2;max[depth]=p.thickness/2;
    inside=q=>{if(Math.abs(q[depth])>p.thickness/2)return false;let yes=false;for(let i=0,j=p.points.length-1;i<p.points.length;j=i++){const a=p.points[i],b=p.points[j],u=q[axes[0]],v=q[axes[1]];if((a[1]>v)!==(b[1]>v)&&u<(b[0]-a[0])*(v-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
   }else if(p.shape==='segment'){
    const a=p.from,b=p.to,d=b.map((v,i)=>v-a[i]),len2=d.reduce((v,x)=>v+x*x,0),r=Math.max(p.r0,p.r1,cell*.65);
    min=a.map((v,i)=>Math.min(v,b[i])-r);max=a.map((v,i)=>Math.max(v,b[i])+r);
    inside=q=>{const t=Math.max(0,Math.min(1,q.reduce((s,v,i)=>s+(v-a[i])*d[i],0)/len2));return Math.hypot(...q.map((v,i)=>v-a[i]-d[i]*t))<=Math.max(cell*.65,p.r0+(p.r1-p.r0)*t);};
   }else{
    const half=p.size.map(v=>Math.max(v/2,cell*.55));min=p.pos.map((v,i)=>v-half[i]);max=p.pos.map((v,i)=>v+half[i]);
    inside=q=>p.shape==='box'?q.every((v,i)=>Math.abs(v-p.pos[i])<=half[i]):q.reduce((s,v,i)=>s+((v-p.pos[i])/half[i])**2,0)<=1;
   }
   for(let x=Math.ceil(min[0]/cell);x<=Math.floor(max[0]/cell);x++)for(let y=Math.ceil(min[1]/cell);y<=Math.floor(max[1]/cell);y++)for(let z=Math.ceil(min[2]/cell);z<=Math.floor(max[2]/cell);z++)if(inside([x*cell,y*cell,z*cell])){const key=`${x},${y},${z}`;if(p.subtract)volume.delete(key);else volume.set(key,p.color);}
  }
  const palette=[],indices=new Map(),cells=[],dirs=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  for(const [key,color]of volume){
   const xyz=key.split(',').map(Number);let mask=0;dirs.forEach((d,i)=>{if(!volume.has(xyz.map((v,k)=>v+d[k]).join(',')))mask|=1<<i;});if(!mask)continue;
   // Broad three-level color patches, rather than independent noisy voxels.
   const tile=xyz.map(v=>Math.floor(v/3)),level=((tile[0]*7+tile[1]*3+tile[2]*5)%3+3)%3,shade=[.96,1,1.035][level];
   let finish=shade;
   if(model.species==='blue-whale'){
    const [x,y,z]=xyz.map(v=>v*cell);
    if(joint.id==='body'&&['#506a78','#607c89'].includes(color))finish*=1+.045*(Math.sin(x*.8+z*.32)+Math.cos(z*.57-y*.7));
    if((joint.id==='jaw'&&y<-.45)||(joint.id==='body'&&y<-1.4&&z>-12&&z<1))if(Math.abs(x)<3.8&&Math.abs(x/.56-Math.round(x/.56))<.18)finish*=.83;
   }
   const rgb=color.slice(1).match(/../g).map(v=>Math.min(255,Math.round(parseInt(v,16)*finish))),tint='#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('');
   if(!indices.has(tint)){indices.set(tint,palette.length);palette.push(tint);}
   cells.push([...xyz,indices.get(tint),mask]);
  }
  if(cells.length)result.parts.push({shape:'voxel',joint:joint.id,cell,palette,cells});
 }
 return result;
}
