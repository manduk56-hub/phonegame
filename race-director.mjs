// Server-owned broadcast selection, shared by web and native PC screens.
export function updateRaceDirector(match,dt){
  const active=[...match.players.values()].filter(p=>p.connected&&p.finishedAt===null);
  let d=match.raceDirector;
  if(!d||match.raceElapsed<d.elapsed)d=match.raceDirector={id:null,reason:'순환 중계',since:-10,elapsed:0,ranks:{},stuck:{},cooldowns:{},events:[]};
  d.elapsed=match.raceElapsed;
  d.events=d.events.filter(e=>e.until>d.elapsed&&active.some(p=>p.id===e.id));
  const previousRanks={...d.ranks};
  for(const p of active){
    const previous=previousRanks[p.id];
    if(previous!==undefined&&p.rank<previous&&active.some(q=>q.id!==p.id&&previousRanks[q.id]<previous&&q.rank>p.rank))d.events.push({id:p.id,reason:'추월!',priority:3,until:d.elapsed+5});
    d.ranks[p.id]=p.rank;
    d.stuck[p.id]=p.wallContact&&Math.abs(p.speed)<3?(d.stuck[p.id]||0)+dt:0;
    if(d.stuck[p.id]>=2&&d.elapsed-(d.cooldowns[p.id]??-20)>12){
      d.events.push({id:p.id,reason:'벽 충돌 · 탈출 중',priority:2,until:d.elapsed+5});d.cooldowns[p.id]=d.elapsed;
    }
  }
  for(const id of Object.keys(d.ranks))if(!active.some(p=>p.id===id)){delete d.ranks[id];delete d.stuck[id];delete d.cooldowns[id];}
  if(!active.length){d.id=null;d.reason='경기 대기';return;}
  const valid=active.some(p=>p.id===d.id),held=d.elapsed-d.since;
  if(valid&&held<4)return;
  const event=d.events.sort((a,b)=>b.priority-a.priority||b.until-a.until).find(e=>e.id!==d.id);
  const fastest=active.reduce((a,b)=>b.speed>a.speed?b:a);
  let candidate=event;
  if(!candidate&&fastest.speed>12&&fastest.id!==d.id&&d.elapsed-(d.cooldowns.fastest??-20)>12){candidate={id:fastest.id,reason:'최고 속도',priority:1};d.cooldowns.fastest=d.elapsed;}
  if(!valid||candidate||held>=8){
    const next=active[(active.findIndex(p=>p.id===d.id)+1)%active.length];
    d.id=candidate?.id||next.id;d.reason=candidate?.reason||'순환 중계';d.since=d.elapsed;
    d.events=d.events.filter(e=>e.id!==d.id);
  }
}
