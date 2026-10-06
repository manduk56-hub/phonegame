export function drawRaceMinimap(canvas,state,id,time=performance.now()){
  if(!state?.circuit)return;
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,b=state.circuit.bounds;
  const scale=Math.min((w-24)/(b.maxX-b.minX),(h-24)/(b.maxZ-b.minZ));
  const point=p=>[w/2+(p.x-(b.minX+b.maxX)/2)*scale,h/2+(p.z-(b.minZ+b.maxZ)/2)*scale];
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#13232ddd';ctx.fillRect(0,0,w,h);
  ctx.beginPath();state.circuit.points.forEach((p,i)=>{const [x,y]=point(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();
  ctx.lineJoin='round';ctx.strokeStyle='#637b83';ctx.lineWidth=7;ctx.stroke();ctx.strokeStyle='#d0ddd6';ctx.lineWidth=2;ctx.stroke();
  for(const p of state.players){if(p.id===id)continue;const [x,y]=point(p);ctx.fillStyle=p.color;ctx.globalAlpha=p.connected?.7:.3;ctx.beginPath();ctx.arc(x,y,2,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;const me=state.players.find(p=>p.id===id);if(!me)return;
  const [x,y]=point(me),radius=4+Math.sin(time/220)*.7;
  ctx.shadowColor=me.color;ctx.shadowBlur=14;ctx.fillStyle=me.color;ctx.beginPath();ctx.arc(x,y,radius+2,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();
}
