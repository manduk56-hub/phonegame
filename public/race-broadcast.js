import {createRaceScene} from './race-scene.js';
import {drawRaceMinimap} from './race-minimap.js';
export function createRaceBroadcast(parent){
  const root=document.createElement('section');root.className='race-broadcast';parent.append(root);
  const main=document.createElement('article');main.className='race-feature';root.append(main);
  const canvas=document.createElement('canvas'),label=document.createElement('div');main.append(canvas,label);
  const mini=document.createElement('canvas');mini.width=180;mini.height=112;mini.className='race-mini';main.append(mini);
  // One renderer renders every camera, then copies into the tiles. No per-driver WebGL contexts.
  const source=document.createElement('canvas');source.style.cssText='position:absolute;width:960px;height:540px;visibility:hidden;pointer-events:none';root.append(source);
  const scene=createRaceScene(source,{viewMode:'isometric',autoRender:false});
  const grid=document.createElement('div');grid.className='race-camera-grid';root.append(grid);const tiles=new Map();let latest,last=0,lastTiles=0,frame;
  function update(m){latest=m;const present=new Set(m.players.map(p=>p.id));
    for(const [id,t]of tiles)if(!present.has(id)){t.root.remove();tiles.delete(id);}
    for(const p of m.players){if(tiles.has(p.id))continue;const tile=document.createElement('article'),view=document.createElement('canvas'),caption=document.createElement('div');tile.append(view,caption);grid.append(tile);tiles.set(p.id,{root:tile,view,caption});}
    root.style.setProperty('--camera-columns',m.players.length>8?'3':'2');root.style.setProperty('--camera-rows',String(Math.max(1,Math.ceil(m.players.length/(m.players.length>8?3:2)))));root.hidden=m.phase==='lobby'||!m.players.length;
  }
  function copy(target){const w=Math.max(1,Math.round(target.clientWidth)),h=Math.max(1,Math.round(target.clientHeight));if(target.width!==w||target.height!==h){target.width=w;target.height=h;}target.getContext('2d').drawImage(source,0,0,w,h);}
  function render(time){frame=requestAnimationFrame(render);if(root.hidden||!latest||time-last<33)return;last=time;
    const featured=latest.players.find(p=>p.id===latest.race.broadcast?.id)||latest.players.find(p=>p.connected)||latest.players[0];if(!featured)return;
    if(time-lastTiles>=100){lastTiles=time;for(const p of latest.players){const t=tiles.get(p.id);source.style.width=t.view.clientWidth+'px';source.style.height=t.view.clientHeight+'px';scene.update(latest,p.id);scene.renderNow(time);copy(t.view);const ctx=t.view.getContext('2d');const inset=document.createElement('canvas');inset.width=180;inset.height=112;drawRaceMinimap(inset,latest,p.id,time);ctx.drawImage(inset,5,5,Math.min(65,t.view.width*.22),Math.min(65,t.view.width*.22)*112/180);t.caption.textContent=`${p.rank}위 · ${p.name} · ${Math.round(Math.abs(p.speed)*3.6)} km/h${p.connected?'':' · 연결 끊김'}`;t.root.classList.toggle('featured',p.id===featured.id);}}
    source.style.width=canvas.clientWidth+'px';source.style.height=canvas.clientHeight+'px';scene.update(latest,featured.id);scene.renderNow(time);copy(canvas);label.textContent=`${latest.race.broadcast?.reason||'순환 중계'} · ${featured.name} · ${Math.round(Math.abs(featured.speed)*3.6)} km/h`;drawRaceMinimap(mini,latest,featured.id,time);
  }
  frame=requestAnimationFrame(render);return {root,update,dispose(){cancelAnimationFrame(frame);scene.dispose();root.remove();}};
}
