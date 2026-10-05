import fs from 'node:fs';
const materials={concrete:['#d8cbb3',9],footing:['#b5aa99',8],cap:['#ede0c6',6],ground:['#efd09a',10],olive:['#2764bd',9],armor:['#343b50',8],metal:['#30313e',7],steel:['#66697b',7],wood:['#b78346',13],woodDark:['#79522f',9],glove:['#ffc37b',6],visor:['#ffffff',2],black:['#191c29',3],cloth:['#ffc37b',5],team:['#ffffff',0],blue:['#2866ce',5],red:['#d84238',5],white:['#fff3d8',3],hair:['#49302a',4]};
const textures={};let seed=417;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(const [name,[hex,noise]] of Object.entries(materials)){const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),pixels=[];for(let y=0;y<32;y++)for(let x=0;x<32;x++){let n=Math.floor((rand()-.5)*noise*2);if(rand()<.055)n-=noise*2;if(name==='wood'||name==='woodDark'){n+=(x%8===0?-24:0)+(y%5===0?5:0);}if(name==='concrete'&&y<8&&rand()<.12)n-=28;if(name==='olive'&&Math.floor(x/5)%2===Math.floor(y/6)%2)n-=9;pixels.push(...c.map(v=>Math.max(0,Math.min(255,v+n))),255);}textures[name]={size:32,pixels};}
const box=(size,pos,mat,rot=[0,0,0])=>({size,pos,mat,rot});
const actor=[],rifle=[],world=[];
const a=(s,p,m,r)=>actor.push(box(s,p,m,r));const g=(s,p,m,r)=>rifle.push(box(s,p,m,r));const w=(s,p,m,r)=>world.push(box(s,p,m,r));
a([.53,.58,.34],[0,1.14,0],'olive');a([.57,.43,.38],[0,1.2,.015],'armor');a([.47,.25,.10],[0,1.15,.24],'armor');a([.10,.4,.03],[-.22,1.2,.22],'steel');a([.10,.4,.03],[.22,1.2,.22],'steel');
for(const x of [-.16,0,.16])a([.13,.18,.1],[x,1.12,.29],'armor');a([.53,.10,.4],[0,.91,0],'black');a([.1,.1,.03],[0,.91,.22],'steel');
for(const side of [-1,1]){const x=side*.15;a([.23,.44,.28],[x,.64,0],'olive');a([.2,.3,.23],[x,.27,0],'olive');a([.25,.17,.35],[x,.09,.065],'glove');a([.22,.19,.06],[x,.47,.17],'armor');a([.18,.22,.3],[side*.3,1.32,0],'olive');a([.185,.085,.31],[side*.3,1.36,0],'team');a([.16,.3,.21],[side*.31,1.09,.08],'olive',[side*-.3,0,0]);a([.17,.14,.19],[side*.28,.98,.24],'glove');}
a([.24,.16,.24],[0,1.49,0],'cloth');a([.4,.29,.38],[0,1.64,0],'cloth');a([.43,.17,.09],[0,1.59,.205],'glove');a([.38,.12,.04],[0,1.71,.222],'visor');a([.46,.19,.43],[0,1.81,0],'olive');a([.51,.06,.46],[0,1.72,.015],'olive');a([.22,.035,.44],[0,1.91,0],'olive');a([.44,.04,.06],[0,1.74,.245],'black');a([.43,.4,.14],[0,1.18,-.24],'olive');
// Chunky cap, team jacket, bare hands and white sneakers from the reference.
actor.length=0;
a([.58,.56,.36],[0,1.12,0],'team');a([.16,.5,.04],[0,1.12,.2],'white');
a([.5,.1,.4],[0,.86,0],'black');a([.38,.4,.22],[0,1.1,-.28],'armor');
for(const side of [-1,1]){a([.22,.43,.28],[side*.16,.60,0],'team');a([.21,.30,.27],[side*.16,.26,0],'armor');a([.26,.17,.42],[side*.16,.10,.07],'white');a([.27,.05,.43],[side*.16,.03,.07],'black');a([.2,.28,.29],[side*.36,1.22,0],'team');a([.2,.11,.3],[side*.36,1.06,.08],'white');a([.17,.18,.21],[side*.32,.98,.24],'cloth');}
a([.44,.38,.4],[0,1.59,0],'cloth');a([.48,.12,.43],[0,1.82,0],'team');a([.52,.06,.58],[0,1.74,.10],'team');a([.18,.12,.025],[0,1.82,.228],'white');
for(const x of [-.105,.105]){a([.055,.1,.025],[x,1.6,.215],'black');a([.11,.11,.06],[x,1.72,.21],'hair');}
a([.09,.045,.028],[0,1.46,.215],'hair');
g([.105,.16,.38],[0,0,0],'metal');g([.08,.08,.42],[0,.11,.03],'black');g([.12,.03,.24],[0,.17,-.08],'steel');g([.045,.085,.045],[0,.21,-.13],'black');g([.065,.075,.065],[0,.145,.48],'black');g([.1,.11,.25],[0,0,.3],'metal');g([.045,.045,.24],[0,0,.53],'steel');g([.075,.065,.1],[0,0,.69],'metal');g([.07,.075,.2],[0,-.005,-.29],'steel');g([.09,.17,.08],[0,-.04,-.42],'metal');g([.09,.23,.15],[0,-.18,.035],'metal',[.17,0,0]);g([.075,.17,.08],[0,-.17,-.12],'glove',[-.3,0,0]);g([.11,.035,.11],[0,-.105,-.065],'steel');g([.02,.045,.06],[.065,.02,-.06],'steel');
for(let i=0;i<9;i++)g([.115,.022,.019],[0,.068,.20+i*.023],'steel');for(let i=0;i<5;i++)g([.115,.032,.02],[0,.145,-.16+i*.065],'metal');
const arena=JSON.parse(fs.readFileSync(new URL('../game/fps-arena.json',import.meta.url),'utf8'));
for(const [idx,wall] of arena.walls.entries()){
 const alongX=wall.w>=wall.d,length=alongX?wall.w:wall.d,step=2,count=Math.ceil(length/step);
 for(let i=0;i<count;i++){const span=Math.min(step,length-i*step),offset=-length/2+i*step+span/2,x=wall.x+(alongX?offset:0),z=wall.z+(alongX?0:offset),width=alongX?span:wall.w,depth=alongX?wall.d:span;
 w([width,wall.h,depth],[x,wall.h/2,z],idx===6||idx===7?'wood':'concrete');w([width,.65,depth+.01],[x,.325,z],'footing');w([width,.16,depth],[x,wall.h-.08,z],'cap');
 if(i%3===0){w([alongX?.16:width,.12,alongX?depth:.16],[x,wall.h-1.05,z],'footing');}
 }
 if(idx!==6&&idx!==7){const stripe=idx%2?'blue':'red';w([wall.w,.38,wall.d+.025],[wall.x,wall.h-.5,wall.z],stripe);}
}
// Crates live inside the existing cover volumes, preserving bullet and walking occlusion.
for(const side of [-1,1])for(let row=0;row<2;row++)for(let col=0;col<3;col++){const x=side*20,z=(col-1)*2.65,y=.75+row*1.5;
 w([2.02,1.45,2.6],[x,y,z],'wood');for(const sx of [-1.01,1.01])w([.12,1.5,2.65],[x+sx,y,z],'woodDark');for(const sy of [-.66,.66])w([2.06,.12,2.66],[x,y+sy,z],'woodDark');for(const sz of [-1.32,1.32])w([1.8,.13,.035],[x,y,z+sz],'woodDark',[0,0,.58]);}
