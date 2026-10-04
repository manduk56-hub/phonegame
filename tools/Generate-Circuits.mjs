import {writeFileSync} from 'node:fs';

// Original compact racing layouts, inspired by circuit types rather than licensed replicas.
const definitions=[
  {id:'green-valley',name:'그린밸리 GP',theme:'park',difficulty:'입문',description:'긴 메인 스트레이트와 넓은 고속 코너 · 관중석이 둘러싼 상설 경기장',color:'#92cc73',anchors:[[0,-110],[155,-110],[190,-65],[180,35],[130,100],[55,105],[25,45],[-25,45],[-60,110],[-150,100],[-190,35],[-185,-55],[-140,-110]],radius:26},
  {id:'azure-coast',name:'아주르 하버',theme:'harbor',difficulty:'상급',description:'항구의 좁은 코너와 헤어핀 · 짧은 제동 구간의 테크니컬 경기장',color:'#69c9dc',anchors:[[0,-110],[140,-110],[170,-75],[170,35],[125,65],[125,120],[45,120],[45,60],[-20,60],[-20,115],[-130,115],[-170,65],[-170,-45],[-115,-45],[-115,-110]],radius:18},
  {id:'sakura-ring',name:'사쿠라 테크니컬',theme:'sakura',difficulty:'중급',description:'리듬감 있는 연속 S 코너와 마지막 헤어핀 · 정밀한 조향',color:'#f1a1b9',anchors:[[0,-125],[140,-125],[185,-80],[160,-20],[105,0],[140,50],[100,110],[30,125],[-15,75],[-70,105],[-145,75],[-180,15],[-130,-25],[-70,-20],[-40,-70],[-110,-80],[-155,-125]],radius:22},
  {id:'dune-gp',name:'듄 인터내셔널',theme:'desert',difficulty:'중급',description:'두 개의 긴 직선과 강한 제동 구간 · 고속 그랑프리 경기장',color:'#eebd6b',anchors:[[0,-135],[180,-135],[210,-95],[210,85],[160,135],[70,135],[70,30],[10,30],[10,120],[-170,120],[-210,70],[-210,-95],[-160,-135]],radius:24}
];
const lerp=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
function sample(d){
  const dense=[];const a=d.anchors,n=a.length;
  for(let i=0;i<n;i++){
    const prev=a[(i+n-1)%n],p=a[i],next=a[(i+1)%n];
    const r=Math.min(d.radius,Math.hypot(p[0]-prev[0],p[1]-prev[1])*.3,Math.hypot(p[0]-next[0],p[1]-next[1])*.3);
    const entry=lerp(p,prev,r/Math.hypot(p[0]-prev[0],p[1]-prev[1]));
    const exit=lerp(p,next,r/Math.hypot(p[0]-next[0],p[1]-next[1]));
    for(let j=0;j<24;j++){const t=j/24;dense.push(lerp(lerp(entry,p,t),lerp(p,exit,t),t));}
    const np=a[(i+2)%n],nr=Math.min(d.radius,Math.hypot(next[0]-p[0],next[1]-p[1])*.3,Math.hypot(next[0]-np[0],next[1]-np[1])*.3);
    const ne=lerp(next,p,nr/Math.hypot(next[0]-p[0],next[1]-p[1]));
    const steps=Math.ceil(Math.hypot(ne[0]-exit[0],ne[1]-exit[1]));
    for(let j=0;j<steps;j++)dense.push(lerp(exit,ne,j/steps));
  }
  // Start on the straight at x=0, with an equally spaced arc-length sampling.
  let start=0;dense.forEach((p,i)=>{if(Math.hypot(p[0],p[1]-a[0][1])<Math.hypot(...[dense[start][0],dense[start][1]-a[0][1]]))start=i;});
  const line=[...dense.slice(start),...dense.slice(0,start)];line.push(line[0]);
  const lengths=[0];for(let i=1;i<line.length;i++)lengths.push(lengths[i-1]+Math.hypot(line[i][0]-line[i-1][0],line[i][1]-line[i-1][1]));
  const total=lengths.at(-1),count=Math.ceil(total/3),points=[];let j=1;
  for(let i=0;i<count;i++){const dist=i*total/count;while(lengths[j]<dist)j++;const p=lerp(line[j-1],line[j],(dist-lengths[j-1])/(lengths[j]-lengths[j-1]));points.push({x:+p[0].toFixed(3),z:+p[1].toFixed(3)});}
  return {points,length:Math.round(total)};
}
function scenery(track){
  const boxes=[],add=(size,pos,color,yaw=0)=>boxes.push({size,pos,color,yaw});
  const points=track.points,z=points[0].z;
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minZ=Math.min(...points.map(p=>p.z)),maxZ=Math.max(...points.map(p=>p.z));
  const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
  const near=(x,z)=>Math.min(...points.map(p=>Math.hypot(p.x-x,p.z-z)));
  const accent=track.color;
  add([maxX-minX+180,.3,maxZ-minZ+160],[centerX,-.21,centerZ],'#64785f');
  add([maxX-minX+65,.08,maxZ-minZ+65],[centerX,-.015,centerZ],'#82947c');
  // Visible stepped seating surrounds the arena. Roofs are deliberately omitted
  // so the PC overview shows seats and the crowd rather than flat dark boxes.
  const crowd=['#ead6b0','#e88773','#89b6d3','#efc65f','#9baee0','#e9ece0'];
  function stand(cx,cz,length,yaw,seed){
    const local=(x,y,z)=>[cx+x*Math.cos(yaw)+z*Math.sin(yaw),y,cz-x*Math.sin(yaw)+z*Math.cos(yaw)];
    add([length+2,.5,12],local(0,.25,4),'#c5ccc6',yaw);
    for(let row=0;row<5;row++){
      add([length,1.1,2.2],local(0,.8+row*.9,row*2.2),'#aeb8ba',yaw);
      add([length,.15,1],local(0,1.5+row*.9,row*2.2),row%2?accent:'#425d72',yaw);
      const seats=Math.floor(length/2.7);
      for(let seat=0;seat<seats;seat++){
        if(seat%9===4)continue;
        const x=(seat-(seats-1)/2)*2.7;
        add([.85,.95,.7],local(x,2+row*.9,row*2.2),crowd[(seat+row*3+seed)%crowd.length],yaw);
        add([.55,.5,.55],local(x,2.7+row*.9,row*2.2),'#d4b69a',yaw);
      }
    }
    add([length,1,.25],local(0,1, -1.3),'#e2e5de',yaw);
    add([length,.65,.25],local(0,5.9,10.2),'#e2e5de',yaw);
    for(let i=0;i<3;i++)add([length/3-3,1.1,.3],local((i-1)*length/3,1.7,-1.45),i%2?accent:'#344e66',yaw);
  }
  const rows=3,segment=(maxX-minX)/rows;
  for(let i=0;i<rows;i++){
    const x=minX+segment*(i+.5);
    stand(x,minZ-21,segment-6,Math.PI,i);
    stand(x,maxZ+21,segment-6,0,i+2);
  }
  for(let i=0;i<2;i++){
    const zp=minZ+(maxZ-minZ)*(i+.5)/2;
    stand(minX-21,zp,(maxZ-minZ)/2-7,-Math.PI/2,i+4);
    stand(maxX+21,zp,(maxZ-minZ)/2-7,Math.PI/2,i+1);
  }
  // An infield stand faces the starting grid, without covering the crowd.
  stand(-10,z+20,95,0,2);
  // Flat pit apron and numbered stalls retain racing detail without buildings.
  add([180,.12,7],[-10,.015,z-15],'#525e65');
  add([172,.65,.4],[-10,.4,z-10],'#e8e8de');
  for(let i=0;i<10;i++)add([12,.02,1],[-86+i*16,.09,z-15],accent);
  for(let i=0;i<16;i++){
    const p=points[(points.length-2-Math.floor(i/2)*3+points.length)%points.length];
    add([.18,.02,3],[p.x,.09,p.z+(i%2?2:-2)],'#eee9db',Math.PI/2);
  }
  // Stadium floodlights and trackside advertising. Nothing sits on the course.
  for(const x of [minX-18,maxX+18])for(const zp of [minZ-18,maxZ+18]){
    add([.8,15,.8],[x,7.5,zp],'#cad0cd');add([7,1.4,1],[x,15,zp],'#e7e8db');
    for(let bulb=0;bulb<5;bulb++)add([.8,.8,.2],[x+(bulb-2)*1.2,15,zp+.6],'#fff4be');
  }
  for(let i=20;i<points.length;i+=28){
    const p=points[i],q=points[(i+1)%points.length],yaw=Math.atan2(q.x-p.x,q.z-p.z),nx=Math.cos(yaw),nz=-Math.sin(yaw);
    const x=p.x+nx*11,zp=p.z+nz*11;
    if(near(x,zp)<9)continue;
    add([5,1.2,.3],[x,1,zp],i%56<28?accent:'#f0e8d2',yaw);
    add([.3,1.2,.3],[x, .6,zp],'#788b8e');
  }
  // Camera bounds frame the racing surface tightly, with the stands at the edges.
  track.bounds={minX:minX-16,maxX:maxX+16,minZ:minZ-16,maxZ:maxZ+16};
  return boxes;
}
const tracks=definitions.map(d=>{const s=sample(d);return {...d,...s,width:12,bounds:{minX:-305,maxX:305,minZ:-245,maxZ:245}};});
for(const track of tracks)track.scenery=scenery(track);
writeFileSync(new URL('../game/circuits.json',import.meta.url),JSON.stringify(tracks));
const {scenery:_,...defaultTrack}=tracks[0];
writeFileSync(new URL('../game/circuit.json',import.meta.url),JSON.stringify(defaultTrack));
console.log(tracks.map(t=>`${t.name}: ${t.length}m, ${t.points.length} samples, ${t.scenery.length} props`).join('\n'));
