// A sampled continuous surface: samples are interpolation points, never removable tiles.
export const EXCAVATOR_MAPS = [
  {id:'sand',name:'모래 쟁탈전',mode:'sand',description:'우리 팀 구역에 가장 많은 모래를 모으세요.'},
  {id:'waterfall',name:'폭포 물길 경주',mode:'water',description:'버킷이 닿은 부분을 파서 폭포와 목표선을 연결하세요. 물이 흐를 만큼 깊고 이어진 물길을 만들어야 합니다.'}
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function resetWater(m){
  m.water=null;if(m.excavatorMap.mode!=='water')return;
  const rows=71,cols=21,size=.2,start=-7;
  m.water={rows,cols,size,start,level:-.24,maxDepth:.85,elapsed:0,lanes:m.teams.map(t=>{
    const depth=new Float64Array(rows*cols),wet=new Float64Array(rows*cols);
    for(let row=0;row<=4;row++)for(let col=1;col<cols-1;col++){
      const side=(col-(cols-1)/2)*size;
      depth[row*cols+col]=.62*Math.sqrt(Math.max(0,1-(side/2)**4));
      if(depth[row*cols+col]>.26)wet[row*cols+col]=1;
    }
    return {team:t.id,angle:0,x:(t.id-(m.teamCount-1)/2)*7.8,z:0,progress:0,finishedAt:null,revision:0,depth,wet};
  })};
}
export function waterLocal(w,lane,point){
  const s=Math.sin(lane.angle),c=Math.cos(lane.angle),x=point.x-lane.x,z=point.z-lane.z;
  return {x:x*c-z*s,z:x*s+z*c-w.start};
}
export function waterHit(m,point){
  if(!m.water)return null;const w=m.water;
  for(const lane of w.lanes){const local=waterLocal(w,lane,point);
    if(Math.abs(local.x)<=((w.cols-1)*w.size/2)&&local.z>=0&&local.z<=(w.rows-1)*w.size)return {lane,...local};
  }return null;
}
function sample(w,lane,x,z){
  const u=clamp(x/w.size+(w.cols-1)/2,0,w.cols-1),v=clamp(z/w.size,0,w.rows-1);
  const col=Math.min(w.cols-2,Math.floor(u)),row=Math.min(w.rows-2,Math.floor(v)),fx=u-col,fz=v-row;
  const at=(r,c)=>lane.depth[r*w.cols+c];
  return (at(row,col)*(1-fx)+at(row,col+1)*fx)*(1-fz)+(at(row+1,col)*(1-fx)+at(row+1,col+1)*fx)*fz;
}
export function waterHeight(m,point){const hit=waterHit(m,point);return hit?-sample(m.water,hit.lane,hit.x,hit.z):0;}
export function waterAction(m,p,action,tip){
  const hit=waterHit(m,tip),w=m.water;
  if(action==='scoop'){
    if(p.cargo>=39.99){p.message='버킷이 가득 찼어요. 물길 밖에 흙을 내려놓으세요';return;}
    if(!hit||hit.lane.team!==p.team){p.message='우리 팀 물길의 땅 위로 버킷을 옮기세요';return;}
    const surface=-sample(w,hit.lane,hit.x,hit.z);
    if(tip.height>surface+.16){p.message='버킷 이빨을 파낼 땅에 닿도록 내리세요';return;}
    // The cutting lip sits at tip; the bowl extends back toward the machine.
    // Its curved bottom follows exact world position, yaw and tooth height.
    const angle=p.yaw+p.turret-hit.lane.angle,s=Math.sin(angle),c=Math.cos(angle);
    const centerX=hit.x-s*.28,centerZ=hit.z-c*.28,bottom=Math.max(-w.maxDepth,tip.height-.18);
    const edits=[];let volume=0;
    for(let row=Math.max(0,Math.floor((centerZ-.8)/w.size));row<=Math.min(w.rows-1,Math.ceil((centerZ+.8)/w.size));row++){
      for(let col=0;col<w.cols;col++){
        const dx=(col-(w.cols-1)/2)*w.size-centerX,dz=row*w.size-centerZ;
        const across=dx*c-dz*s,along=dx*s+dz*c;
        const q=(across/.48)**2+(along/.64)**2;if(q>=1)continue;
        const index=row*w.cols+col,old=hit.lane.depth[index];
        const target=clamp(-(bottom+.28*q),0,w.maxDepth),delta=Math.max(0,target-old);
        if(delta>0){edits.push([index,delta]);volume+=delta*w.size*w.size;}
      }
    }
    if(volume<.0002){p.message='버킷을 더 내리거나 옆으로 옮겨 새 부분을 파세요';return;}
    const unitsPerCubicMeter=230,scale=Math.min(1,(40-p.cargo)/(volume*unitsPerCubicMeter));
    for(const [index,delta] of edits)hit.lane.depth[index]+=delta*scale;
    const amount=volume*unitsPerCubicMeter*scale;
    p.cargo=Math.min(40,p.cargo+amount);p.delivered+=amount;hit.lane.revision++;
    p.message='버킷 모양으로 땅을 팠어요. 더 깊게 파고 옆 부분과 이어 주세요';
  }else if(action==='drop'){
    if(!p.cargo){p.message='버킷이 비어 있어요';return;}
    if(hit){p.message='물길이 막히지 않도록 흙은 물길 밖에 내려놓으세요';return;}
    const nearby=m.groundPiles.find(s=>Math.hypot(s.x-tip.x,s.z-tip.z)<.7);
    if(nearby)nearby.dirt+=p.cargo;
    else m.groundPiles.push({id:m.nextPileId++,x:tip.x,z:tip.z,radius:.85,dirt:p.cargo});
    p.cargo=0;p.message='물길 밖에 흙을 내려놓았어요';
  }
}
export function waterTick(m,dt){
  const w=m.water;w.elapsed+=dt;const participating=new Set([...m.players.values()].map(p=>p.team));
  for(const lane of w.lanes){
    if(!participating.has(lane.team))continue;
    const previous=lane.wet.slice();let front=0;
    for(let row=0;row<w.rows;row++)for(let col=0;col<w.cols;col++){
      const i=row*w.cols+col;
      // A shallow crest stays above the common water surface and blocks flow.
      if(lane.depth[i]<-w.level+.025)continue;
      const neighbors=[...(row>0?[i-w.cols]:[]),...(row<w.rows-1?[i+w.cols]:[]),...(col>0?[i-1]:[]),...(col<w.cols-1?[i+1]:[])];
      if(previous[i]<1&&neighbors.some(n=>previous[n]>.55))lane.wet[i]=Math.min(1,previous[i]+dt*4);
      if(lane.wet[i]>.55)front=Math.max(front,row);
    }
    lane.progress=Math.max(0,(front-4)/(w.rows-1-4))*100;
    if(front===w.rows-1&&lane.finishedAt===null)lane.finishedAt=w.elapsed;
  }
  return w.lanes.some(l=>l.finishedAt!==null);
}
export function waterSnapshot(w){
  if(!w)return null;
  return {...w,lanes:w.lanes.map(({depth,wet,...lane})=>{
    const packed=Buffer.alloc(depth.length*3);
    for(let i=0;i<depth.length;i++){packed.writeUInt16LE(Math.round(depth[i]*1000),i*3);packed[i*3+2]=Math.round(wet[i]*255);}
    return {...lane,surface:packed.toString('base64')};
  })};
}
export function waterResults(m){
  const participating=new Set([...m.players.values()].map(p=>p.team));
  const rank=items=>{items.sort((a,b)=>b.score-a.score);return items.map((p,i)=>({...p,rank:items.findIndex(q=>q.score===p.score)+1}));};
  const teams=rank(m.water.lanes.filter(l=>participating.has(l.team)).map(l=>({id:l.team,color:m.teams[l.team].color,score:Math.round(l.progress),time:l.finishedAt})));
  const reached=teams.filter(t=>t.time!==null),first=Math.min(...reached.map(t=>t.time));
  return {mode:'water',teams,players:rank([...m.players.values()].map(p=>({id:p.id,name:p.name,team:p.team,score:Math.round(p.delivered),disrupted:0}))),winnerIds:reached.filter(t=>t.time===first).map(t=>t.id),total:0,timedOut:!reached.length};
}
