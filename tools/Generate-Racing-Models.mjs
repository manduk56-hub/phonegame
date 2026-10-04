// Editable geometry definitions shared by the native and browser renderers.
// +Z is the nose. Each car is authored separately in reference order 1–6.
import fs from 'node:fs';
import {authorWedge} from './models/wedge.mjs';
import {detailCar} from './models/detail.mjs';
const file=new URL('../game/car-shapes.json',import.meta.url);
const models=JSON.parse(fs.readFileSync(file,'utf8'));
const number=Number(process.argv[2]||1);
let m;
const panel=(points,color='paint')=>m.panels.push({points,color});
const box=(size,pos,color='paint',rot=[0,0,0])=>m.parts.push({size,pos,color,rot});
const cylinder=(radius,height,pos,color,axis='x',segments=20)=>m.cylinders.push({radius,height,pos,color,axis,segments});
function line(a,b,width,color){
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dx,dy,dz);
  box([width,width,len],a.map((v,i)=>(v+b[i])/2),color,[-Math.asin(dy/len),Math.atan2(dx,dz),0]);
}
function mirror(points,color='paint'){for(const s of [-1,1])panel(points.map(([x,y,z])=>[s*x,y,z]),color);}
function loft(sections,color='paint',arches=false){
  const rings=sections.map(([z,w,b,t])=>{
    if(arches)for(const axle of m.axles){const dz=Math.abs(z-axle);if(dz<.49)b=Math.max(b,.43+Math.sqrt(.49**2-dz**2));}
    return [[-.91*w,b,z],[-w,b+.015,z],[-w,Math.max(b+.02,t-.06),z],[-.90*w,t,z],[.90*w,t,z],[w,Math.max(b+.02,t-.06),z],[w,b+.015,z],[.91*w,b,z]];
  });
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++)panel([rings[j][i],rings[j+1][i],rings[j+1][(i+1)%8],rings[j][(i+1)%8]],color);
  panel(rings[0],color);panel(rings.at(-1),color);
}
function body(stations){
  const zs=new Set(stations.map(s=>s[0]));for(const a of m.axles)for(const d of [-.51,-.47,-.38,-.25,0,.25,.38,.47,.51])zs.add(a+d);
  const sections=[...zs].sort((a,b)=>a-b).filter(z=>z>=stations[0][0]&&z<=stations.at(-1)[0]).map(z=>{
    let i=stations.findIndex(s=>s[0]>=z);if(i===0)return stations[0];if(i<0)i=stations.length-1;
    const a=stations[i-1],b=stations[i],t=(z-a[0])/(b[0]-a[0]);return [z,...a.slice(1).map((v,k)=>v+(b[k+1]-v)*t)];
  });loft(sections,'paint',true);m.body=stations;m.bodyPanelCount=m.panels.length;
}
function hoodStripe(x0,x1,from,to,color){
  const height=z=>{const i=m.body.findIndex(p=>p[0]>=z);if(i===0)return m.body[0][3];const a=m.body[i-1],b=m.body[i];return a[3]+(b[3]-a[3])*(z-a[0])/(b[0]-a[0]);};
  const zs=[from,...m.body.map(p=>p[0]).filter(z=>z>from&&z<to),to];
  for(let i=0;i<zs.length-1;i++){const a=zs[i],b=zs[i+1];panel([[x0,height(a)+.013,a],[x1,height(a)+.013,a],[x1,height(b)+.013,b],[x0,height(b)+.013,b]],color);}
}
function bodyAt(z,index){const i=m.body.findIndex(p=>p[0]>=z);if(i===0)return m.body[0][index];const a=m.body[i-1],b=m.body[i];return a[index]+(b[index]-a[index])*(z-a[0])/(b[0]-a[0]);}
function onHood(points,color,offset=.02){
  const clip=(points,z,above)=>{
    const out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],ai=above?a[1]>=z:a[1]<=z,bi=above?b[1]>=z:b[1]<=z;if(ai)out.push(a);if(ai!==bi){const t=(z-a[1])/(b[1]-a[1]);out.push([a[0]+(b[0]-a[0])*t,z]);}}return out;
  };
  for(let i=0;i<m.body.length-1;i++){let piece=clip(points,m.body[i][0],true);piece=clip(piece,m.body[i+1][0],false);if(piece.length<3)continue;for(const s of [-1,1])panel(piece.map(([x,z])=>[s*x,bodyAt(z,3)+offset,z]),color);}
}
function onSide(points,color){for(const s of [-1,1])panel(points.map(([y,z])=>[s*(bodyAt(z,1)+.018),y,z]),color);}
function cabin(sections){loft(sections,'paint');m.cabin=sections;}
function wheels(spokes=10,caliper='#c54938'){
  for(const s of [-1,1])for(const z of m.axles){
    cylinder(.43,.26,[s*1.01,.43,z],'#171b20');
    cylinder(.335,.275,[s*1.015,.43,z],'#3e4851');
    cylinder(.305,.285,[s*1.02,.43,z],'#252b30');
    box([.02,.25,.09],[s*1.17,.43,z+.20],caliper);
    for(let i=0;i<spokes;i++){const a=i*Math.PI*2/spokes;box([.025,.26,.036],[s*1.177,.43+Math.cos(a)*.16,z+Math.sin(a)*.16],'#56616d',[a,0,0]);}
    cylinder(.077,.315,[s*1.025,.43,z],'#343b42', 'x',12);
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;cylinder(.011,.321,[s*1.025,.43+Math.cos(a)*.047,z+Math.sin(a)*.047],'#a2adb5','x',6);}
  }
}
if(number===2){
  begin('classic',[-1.28,1.26],4.12);
  body([[-2.06,.82,.29,.66],[-1.77,.98,.28,.86],[-1.27,1.02,.28,1.0],[-.72,.95,.28,.91],[.0,.90,.28,.84],[.77,.92,.28,.87],[1.26,.99,.28,1.0],[1.65,.91,.30,.92],[1.91,.80,.32,.73],[2.06,.75,.33,.58]]);
  cabin([[-1.49,.72,.90,.96],[-1.03,.67,.90,1.30],[-.65,.63,.89,1.48],[-.12,.63,.86,1.50],[.30,.65,.86,1.39],[.95,.76,.84,.90]]);
  windshield([.94,.718,.923],[.30,.60,1.417]);
  sideWindow([[.762,.91,.87],[.738,.96,-1.35],[.638,1.44,-.63],[.628,1.45,-.15],[.652,1.355,.28]]);
  for(const s of [-1,1]){
    line([s*.683,.95,-.40],[s*.643,1.445,-.38],.053,'paint');
    panel([[s*.39,.80,1.0],[s*.35,.645,1.91],[s*.65,.74,1.80],[s*.85,.97,1.28],[s*.80,.88,.97]]);
    cylinder(.205,.07,[s*.66,.89,1.88],'#273037','z',16);m.cylinders.at(-1).tilt=-.45;
    cylinder(.149,.075,[s*.66,.912,1.923],'#f3ecd0','z',16);m.cylinders.at(-1).tilt=-.45;
    cylinder(.108,.08,[s*.66,.921,1.946],'#f8f6e2','z',12);m.cylinders.at(-1).tilt=-.45;
    box([.32,.085,.06],[s*.62,.48,2.047],'#262c2e');box([.10,.075,.069],[s*.755,.48,2.05],'#b0772c');
    box([.30,.08,.06],[s*.61,.32,2.06],'#192329');
    box([.085,.10,1.54],[s*.94,.30,-.03]);
    box([.13,.22,.16],[s*.59,1.06,-1.75],'#31383a');
    box([.16,.026,.035],[s*.909,.88,-.22],'#383f43');
    box([.18,.10,.16],[s*.48,.29,-2.04],'#22282d');
  }
  panel([[-.48,.32,2.085],[.48,.32,2.085],[.53,.48,2.06],[-.53,.48,2.06]],'#20282b');
  box([1.53,.045,.12],[0,.265,2.045],'#3b4141');
  box([1.79,.085,.30],[0,1.19,-1.76]);
  for(let i=0;i<7;i++)box([1.20,.022,.045],[0,1.01-i*.035,-1.13-i*.1],'#444b48');
  rearLights(-2.075,.68,.41);doorSeam([[.949,.84,.77],[.951,.34,.64],[.946,.33,-.60],[.947,.87,-.73]]);
  mirrorStalk(.98,.98,.58);hoodBadge(.756,1.78,'#a2873f');wheels(10);save();
}
if(number===3){
  begin('tourer',[-1.42,1.38],4.65);
  body([[-2.33,.84,.28,.73],[-1.85,.99,.27,.88],[-1.42,1.02,.27,1.0],[-.85,.96,.26,.91],[.10,.93,.26,.89],[.83,.96,.27,.90],[1.38,1.01,.27,1.01],[1.84,.98,.29,.86],[2.13,.91,.31,.70],[2.33,.84,.33,.61]]);
  cabin([[-1.64,.73,.88,.95],[-1.15,.67,.91,1.31],[-.85,.64,.93,1.44],[-.30,.63,.91,1.44],[.06,.67,.89,1.29],[.61,.77,.86,.91]]);
  windshield([.60,.726,.94],[.055,.60,1.322]);
  sideWindow([[.777,.937,.52],[.740,.956,-1.47],[.65,1.389,-.93],[.642,1.389,-.32],[.67,1.27,.025]]);
  for(const s of [-1,1]){
    line([s*.694,.967,-.54],[s*.652,1.385,-.54],.053,'paint');
    panel([[s*.41,.68,2.33],[s*.88,.73,2.09],[s*.89,.91,1.69],[s*.49,.84,1.88]],'#16252e');
    line([s*.52,.755,2.15],[s*.81,.845,1.92],.063,'#f2f3df');
    line([s*.49,.743,2.20],[s*.86,.823,2.0],.031,'#c7d8dc');
    box([.063,.15,.055],[s*.947,.82,.77],'#202a31');box([.063,.15,.055],[s*.945,.82,.62],'#202a31');box([.063,.15,.055],[s*.943,.82,.47],'#202a31');
    panel([[s*.60,.40,2.35],[s*.88,.44,2.27],[s*.94,.62,2.19],[s*.68,.62,2.31]],'#172127');
    box([.075,.06,1.7],[s*.96,.29,-.05],'#242f37');
    box([.17,.028,.039],[s*.94,.875,-.30],'#2d3841');
    line([s*.38,.91,.76],[s*.39,.705,2.16],.016,'#3a4652');
    box([.21,.10,.20],[s*.62,.29,-2.33],'#343b40');
  }
  panel([[-.59,.40,2.37],[.59,.40,2.37],[.64,.61,2.34],[.47,.71,2.30],[-.47,.71,2.30],[-.64,.61,2.34]],'#98a3a9');
  panel([[-.55,.425,2.384],[.55,.425,2.384],[.598,.60,2.359],[.46,.672,2.333],[-.46,.672,2.333],[-.598,.60,2.359]],'#172027');
  for(let i=-5;i<=5;i++)line([i*.094,.445,2.397],[i*.088,.648,2.364],.020,'#4b5862');
  line([0,.445,2.414],[0,.646,2.386],.026,'#d2d9d8');line([-.087,.60,2.395],[0,.646,2.386],.022,'#d2d9d8');line([.087,.60,2.395],[0,.646,2.386],.022,'#d2d9d8');
  line([-.084,.60,2.398],[-.079,.674,2.387],.022,'#d2d9d8');line([.084,.60,2.398],[.079,.674,2.387],.022,'#d2d9d8');
  box([1.87,.047,.14],[0,.28,2.28],'#202b32');rearLights(-2.36,.72,.48);
  doorSeam([[.973,.88,.59],[.98,.35,.56],[.976,.33,-.68],[.976,.88,-.95]]);
  mirrorStalk(1.00,1.00,.30);hoodBadge(.717,2.17);wheels(12,'#40454b');save();
}
if(number===4){
  begin('muscle',[-1.46,1.43],4.75);
  body([[-2.38,.90,.27,.83],[-1.92,1.0,.27,.94],[-1.46,1.045,.27,1.02],[-.80,.96,.26,.93],[.20,.965,.26,.96],[.94,.98,.27,.97],[1.43,1.035,.27,1.04],[1.91,1.0,.27,.91],[2.38,.88,.29,.76]]);
  cabin([[-1.52,.80,.94,1.0],[-.98,.70,.96,1.40],[-.63,.67,.95,1.48],[.10,.68,.96,1.47],[.75,.80,.95,1.01]]);
  windshield([.75,.756,1.027],[.105,.62,1.487]);
  sideWindow([[.808,1.02,.63],[.785,1.01,-1.33],[.69,1.423,-.89],[.69,1.422,.075]]);
  for(const s of [-1,1]){
    line([s*.738,1.028,-.58],[s*.683,1.445,-.58],.053,'paint');
    hoodStripe(s*.16,s*.39,.80,2.35,'#1c2327');
    panel([[s*.15,1.49,.08],[s*.38,1.49,.08],[s*.38,1.50,-.60],[s*.15,1.50,-.60]],'#1c2327');
    panel([[s*.15,.956,-1.53],[s*.38,.956,-1.53],[s*.38,.87,-2.36],[s*.15,.87,-2.36]],'#1c2327');
    panel([[s*.56,.615,2.42],[s*.88,.65,2.397],[s*.95,.835,2.33],[s*.62,.80,2.386]],'#182329');
    for(let i=0;i<3;i++)line([s*(.68+i*.087),.667,2.423],[s*(.65+i*.087),.766,2.411],.042,'#eef2e0');
    panel([[s*.64,.35,2.43],[s*.85,.35,2.407],[s*.94,.53,2.381],[s*.71,.50,2.416]],'#172126');
    box([.20,.042,.035],[s*.76,.56,2.41],'#bd7933');
    box([.085,.07,1.82],[s*.975,.29,-.08],'#20272b');
    box([.17,.032,.035],[s*.972,.91,-.32],'#252e35');
    for(let i=0;i<3;i++)box([.07,.16,.035],[s*(.63+i*.105),.78,-2.42],'#b32e2d');
    box([.20,.09,.16],[s*.60,.29,-2.40],'#303b40');
  }
  panel([[-.57,.56,2.436],[.57,.56,2.436],[.63,.78,2.398],[-.63,.78,2.398]],'#202b32');
  for(let i=0;i<5;i++)box([1.05,.013,.02],[0,.58+i*.034,2.446],'#354049');
  panel([[-.48,.33,2.447],[.48,.33,2.447],[.58,.49,2.423],[-.58,.49,2.423]],'#141e25');
  box([1.93,.045,.16],[0,.265,2.34],'#171f25');
  panel([[-.115,.683,2.465],[-.045,.733,2.465],[.06,.726,2.465],[.107,.758,2.465],[.14,.745,2.465],[.10,.68,2.465],[.025,.667,2.465],[-.07,.65,2.465]],'#c6d0d3');
  line([-.07,.666,2.468],[-.105,.624,2.468],.024,'#c6d0d3');line([.055,.675,2.468],[.113,.64,2.468],.024,'#c6d0d3');
  line([-.11,.69,2.468],[-.18,.72,2.468],.020,'#c6d0d3');
  box([1.65,.055,.18],[0,.93,-2.24]);
  doorSeam([[.993,.91,.72],[.991,.34,.69],[.985,.33,-.75],[.99,.92,-.87]]);
  mirrorStalk(1.04,1.08,.52);wheels(10);save();
}
if(number===5){
  begin('exotic',[-1.45,1.36],4.50);
  body([[-2.25,.91,.26,.80],[-1.92,1.02,.25,.91],[-1.45,1.06,.25,1.01],[-.92,.99,.24,.86],[-.30,.93,.24,.83],[.60,.94,.23,.86],[1.36,1.01,.24,1.00],[1.75,.98,.25,.80],[2.08,.87,.26,.55],[2.25,.78,.27,.47]]);
  cabin([[-1.15,.74,.85,.92],[-.72,.66,.86,1.25],[-.42,.62,.84,1.36],[.17,.63,.81,1.34],[.81,.76,.78,.84]]);
  windshield([.79,.716,.863],[.174,.575,1.36]);
  sideWindow([[.766,.85,.70],[.746,.91,-1.03],[.652,1.269,-.69],[.627,1.32,-.39],[.638,1.30,.12]]);
  for(const s of [-1,1]){
    for(let i=0;i<5;i++)box([.018,.032,.036],[s*(.75+i*.021),.843+i*.024,1.66-i*.043],'#798b91');
    panel([[s*.51,.31,2.29],[s*.75,.30,2.29],[s*.87,.47,2.29],[s*.73,.54,2.29],[s*.58,.49,2.29]],'#141f25');
    panel([[s*.95,.35,-.85],[s*.99,.31,-.20],[s*.97,.29,.76],[s*.93,.34,.76],[s*.945,.39,-.30]]);
    box([.073,.045,1.61],[s*.947,.27,-.07],'#273035');
    box([.11,.04,.03],[s*.947,.81,-.06],'#263038');
    cylinder(.12,.07,[s*.74,.73,-2.29],'#aa252c','z',12);
    cylinder(.074,.09,[s*.74,.73,-2.30],'#e4473c','z',12);
    cylinder(.085,.11,[s*.47,.36,-2.29],'#525c62','z',12);
    cylinder(.059,.125,[s*.47,.36,-2.30],'#101b22','z',12);
  }
  onHood([[.45,2.16],[.73,2.0],[.88,1.43],[.81,1.27],[.65,1.67]],'#18252b');
  onHood([[.48,2.12],[.71,1.98],[.85,1.43],[.81,1.34],[.67,1.68]],'#e8efdf',.027);
  onSide([[.44,-.95],[.79,-.75],[.82,-.32],[.70,-.03],[.45,-.38]],'#18252b');
  panel([[-.45,.31,2.31],[.45,.31,2.31],[.49,.45,2.28],[-.49,.45,2.28]],'#192229');
  box([.067,.19,.045],[0,.375,2.33]);box([1.82,.041,.14],[0,.25,2.20],'#212a30');
  panel([[-.57,.95,-1.16],[.57,.95,-1.16],[.64,.91,-1.97],[-.64,.91,-1.97]],'#202a30');
  for(let i=0;i<8;i++)box([1.07,.027,.04],[0,.978-i*.005,-1.20-i*.095],'#505758');
  box([1.62,.055,.18],[0,.89,-2.13]);box([1.76,.18,.06],[0,.42,-2.30],'#192228');
  doorSeam([[.968,.77,.70],[.958,.37,.68],[.949,.38,-.18]]);
  mirrorStalk(1.02,.91,.54);hoodBadge(.62,2.005,'#d8b627');wheels(10,'#b89c29');save();
}
if(number===6){
  begin('gt',[-1.43,1.43],4.65);
  body([[-2.33,.94,.28,.84],[-1.90,1.0,.27,.99],[-1.43,1.055,.27,1.08],[-.77,.98,.27,.97],[.20,.975,.27,.97],[.89,.98,.27,.99],[1.43,1.055,.27,1.09],[1.95,1.01,.28,.93],[2.33,.90,.31,.75]]);
  cabin([[-1.54,.80,.98,1.08],[-1.02,.71,.99,1.44],[-.66,.675,.98,1.52],[.03,.68,.97,1.52],[.70,.82,.96,1.03]]);
  windshield([.69,.776,1.052],[.033,.63,1.541]);
  sideWindow([[.824,1.052,.60],[.793,1.086,-1.40],[.71,1.444,-.99],[.69,1.478,-.62],[.692,1.477,-.02]]);
  for(const s of [-1,1]){
    line([s*.762,1.055,-.55],[s*.699,1.47,-.55],.074,'paint');
    panel([[s*.56,.66,2.38],[s*.87,.69,2.34],[s*.96,.87,2.26],[s*.79,.97,2.02],[s*.67,.85,2.24]],'#202930');
    panel([[s*.59,.692,2.397],[s*.84,.723,2.365],[s*.91,.864,2.29],[s*.79,.919,2.11],[s*.70,.849,2.26]],'#f1f1d7');
    line([s*.61,.728,2.403],[s*.835,.76,2.37],.038,'#eeeece');
    box([.26,.071,.08],[s*.73,.56,2.375],'#b5bfbb');box([.25,.17,.056],[s*.72,.39,2.38],'#192329');
    box([.078,.08,1.84],[s*.98,.29,-.10],'#273037');
    box([.145,.026,.045],[s*.982,.945,-.17],'#353f47');
    box([.11,.20,.18],[s*.60,1.17,-1.85],'#39434a');
    for(const x of [.49,.77]){cylinder(.105,.047,[s*x,.70,-2.36],'#962a2c','z',16);cylinder(.067,.055,[s*x,.70,-2.37],'#c94d40','z',12);cylinder(.08,.12,[s*x,.30,-2.38],'#48565d','z',12);cylinder(.056,.13,[s*x,.30,-2.39],'#18232b','z',12);}
  }
  onHood([[.39,1.24],[.54,1.24],[.53,1.63],[.40,1.57]],'#20282d');
  panel([[-.58,.54,2.385],[.58,.54,2.385],[.64,.72,2.37],[.49,.79,2.353],[-.49,.79,2.353],[-.64,.72,2.37]],'#1a232a');
  panel([[-.57,.30,2.395],[.57,.30,2.395],[.62,.50,2.385],[-.62,.50,2.385]],'#162129');
  box([1.09,.04,.08],[0,.525,2.407],'#404c53');
  for(let i=0;i<4;i++)box([1.13,.018,.025],[0,.58+i*.04,2.409],'#3d4750');
  box([.074,.061,.029],[.036,.64,2.443],'#bc3034');box([.083,.015,.03],[.027,.69,2.443],'#c5ced0');
  box([1.97,.047,.18],[0,.265,2.29],'#222d35');
  box([1.88,.10,.32],[0,1.315,-1.85]);
  for(const s of [-1,1])box([.07,.16,.36],[s*.93,1.315,-1.85]);
  doorSeam([[.999,.95,.64],[.993,.36,.62],[.989,.34,-.62],[.995,.96,-.88]]);
  mirrorStalk(1.04,1.09,.47);wheels(7,'#5e6470');save();
}
function begin(id,axles,length){m={number,referenceName:id,axles,length,body:[],cabin:[],roof:[0,0,0,0],panels:[],parts:[],cylinders:[]};models[id]=m;}
function windshield(front,back){
  const [fz,fw,fy]=front,[bz,bw,by]=back;
  const y=z=>fy+(by-fy)*(fz-z)/(fz-bz);
  panel([[-fw,fy,fz],[fw,fy,fz],[bw,by,bz],[-bw,by,bz]],'#18262e');
  panel([[-fw+.055,y(fz-.045)+.014,fz-.045],[fw-.055,y(fz-.045)+.014,fz-.045],[bw-.045,y(bz+.035)+.014,bz+.035],[-bw+.045,y(bz+.035)+.014,bz+.035]],'#365569');
  panel([[fw-.18,y(fz-.05)+.019,fz-.05],[fw-.06,y(fz-.05)+.019,fz-.05],[bw-.05,y(bz+.045)+.019,bz+.045],[bw-.14,y(bz+.045)+.019,bz+.045]],'#54788e');
}
function sideWindow(points){mirror(points,'#17232b');mirror(points.map(([x,y,z],i)=>[x+.008,y+(i<2?.035:-.035),z+(i===0?-.06:i===1?.06:0)]),'#344f60');}
function doorSeam(points){for(const s of [-1,1])for(let i=0;i<points.length-1;i++)line(points[i].map((v,k)=>k===0?v*s:v),points[i+1].map((v,k)=>k===0?v*s:v),.013,'#303c42');}
function mirrorStalk(x,y,z){for(const s of [-1,1]){box([.16,.045,.08],[s*(x-.08),y,z],'#22292d');box([.22,.11,.20],[s*x,y+.05,z]);box([.018,.077,.14],[s*(x+.115),y+.045,z],'#9caaae');}}
function rearLights(z,y,w=.54){for(const s of [-1,1])box([w,.10,.027],[s*.65,y,z],'#ae252c');}
function hoodBadge(y,z,color='#d7a92c'){box([.055,.015,.08],[0,y,z],color);}
function save(){
  detailCar({m,panel,box,cylinder,line});
  const temporary=new URL('../game/car-shapes.json.tmp',import.meta.url);
  // Authoring stays in these modules; keep the shared browser payload compact.
  fs.writeFileSync(temporary,JSON.stringify(models)+'\n');
  // The running editor may briefly hold the model file during a refresh.
  for(let attempt=0;;attempt++){
    try{fs.renameSync(temporary,file);break;}
    catch(error){if(attempt>=9)throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100);}
  }
  console.log(`Authored reference ${number}: ${m.referenceName}, ${m.panels.length} panels, ${m.parts.length} parts`);
}
if(number===1){
  begin('wedge',[-1.46,1.30],4.56);
  authorWedge({m,panel,box,cylinder,line});save();
}
