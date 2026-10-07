export const CATCH_DURATION=1.2;
export const CHEST_TARGET=[0,1.22,0];
export function catchPose(event,elapsed){
 const age=Math.max(0,elapsed-event.at),t=Math.max(0,Math.min(1,(age-.2)/(CATCH_DURATION-.2)));
 const slot=event.id%20,x=(slot%5-2)*.48,z=(Math.floor(slot/5)-1.5)*.42;
 const end=[x,CHEST_TARGET[1]+Math.floor((event.id%60)/20)*.08,z];
 return {position:event.from.map((v,i)=>v+(end[i]-v)*t+(i===1?4*3.2*t*(1-t):0)),
  rotation:[t*Math.PI*2,event.yaw+t*Math.PI,Math.sin(t*Math.PI)*.5],scale:age>=CATCH_DURATION?.28:.5,landed:age>=CATCH_DURATION,t};
}
export function ceremonyPose(p,ceremony){
 const d=Math.max(1.8,Math.min(34,ceremony.distance)),face=[p.x,p.y+2.22,p.z];
 return {eye:[p.x+Math.sin(p.yaw)*d,face[1]+d*.24*Math.min(1,(d-1.8)/8),p.z+Math.cos(p.yaw)*d],target:face};
}
export function ceremonyMessage(c,p,winner){
 if(!c)return '무승부 · PC에서 다음 경기를 준비합니다';
 if(!winner)return '경기 종료 · 우승자의 카메라 세리머니를 감상하세요';
 if(c?.id!==p.id&&!['ready','close'].includes(c?.stage))return '공동 우승자의 차례 · 카메라 연출이 끝나면 던지세요';
 return {ready:'우승! 던지기 → 폰을 당겨 카메라 낚아채기 → 시계 방향 릴 감기',casting:'카메라를 향해 던지는 중…',bite:'폰 윗부분을 몸 안쪽으로 당겨 카메라를 낚아채세요!',reeling:'시계 방향으로 릴을 감아 카메라를 얼굴까지 끌어오세요',close:'얼굴까지 도착! 던지기로 세리머니를 다시 시작하세요'}[c?.id===p.id?c.stage:'ready'];
}
