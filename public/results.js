export function renderResults(container,state,playerId) {
  container.hidden=state.phase!=='finished'||!state.results;
  if(container.hidden){container.replaceChildren();delete container.dataset.signature;return;}
  const r=state.results,signature=JSON.stringify([r,playerId]);
  if(container.dataset.signature===signature)return;
  container.dataset.signature=signature;
  const element=(tag,text,className)=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};
  const water=r.mode==='water';
  const winners=r.winnerIds.map(id=>`팀 ${id+1}`).join(' · ');
  const title=winners?`${winners} ${r.winnerIds.length>1?'공동 우승!':'우승!'}`:'이번 경기는 무승부';
  const heading=element('h2',title,'result-winner');
  const summary=element('p',water?(r.timedOut?'시간 종료 · 목표선에 도달한 팀이 없어 무승부입니다.':'목표선에 물이 도달했습니다!'):`작업 완료! 최종 확보 모래 ${r.total}점`);
  const sections=element('div','','result-columns');
  function standings(title,entries,personal=false){
    const section=element('section','');section.append(element('h3',title));
    const list=element('ol','','result-ranking');
    for(const item of entries){
      const row=element('li','','result-row');
      if(personal)row.classList.add('personal');
      if(personal&&item.id===playerId)row.classList.add('is-me');
      const name=personal?`${item.name} · 팀 ${item.team+1}${item.id===playerId?' (나)':''}`:`팀 ${item.id+1}`;
      row.style.setProperty('--team',state.teams[personal?item.team:item.id].color);
      row.append(element('span',`${item.rank}위`),element('strong',name),element('span',water?(personal?`굴착 ${item.score}`:`물길 ${item.score}%${item.time!==null?' · '+item.time.toFixed(2)+'초':''}`):personal?`운반 ${item.score} · 방해 ${item.disrupted??0}`:`${item.score}점`,personal?'result-metrics':undefined));list.append(row);
    }
    section.append(list);return section;
  }
  sections.append(standings('팀 최종 순위',r.teams),standings(water?'개인 굴착 기록':'개인 운반 기록',r.players,true));
  const note=element('p','팀 점수는 최종 모래량입니다. 개인 운반량은 자기 팀에 내려놓은 누적량, 방해량은 상대 팀 구역에서 퍼낸 누적량입니다. 반복한 작업도 포함하며 개인 순위는 운반량 기준입니다.','result-note');
  if(water)note.textContent='폭포와 연결된 물이 목표선에 먼저 도착한 팀이 우승합니다. 개인 기록은 파낸 흙의 양입니다.';
  if(!water&&playerId){const me=r.players.find(p=>p.id===playerId);if(me)summary.textContent+=` · 내 기록 ${me.rank}위 / 운반 ${me.score} · 방해 ${me.disrupted??0}`;}
  container.replaceChildren(element('span','FINAL RESULTS','eyebrow'),heading,summary,sections,note,element('p','진행자가 대기실로 돌아가면 다음 경기를 준비합니다.','result-note'));
  if(playerId){
    container.classList.remove('expanded');
    const toggle=element('button','전체 순위 보기');toggle.type='button';toggle.setAttribute('aria-expanded','false');
    toggle.onclick=()=>{const open=container.classList.toggle('expanded');toggle.textContent=open?'순위 접고 조작하기':'전체 순위 보기';toggle.setAttribute('aria-expanded',String(open));};
    container.prepend(toggle);
  }
}