// Background towers sit behind the perimeter's solid collision boundary.
// Sandstone silhouettes and opposing flag towers stay outside playable cover.
for(const [x,z,h] of [[-28,-39,8],[-17,-41,10],[0,-40,7],[17,-41,10],[28,-39,8]]){
 w([8,h,6],[x,h/2,z],'concrete');w([8.1,.6,6.1],[x,h-1,z],x<0?'red':'blue');w([8.3,.25,6.3],[x,h,z],'cap');
 for(const dx of [-3,0,3])w([1.5,.9,6],[x+dx,h+.45,z],'cap');
 if(Math.abs(x)===17){const team=x<0?'red':'blue';w([3,3,.13],[x,h-2,z+3.1],team);w([.25,1.5,.15],[x-.5,h-2,z+3.2],'white');w([1,.65,.15],[x-.1,h-1.7,z+3.2],'white');w([.15,4,.15],[x,h+2,z],'woodDark');w([2.7,1.4,.15],[x+1.4,h+3,z],team);w([.35,1.4,.17],[x+.25,h+3,z],'white');}
}
for(const [x,z]of [[-32,-26],[32,26]]){for(const dx of [-1.1,1.1])for(const dz of [-1.1,1.1])w([.2,6,.2],[x+dx,3,z+dz],'olive');w([3,.25,3],[x,4.2,z],'woodDark');w([3.5,.22,3.5],[x,6.3,z],'olive');for(const side of [-1,1]){w([3,.7,.13],[x,4.6,z+side*1.4],'olive');w([.13,.7,3],[x+side*1.4,4.6,z],'olive');w([.15,2.1,.15],[x+side*1.35,5.25,z-1.35],'olive');w([.15,2.1,.15],[x+side*1.35,5.25,z+1.35],'olive');}}
fs.writeFileSync(new URL('../game/fps-art.json',import.meta.url),JSON.stringify({textures,actor,rifle,world}));
console.log('FPS art:',actor.length,'soldier parts,',rifle.length,'rifle parts,',world.length,'scenery parts');
