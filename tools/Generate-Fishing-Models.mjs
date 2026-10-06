import {writeFileSync} from 'node:fs';
// Shared block meshes for Godot and Three.js; +Z is the angler's cast direction.
const actor=[],rod=[],boat=[];
const box=(parts,size,pos,color,name='',rotation=[0,0,0])=>parts.push({size,pos,color,name,rotation});
const skin='#ffa968',hair='#48271e',hat='#e9ba70',ink='#30241e',vest='#66753b';
for(const x of [-.23,.23]){
 box(actor,[.37,.64,.38],[x,.65,0],'#175bc2');box(actor,[.4,.14,.4],[x,.31,0],'#15488f');
 box(actor,[.46,.23,.65],[x,.16,.13],'#795039');box(actor,[.49,.08,.68],[x,.045,.13],ink);
 box(actor,[.25,.44,.06],[x-.06,.69,.21],'#2475dd');
}
box(actor,[.91,.67,.53],[0,1.28,0],'#f0e7ce');
box(actor,[.3,.73,.64],[-.32,1.28,.02],vest);box(actor,[.3,.73,.64],[.32,1.28,.02],vest);
box(actor,[.64,.6,.12],[0,1.3,-.3],'#4d5f2f');
for(const x of [-.32,.32]){box(actor,[.24,.24,.09],[x,1.12,.38],'#889046');box(actor,[.26,.055,.12],[x,1.24,.4],'#b5aa60');}
box(actor,[.28,.18,.32],[0,1.69,0],skin);
box(actor,[.65,.57,.58],[0,1.99,0],skin);box(actor,[.74,.4,.55],[0,2.1,-.09],hair);
box(actor,[.17,.24,.17],[-.39,1.96,0],skin);box(actor,[.17,.24,.17],[.39,1.96,0],skin);
box(actor,[.56,.44,.1],[0,1.99,.30],skin);box(actor,[.14,.15,.14],[0,1.99,.36],'#f48b4d');
for(const x of [-.18,.18]){box(actor,[.19,.23,.05],[x,2.10,.36],'#fff8e5');box(actor,[.075,.17,.06],[x,2.10,.395],ink);box(actor,[.23,.05,.07],[x,2.26,.36],hair);}
box(actor,[.24,.045,.04],[0,1.83,.36],ink);
box(actor,[1.15,.14,.91],[0,2.36,.10],hat);box(actor,[.92,.13,.76],[0,2.46,.02],'#deb063');
box(actor,[.76,.24,.65],[0,2.61,0],hat);box(actor,[.77,.07,.66],[0,2.52,0],'#987244');box(actor,[.57,.08,.52],[0,2.76,0],'#f3ce8a');
for(const x of [-.59,.59]){
 box(actor,[.29,.32,.35],[x,1.4,.03],'#fff3d6');box(actor,[.27,.23,.6],[x,1.19,.27],skin);
 box(actor,[.29,.25,.24],[x*.65,1.15,.62],skin);
}
box(actor,[.15,.15,.47],[.19,1.09,.51],'@color','Scarf');
// Sloping shaft, segmented taper, cork grip, silver line guides and mechanical reel.
box(rod,[.17,.18,.72],[0,0,.18],'#c39353');box(rod,[.19,.2,.13],[0,0,.45],ink);
for(let i=0;i<12;i++){
 const t=i/12;box(rod,[.10-t*.06,.10-t*.06,.27],[0,.14+i*.11,.68+i*.24],i%2?'#614536':'#302723','',[-.43,0,0]);
 if(i%3===0)box(rod,[.19,.13,.04],[0,.05+i*.11,.72+i*.24],'#d7e2e9');
}
box(rod,[.28,.33,.29],[.17,-.23,.28],'#9aafbd');box(rod,[.34,.16,.34],[.17,-.25,.28],'#d7e0e5');
box(rod,[.08,.3,.07],[.38,-.24,.29],ink);box(rod,[.23,.10,.12],[.44,-.37,.29],'#c99a52');
// Image order: orange goldfish, golden carp, green bass, striped mackerel,
// red sea bream, blue tuna, flat brown flounder, curved dark eel.
const species=[
 {id:'goldfish',name:'금붕어',body:'#f79421',back:'#f56b16',belly:'#ffe9af',fin:'#ff7e1d',length:2.3,height:1.22,width:.87},
 {id:'carp',name:'잉어',body:'#b88532',back:'#927029',belly:'#ead08c',fin:'#c99b46',length:2.8,height:1.3,width:.88},
 {id:'bass',name:'배스',body:'#71873c',back:'#405b2b',belly:'#e6dfb1',fin:'#5b7237',length:3,height:1.14,width:.88},
 {id:'mackerel',name:'고등어',body:'#91b2d0',back:'#305576',belly:'#e4eaf0',fin:'#3c5976',length:3.25,height:.95,width:.74},
 {id:'bream',name:'도미',body:'#eb7359',back:'#cf4e3c',belly:'#ffe0c4',fin:'#df654a',length:2.8,height:1.46,width:.82},
 {id:'tuna',name:'참치',body:'#577da3',back:'#234266',belly:'#d9e2eb',fin:'#2c4c70',length:3.7,height:1.16,width:.94},
 {id:'flounder',name:'넙치',body:'#927345',back:'#6e5634',belly:'#cbb072',fin:'#c39a55',length:2.9,height:.34,width:1.76},
 {id:'eel',name:'장어',body:'#476267',back:'#253f45',belly:'#a6bcbd',fin:'#34545b',length:4.6,height:.56,width:.56}
];
function buildFish(s){
 const parts=[],L=s.length,H=s.height,W=s.width;
 if(s.id==='eel'){
  // Curved segmented body with a continuous pale belly and tapering tail.
  for(let i=0;i<22;i++){const t=i/21,z=L*.45-t*L,x=t<.43?0:Math.pow((t-.43)/.57,2)*1.55,thick=1-t*.75;
   box(parts,[W*thick,H*thick,.25],[x,0,z],i%3?s.body:s.back);
   box(parts,[W*thick*.85,H*thick*.2,.26],[x,-H*thick*.43,z],s.belly);
   box(parts,[W*thick*.45,H*thick*.12,.27],[x,H*thick*.5,z],s.fin);
  }
 }else{
  for(let i=0;i<15;i++){const t=i/14,z=L*.40-t*L*.78,shape=Math.sqrt(Math.max(.06,1-Math.pow((t-.43)/.61,2))),w=W*shape,h=H*shape;
   box(parts,[w,h*.62,L*.058],[0,h*.06,z],s.body);
   box(parts,[w*.87,h*.26,L*.058],[0,h*.43,z],s.back);
   box(parts,[w*.87,h*.24,L*.058],[0,-h*.37,z],s.belly);
   if(i>3&&i<12){
    const rise=(s.id==='goldfish'||s.id==='bream'?.32:.23)*Math.sin((i-3)/9*Math.PI);
    box(parts,[.12,rise,L*.061],[0,h*.58+rise/2,z],s.fin);
    if(s.id==='flounder')for(const sign of [-1,1])box(parts,[.2,.07,L*.061],[sign*(w/2+.06),0,z],s.fin);
   }
   if(s.id==='mackerel'&&i>2&&i<13)for(const sign of [-1,1])box(parts,[.035,h*.37,.075],[sign*(w/2+.004),h*.27,z],s.back,'',[.24,0,sign*.2]);
   if((s.id==='carp'||s.id==='flounder')&&i>2&&i<12)for(const sign of [-1,1])box(parts,[.03,.065,.09],[sign*(w/2+.014),(i%3-1)*h*.16,z],i%2?'#dfb866':'#9d7437');
   if(s.id==='bass'&&i>3&&i<13)for(const sign of [-1,1])box(parts,[.025,.20,L*.07],[sign*(w/2+.008),0,z],s.back);
  }
  // Forked tail remains recognizable from above and from the side.
  const z=-L*.48;
  box(parts,[W*.35,H*.35,.26],[0,0,z],s.fin);
  for(const sign of [-1,1]){
   box(parts,[W*.16,H*.34,.38],[sign*W*.12,sign*H*.24,z-.22],s.fin,'',[sign*.5,0,0]);
   box(parts,[W*.14,H*.24,.30],[sign*W*.23,sign*H*.38,z-.42],s.back,'',[sign*.6,0,0]);
   box(parts,[W*.55,.09,.35],[sign*W*.62,-H*.04,L*.02],s.fin,'',[0,sign*.55,sign*.10]);
   box(parts,[.13,H*.27,.28],[sign*.18,-H*.54,-L*.18],s.fin);
  }
  if(s.id==='tuna')for(let i=0;i<5;i++)box(parts,[.08,.1,.12],[0,H*.25,-L*.24-i*.13],'#e5bc4d');
  if(s.id==='carp')for(const sign of [-1,1])box(parts,[.035,.24,.035],[sign*.18,-H*.25,L*.46],'#d9b574');
 }
 const headZ=L*.32;
 if(s.id==='flounder'){
  for(const x of [-.32,.27]){box(parts,[.26,.08,.26],[x,H*.62,headZ],'#f1ede0');box(parts,[.13,.09,.14],[x,H*.65,headZ+.02],ink);}
  for(let i=0;i<18;i++){const a=i*2.399;box(parts,[.09,.025,.09],[Math.sin(a)*W*.30,H*.61,Math.cos(a)*L*.24],'#d0ad6c');}
 }else{
  for(const sign of [-1,1]){box(parts,[.06,.25,.27],[sign*W*.42,H*.18,headZ],'#fff4dc');box(parts,[.075,.15,.15],[sign*W*.455,H*.18,headZ+.04],ink);
   box(parts,[.03,H*.54,.055],[sign*W*.51,0,headZ-.27],s.back);}
 }
 box(parts,[W*.53,.055,.06],[0,-H*.1,L*.43],ink);
 if(s.id==='bass'){
  box(parts,[W*.58,.28,.19],[0,-H*.03,L*.46],ink);box(parts,[W*.72,.09,.24],[0,-H*.23,L*.46],s.belly);
 }
 return parts;
}
const fishModels=Object.fromEntries(species.map(s=>[s.id,buildFish(s)]));
// An open boat with a pointed bow, squared stern, ivory walls and a blue hull stripe.
const widths=[[-8.6,11.5],[-6.5,13],[2,13],[5,11.7],[7.7,8],[9.5,4.4],[11,.45]];
const widthAt=z=>{const j=widths.findIndex(v=>v[0]>=z);if(j<=0)return widths[0][1];const a=widths[j-1],b=widths[j];return a[1]+(b[1]-a[1])*(z-a[0])/(b[0]-a[0]);};
for(let i=0;i<33;i++){
 const z=-8.3+i*.59,w=widthAt(z);
 box(boat,[w*.76,.42,.60],[0,.1,z],'#435661');
 box(boat,[w,.50,.60],[0,.39,z],'#e7dab7');
 box(boat,[Math.max(.2,w-.83),.18,.58],[0,.83,z],i%3?'#bc894b':'#c79855');
 for(const sign of [-1,1]){
  box(boat,[.48,.39,.62],[sign*(w/2-.12),.62,z],'#2d7098');
  box(boat,[.43,.64,.62],[sign*(w/2-.10),1.09,z],'#e8dcc0');
  box(boat,[.65,.16,.63],[sign*(w/2-.10),1.47,z],'#fff0ce');
  box(boat,[.11,.53,.23],[sign*(w/2-.4),1.1,z],'#c8b998');
 }
}
// Transom and two wooden bench seats.
box(boat,[11.9,.85,.55],[0,1.04,-8.58],'#eee1bf');box(boat,[12.1,.17,.7],[0,1.48,-8.55],'#fff0ce');
box(boat,[12,.33,.56],[0,.59,-8.62],'#2f779e');
for(const z of [-3.7,3.4]){
 box(boat,[9.3,.20,1.25],[0,1.5,z],'#b07a3e');
 box(boat,[9.4,.09,.16],[0,1.64,z+.5],'#e3ad60');
 for(const x of [-3.6,3.6])box(boat,[.26,.62,.83],[x,1.14,z],'#624326');
}
box(boat,[1.8,.45,1.2],[2.2,1.06,-6.45],'#536732');box(boat,[1.9,.13,1.25],[2.2,1.34,-6.45],'#879650');
box(boat,[.28,.40,.22],[2.2,1.2,-5.77],'#7c8d9e');
// Rounded step silhouette for the dark outboard cowling, silver trim, red badge and tiller.
box(boat,[1.15,1.1,.65],[0,1.32,-9.08],'#263749');
box(boat,[1.9,1.25,1.25],[0,2.09,-9.12],'#303d50');
box(boat,[1.56,.37,1.04],[0,2.88,-9.12],'#5a667a');
box(boat,[1.12,.16,.83],[0,3.14,-9.12],'#657186');
box(boat,[.15,1.35,1.27],[.74,2.17,-9.12],'#929ba9');
box(boat,[.55,.13,.05],[.45,2.08,-8.46],'#ed5840');
box(boat,[.28,.3,2.0],[.38,1.49,-8.39],'#28313c');
box(boat,[.42,1.74,.43],[0,.18,-9.25],'#4c5e70');
box(boat,[1.55,.16,.27],[0,-.54,-9.4],'#8795a0');
box(boat,[.28,.76,.13],[0,-.54,-9.4],'#8795a0');
box(boat,[.60,.14,.31],[0,1.07,9.47],'#3c4b51');
const seatingPath=[[0,9.05],[2.4,7.9],[4.6,4.7],[5.25,.8],[5.25,-6.75],[4.4,-7.15],[-4.4,-7.15],[-5.25,-6.75],[-5.25,.8],[-4.6,4.7],[-2.4,7.9]];
writeFileSync(new URL('../game/fishing-models.json',import.meta.url),JSON.stringify({actor,rod,boat,seatingPath,species,fishModels,fish:fishModels.goldfish}));
console.log(`Fishing meshes: ${actor.length} angler, ${rod.length} rod, ${boat.length} boat, ${species.length} fish species`);
