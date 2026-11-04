export const MOLE={holes:9,turnDuration:25,exposure:1.5,minExposure:.45,hiddenLimit:3,hitCooldown:.4};
export function moleSpawn(m,p){Object.assign(p,{score:0,hits:0,dodges:0,participating:false,role:'hunter',moleCooldown:0,message:'구멍을 눌러 두더지를 잡으세요',input:m.neutral()});}
function turn(m){const s=m.mole;s.turn++;s.moleId=s.order[s.turn];s.turnLeft=MOLE.turnDuration;s.hole=-1;s.visible=false;s.exposed=0;s.hidden=0;s.stun=0;s.serial++;s.event='새 두더지 등장!';for(const p of m.players.values())p.role=p.id===s.moleId?'mole':'hunter';}
export function moleStart(m){const order=[...m.players.values()].filter(p=>p.connected).map(p=>p.id);if(order.length<2)throw Error('두더지 잡기는 2명 이상 필요합니다.');for(const p of m.players.values()){moleSpawn(m,p);p.participating=p.connected;}m.mole={order,turn:-1,serial:0};m.results=null;m.phase='running';m.remaining=order.length*MOLE.turnDuration;turn(m);}
function finish(m){const rows=[...m.players.values()].filter(p=>p.participating).sort((a,b)=>b.score-a.score);m.results={mode:'mole',winnerIds:rows.filter(p=>p.score===rows[0]?.score).map(p=>p.id),players:rows.map((p,i)=>({id:p.id,name:p.name,score:p.score,hits:p.hits,dodges:p.dodges,rank:rows.findIndex(q=>q.score===p.score)+1}))};m.phase='finished';m.remaining=0;m.mole.visible=false;m.mole.hole=-1;m.mole.event='경기 종료';}
function hide(m,dodge=false){const s=m.mole,p=m.players.get(s.moleId);if(dodge&&p){p.score++;p.dodges++;}s.visible=false;s.hole=-1;s.hidden=0;s.exposed=0;s.stun=.35;s.event=dodge?'두더지 회피 +1':'땅속으로 쏙!';}
export function moleAction(m,id,v){const p=m.players.get(id),s=m.mole;if(m.game!=='mole'||m.phase!=='running'||!p?.connected||!p.participating||!s)return;
 if(id===s.moleId){if(v.action==='hide'&&s.visible&&s.exposed>=MOLE.minExposure)hide(m,true);if(v.action==='pop'&&!s.visible&&s.stun<=0&&Number.isInteger(v.hole)&&v.hole>=0&&v.hole<MOLE.holes){s.hole=v.hole;s.visible=true;s.exposed=0;s.hidden=0;s.serial++;s.event='잡을 수 있으면 잡아봐!';}return;}
 if(v.action!=='whack'||p.moleCooldown>0||!Number.isInteger(v.hole)||v.hole<0||v.hole>=MOLE.holes)return;
 p.moleCooldown=MOLE.hitCooldown;
 if(s.visible&&v.hole===s.hole&&v.serial===s.serial){p.score+=3;p.hits++;hide(m);s.stun=.85;s.event=p.name+' 명중! +3';}else{p.score=Math.max(0,p.score-1);p.message='빗나감 −1 · 망치 회복 중';}
}
export function moleTick(m,dt){if(m.phase!=='running'||!m.mole||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);const s=m.mole;for(const p of m.players.values())p.moleCooldown=Math.max(0,p.moleCooldown-dt);s.turnLeft=Math.max(0,s.turnLeft-dt);m.remaining=Math.max(0,(s.order.length-s.turn-1)*MOLE.turnDuration+s.turnLeft);const p=m.players.get(s.moleId),hunters=[...m.players.values()].filter(q=>q.participating&&q.connected&&q.id!==s.moleId);
 if(!hunters.length){finish(m);return;}
 if(s.turnLeft<1e-6||!p?.connected){if(s.turn+1>=s.order.length){finish(m);return;}turn(m);return;}
 s.stun=Math.max(0,s.stun-dt);if(s.visible){s.exposed+=dt;if(s.exposed>=MOLE.exposure)hide(m,true);}else{s.hidden+=dt;if(s.hidden>=MOLE.hiddenLimit&&s.stun<=0)moleAction(m,s.moleId,{action:'pop',hole:Math.floor(Math.random()*MOLE.holes)});}
}
export function moleSnapshot(m){const {order,...s}=m.mole||{turn:0,turnLeft:MOLE.turnDuration,moleId:null,visible:false,hole:-1,serial:0,event:'QR로 참가하세요'};return {...MOLE,...s,turns:order?.length||0};}
