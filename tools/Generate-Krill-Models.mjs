import {writeFileSync} from 'node:fs';
import {brickModel} from './models/krill-bricks.mjs';
// Sculpted from the supplied front-view whale and orange krill references.
// Same solid primitive / articulated joint format as the BULL RUN characters.
const model=()=>({joints:[{id:'body',parent:null,pos:[0,0,0]}],parts:[]});
const joint=(m,id,parent,pos)=>m.joints.push({id,parent,pos});
const ell=(m,j,pos,size,color)=>m.parts.push({joint:j,shape:'ellipsoid',pos,size,color});
const box=(m,j,pos,size,color)=>m.parts.push({joint:j,shape:'box',pos,size,color});
const seg=(m,j,from,to,r0,r1,color)=>m.parts.push({joint:j,shape:'segment',from,to,r0,r1,color});
const whale=model(),krill=model();
// Blue whale anatomy: a long tapered body, broad U-shaped rostrum, small
// lateral eyes, slender pectoral fins, a rear dorsal fin and horizontal flukes.
whale.species='blue-whale';
whale.mouth={halfWidth:4.1,rimY:-.45,rimZ:.4,rimDepth:9.6,lowerY:.25,maxAngle:.72};
whale.rider=[0,3.5,-3];whale.reinAnchors=[[-4.3,-.7,1.2],[4.3,-.7,1.2]];
whale.cameraTarget=[0,0,-12];whale.cameraOffset=[-30,24,43];
const blue='#506a78',light='#607c89',dark='#263c48',belly='#a3b4b8';
const sections=[[-34,.5,-.3,.8],[-29,1.25,-.1,1.8],[-23,2.5,0,3.4],[-15,3.6,.2,4.7],[-8,4.6,.2,5.6],[-2,4.8,.2,5.4],[3,4.7,.25,3.8],[8,4.4,.1,2.2],[10.4,3.8,.05,1.5],[11.2,.15,0,.35]];
whale.parts.push({joint:'body',shape:'loft',sections,color:blue});
whale.parts.push({joint:'body',shape:'loft',sections:sections.map(([z,w,y,h])=>[z,w*.90,y-h*.28,h*.45]),color:belly});
whale.parts.push({joint:'body',shape:'ellipsoid',pos:[0,-1.6,6.7],size:[8.5,3.5,13],subtract:true});
// Upper mouth rim follows a broad U rather than a rounded cartoon muzzle.
for(let i=0;i<24;i++){
 const t=i*Math.PI/24,u=(i+1)*Math.PI/24;
 seg(whale,'body',[Math.cos(t)*4.2,-.4,.4+Math.sin(t)*9.6],[Math.cos(u)*4.2,-.4,.4+Math.sin(u)*9.6],.22,.22,dark);
 if(i>1&&i<22)box(whale,'body',[Math.cos(t)*3.9,-.85,.6+Math.sin(t)*8.9],[.23,.85,.32],'#242b2e');
}
box(whale,'body',[0,1.25,6],[.35,.3,7],light);
for(const side of [-1,1]){
 ell(whale,'body',[side*.45,2.9,-1],[.52,.18,1.1],dark);
 ell(whale,'body',[side*4.75,.08,.45],[.42,.42,.65],dark);
 box(whale,'body',[side*4.94,.08,.65],[.18,.24,.3],'#101c24');
 const fin=side<0?'finL':'finR';joint(whale,fin,'body',[side*4.2,-1,-2]);
 ell(whale,fin,[side*2,-.2,-2.5],[5.8,.6,3.2],blue);
 ell(whale,fin,[side*4.3,-.45,-4.9],[3.8,.36,1.65],light);
 ell(whale,fin,[side*2,-.45,-2.7],[5.2,.25,2.8],belly);
}
whale.parts.push({joint:'body',shape:'prism',axes:[2,1],points:[[-20.8,1.75],[-23,3.4],[-23.6,3.1],[-24.2,1.2]],thickness:.5,color:blue});
joint(whale,'tail','body',[0,-.3,-33]);
for(const side of [-1,1])whale.parts.push({joint:'tail',shape:'prism',axes:[0,2],points:[[0,1.4],[side*3.2,.1],[side*8,-2.5],[side*7.1,-4.3],[side*3.5,-3.3],[side*.35,-3.5]],thickness:.65,color:blue});
joint(whale,'jaw','body',[0,-.8,0]);
ell(whale,'jaw',[0,-.35,4.9],[8.9,1.5,12.2],blue);
ell(whale,'jaw',[0,-.5,5.3],[8.5,1.15,11.5],belly);
ell(whale,'jaw',[0,.25,5.2],[8,.35,10.6],'#273037');
ell(whale,'jaw',[0,.43,5.6],[5.5,.32,7.5],'#384046');
const orange='#f67845',shell='#ffac70',red='#b43b2b';
// Turn only the character toward +Z (the camera); keep labels facing the screen.
krill.joints[0].rotation=[0,Math.PI/2,0];
ell(krill,'body',[-.2,.06,0],[.8,.55,.58],orange);
ell(krill,'body',[-.31,.16,.015],[.57,.4,.56],shell);
seg(krill,'body',[-.5,.08,0],[-.72,-.05,.04],.11,.025,orange);
for(const side of [-1,1]){
  const z=side*.28;
  seg(krill,'body',[-.46,.13,z*.6],[-.54,.24,z],.028,.032,red);
  ell(krill,'body',[-.54,.26,z],[.18,.21,.17],'#22212d');
  box(krill,'body',[-.62,.30,z],[.025,.061,.052],'#ffe6b7');
  const antenna=side<0?'antennaL':'antennaR';joint(krill,antenna,'body',[-.5,.24,z*.7]);
  const points=[[0,0,0],[-.26,.18,side*.03],[-.44,.45,side*.055],[-.49,.73,side*.08]];
  for(let i=0;i<3;i++)seg(krill,antenna,points[i],points[i+1],.022-i*.004,.018-i*.004,i===2?shell:orange);
  const legs=side<0?'legsL':'legsR';joint(krill,legs,'body',[0,-.1,z*.7]);
  for(let i=0;i<5;i++){
    const x=-.38+i*.15;
    seg(krill,legs,[x,0,0],[x-.03,-.19,side*.08],.025,.018,orange);
    seg(krill,legs,[x-.03,-.19,side*.08],[x+.07,-.34,side*.10],.018,.009,shell);
  }
}
joint(krill,'tail','body',[.16,.02,0]);
for(let i=0;i<4;i++){
  const x=i*.145,y=.065-i*i*.029;
  ell(krill,'tail',[x,y,0],[.34-i*.036,.44-i*.045,.43-i*.045],red);
  ell(krill,'tail',[x-.016,y+.035,.014],[.28-i*.03,.39-i*.045,.44-i*.045],i%2?shell:orange);
}
for(const side of [-1,1])seg(krill,'tail',[.48,-.24,0],[.65,-.40,side*.15],.11,.025,shell);
const data={schema:3,reference:'Blue whale anatomy inspired by NOAA Fisheries; articulated brick surfaces',whale:brickModel(whale,.28),krill:brickModel(krill,.038)};
writeFileSync(new URL('../game/krill-models.json',import.meta.url),JSON.stringify(data)+'\n');
console.log('Created articulated brick models:',Object.fromEntries(['whale','krill'].map(k=>[k,data[k].parts.reduce((n,p)=>n+p.cells.length,0)+' surface cells'])));
