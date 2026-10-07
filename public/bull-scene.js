import {createBrickGeometry} from './brick-model.js';
import * as THREE from '/vendor/three.module.js';
export function createBullScene(canvas,{overview=false}={}){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#263841');
  const radius=44,outerRadius=radius+10;
  const scene=new THREE.Scene();scene.fog=new THREE.Fog('#b1c5c7',85,180);
  const camera=overview?new THREE.OrthographicCamera(-60,60,42,-42,.1,250):new THREE.PerspectiveCamera(82,1,.1,200);
  if(overview){camera.position.set(0,65,74);camera.lookAt(0,0,0);}
  // Small camera-relative horn tips keep the arena unobstructed in first person.
  const hornTips=new THREE.Group();hornTips.visible=false;camera.add(hornTips);scene.add(camera);
  for(const side of [-1,1]){
    const from=new THREE.Vector3(side*.30,.27,.07),to=new THREE.Vector3(0,0,0);
    const tip=new THREE.Mesh(new THREE.CylinderGeometry(.006,.075,from.distanceTo(to),8),new THREE.MeshStandardMaterial({color:'#f6e4bf',roughness:.85,flatShading:true}));
    tip.position.copy(from).multiplyScalar(.5);tip.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),to.sub(from).normalize());
    const anchor=new THREE.Group();anchor.add(tip);anchor.userData.side=side;hornTips.add(anchor);
  }
  scene.add(new THREE.HemisphereLight('#fff5d7','#937152',2));
  const light=new THREE.DirectionalLight('#ffe4b3',2);light.position.set(-18,30,12);scene.add(light);
  function mesh(geometry,color){return new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:1}));}
  const floor=mesh(new THREE.CircleGeometry(radius,128),'#dcb37a');floor.rotation.x=-Math.PI/2;scene.add(floor);
  const edge=mesh(new THREE.RingGeometry(radius-.5,radius,128),'#f8d9a0');edge.rotation.x=-Math.PI/2;edge.position.y=.02;scene.add(edge);
  const apron=mesh(new THREE.RingGeometry(radius,outerRadius,128),'#856149');apron.rotation.x=-Math.PI/2;apron.position.y=-.15;scene.add(apron);
  // Round terraced stands and alternating red/cream arena barriers.
  for(let tier=0;tier<4;tier++){
    const stand=mesh(new THREE.CylinderGeometry(radius+3+tier*1.7,radius+3+tier*1.7,.6,96,1,true),'#b8855c');stand.position.y=1+tier*.8;scene.add(stand);
    const seats=mesh(new THREE.RingGeometry(radius+1+tier*1.7,radius+3+tier*1.7,96),tier%2?'#a96748':'#d6a375');seats.rotation.x=-Math.PI/2;seats.position.y=1.3+tier*.8;scene.add(seats);
  }
  const gateWalls=[],gates=new Map();
  for(let i=0;i<160;i++){
    const a=i/160*Math.PI*2,wall=mesh(new THREE.BoxGeometry(1.73,1.55,.35),i%5===0?'#f2dec3':'#b94539');wall.position.set(Math.sin(a)*radius,.775,Math.cos(a)*radius);wall.rotation.y=a;scene.add(wall);
    const post=mesh(new THREE.BoxGeometry(.13,1.9,.5),'#693e2f');post.position.set(Math.sin(a)*radius,.95,Math.cos(a)*radius);post.rotation.y=a;scene.add(post);
    gateWalls.push({angle:a,nodes:[wall,post]});
    for(let t=0;t<3;t++){
      const spectator=mesh(new THREE.BoxGeometry(.35,.52,.35),['#325777','#efe0ab','#704755','#547663'][i%4]);spectator.position.set(Math.sin(a)*(radius+3+t*1.6),1.7+t*.8,Math.cos(a)*(radius+3+t*1.6));scene.add(spectator);
    }
  }
  function createGate(a){
    const g=new THREE.Group();g.position.set(Math.sin(a)*radius,0,Math.cos(a)*radius);g.rotation.y=a;scene.add(g);
    for(const x of [-2.5,2.5]){const post=mesh(new THREE.BoxGeometry(.45,4.2,.7),'#51443a');post.position.set(x,2.1,0);g.add(post);}
    const top=mesh(new THREE.BoxGeometry(5.4,.4,.7),'#51443a');top.position.y=4.2;g.add(top);
    const door=new THREE.Group();g.add(door);
    for(let bar=0;bar<9;bar++){const m=mesh(new THREE.BoxGeometry(.16,3.8,.25),'#667078');m.position.set((bar-4)*.55,1.9,0);door.add(m);}
    for(const y of [.5,3.3]){const m=mesh(new THREE.BoxGeometry(4.8,.16,.3),'#39434c');m.position.y=y;door.add(m);}
    const lamp=mesh(new THREE.BoxGeometry(.8,.3,.35),'#f1bb4d');lamp.position.set(0,4.6,0);g.add(lamp);return {angle:a,group:g,door,lamp,open:0};
  }
  function syncGates(bulls,enabled,dt){
    const active=new Set();
    if(enabled)for(const b of bulls)for(const side of ['from','to']){
      // Destination appears only as the bull approaches; future doors stay hidden.
      if(side==='from'?b.progress>=12:b.distance-b.progress>=12)continue;
      const key=b.id+':'+side;active.add(key);
      if(!gates.has(key))gates.set(key,createGate(b[side]));
      const gate=gates.get(key),open=side==='from'?b.progress<6:true;
      gate.open+=(Number(open)-gate.open)*(1-Math.exp(-16*dt));gate.door.position.y=gate.open*4.2;gate.lamp.material.color.set(open?'#ff6633':'#f1bb4d');
    }
    for(const [key,gate]of gates)if(!active.has(key)){scene.remove(gate.group);gate.group.traverse(n=>{if(n.isMesh){n.geometry.dispose();n.material.dispose();}});gates.delete(key);}
    for(const wall of gateWalls){const visible=![...gates.values()].some(g=>Math.abs(Math.atan2(Math.sin(wall.angle-g.angle),Math.cos(wall.angle-g.angle)))<.077);for(const node of wall.nodes)node.visible=visible;}
  }
  let audioContext;const sounded=new Set();
  canvas.ownerDocument.addEventListener('pointerdown',()=>{audioContext??=new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();},{once:true});
  function clank(){if(audioContext?.state!=='running')return;const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='square';o.frequency.setValueAtTime(280,audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(65,audioContext.currentTime+.14);g.gain.setValueAtTime(.045,audioContext.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.18);o.connect(g);g.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+.18);}
  let models;const materials=new Map(),brickGeometries=new Map();
  const modelReady=fetch('/bull-models.json').then(r=>{if(!r.ok)throw Error('투우 모델을 불러올 수 없습니다');return r.json();}).then(data=>{models=data;if(state)syncActors();});
  function solidModel(role){
    const root=new THREE.Group(),joints={};
    for(const j of models[role].joints){const g=new THREE.Group();g.position.fromArray(j.pos);(j.parent?joints[j.parent]:root).add(g);joints[j.id]=g;}
    for(const p of models[role].parts){const key=role+':'+p.joint;if(!brickGeometries.has(key))brickGeometries.set(key,createBrickGeometry(p));if(!materials.has('brick'))materials.set('brick',new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85,flatShading:true}));const node=new THREE.Mesh(brickGeometries.get(key),materials.get('brick'));node.castShadow=true;joints[p.joint].add(node);
    }return {root,joints};
  }
  function animate(a,p,time,moving){const j=a.joints,run=Math.sin(time*(p.role==='bull'?11:13)),lift=Math.sin((p.lift||0)/.45*Math.PI);
    j.body.position.x=0;j.body.rotation.z=0;j.head.rotation.z=0;
    if(a.cape)a.cape.visible=p.celebrationPose==='cape'&&!p.flight;
    if(p.role==='bull'){j.body.position.y=moving?Math.abs(run)*.06:0;j.head.rotation.x=-lift*.65+(moving?run*.04:0);j.tail.rotation.z=Math.sin(time*5)*.22;for(const [id,sign] of [['legLF',1],['legRF',-1],['legLB',-1],['legRB',1]])j[id].rotation.x=moving?run*.5*sign:0;}
    else {j.body.position.y=moving?Math.abs(run)*.09:0;for(const [side,sign]of [['L',1],['R',-1]]){j['leg'+side].rotation.x=moving?run*.65*sign:0;j['shin'+side].rotation.x=moving?Math.max(0,-run*sign)*.7:0;j['arm'+side].rotation.x=moving?-run*.65*sign:-.15;j['forearm'+side].rotation.x=-.5;}
      if(p.celebrationPose==='tremble'&&!p.flight){const shake=Math.sin(time*28+p.x);j.body.position.x=shake*.045;j.body.rotation.z=shake*.035;j.head.rotation.z=-shake*.07;for(const side of ['L','R']){j['arm'+side].rotation.x=-.5+shake*.08;j['forearm'+side].rotation.x=-1.1;}}
      if(p.celebrationPose==='cape'&&!p.flight){const wave=Math.sin(time*6+p.x)*(p.capeWave||0);j.body.rotation.z=wave*.08;for(const side of ['L','R']){j['arm'+side].rotation.x=-1.1+wave*.18;j['forearm'+side].rotation.x=-.25;}a.cape.position.set(wave*.35,1.12+wave*.12,1.02);a.cape.rotation.set(wave*.12,Math.sin(time*8)*.04, wave*.25);}
    }
  }
  const actors=new Map();let state,playerId,received=0,lastFrame=0;
  // Smooth network steps without head bob, tilt, or following a human's ejection flight.
  let humanView=null;
  function updateHumanView(me,dt){
    const reset=!humanView||humanView.id!==me.id||state.phase==='lobby'||Math.hypot(me.x-humanView.x,me.z-humanView.z)>12&&!me.flight;
    if(reset)humanView={id:me.id,x:me.x,z:me.z,yaw:me.yaw};
    if(me.alive&&!me.flight){
      const blend=1-Math.exp(-18*dt);
      humanView.x+=(me.x-humanView.x)*blend;humanView.z+=(me.z-humanView.z)*blend;
      const turn=Math.atan2(Math.sin(me.yaw-humanView.yaw),Math.cos(me.yaw-humanView.yaw));
      humanView.yaw+=turn*blend;
    }
    return humanView;
  }
  function label(name){const c=document.createElement('canvas');c.width=384;c.height=64;const ctx=c.getContext('2d');ctx.fillStyle='#202b35dd';ctx.fillRect(0,0,384,64);ctx.font='bold 30px sans-serif';ctx.textAlign='center';ctx.fillStyle='white';ctx.fillText(name,192,43);return new THREE.CanvasTexture(c);}
  function actor(p){
    const group=new THREE.Group(),model=solidModel(p.role);group.add(model.root);
    let cape=null;if(p.role==='human'){cape=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.25,6,4),new THREE.MeshStandardMaterial({color:'#db1735',side:THREE.DoubleSide,roughness:.9}));cape.position.set(0,1.12,1.02);cape.visible=false;model.root.add(cape);}
    const text=new THREE.Sprite(new THREE.SpriteMaterial({map:label(p.name),depthTest:false}));text.scale.set(3.3,.55,1);text.position.y=3.6;group.add(text);
    const shadow=mesh(new THREE.CircleGeometry(p.role==='bull'?1.5:.65,24),'#8b704d');shadow.rotation.x=-Math.PI/2;shadow.position.y=.035;scene.add(shadow);
    const arrow=mesh(new THREE.ConeGeometry(.38,1,3),'#fff0b7');arrow.rotation.x=Math.PI/2;arrow.position.y=.1;scene.add(arrow);
    scene.add(group);return {group,model:model.root,joints:model.joints,cape,shadow,arrow,text,role:p.role,previous:null};
  }
  function frame(now){
    const dt=lastFrame?Math.min(.05,(now-lastFrame)/1000):1/60;lastFrame=now;
    requestAnimationFrame(frame);if(canvas.hidden||!canvas.getClientRects().length)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);if(overview){const extent=Math.max(outerRadius*.72,outerRadius*h/w)+3;camera.left=-extent*w/h;camera.right=extent*w/h;camera.top=extent;camera.bottom=-extent;}else camera.aspect=w/h;camera.updateProjectionMatrix();}
    if(state){
      const celebrating=state.phase==='finished'&&state.bull.celebration?.ready;
      if(overview){const extent=celebrating?Math.max(18,18*h/w):Math.max(outerRadius*.72,outerRadius*h/w)+3;camera.left=-extent*w/h;camera.right=extent*w/h;camera.top=extent;camera.bottom=-extent;camera.position.set(0,celebrating?30:65,celebrating?34:74);camera.lookAt(0,0,0);camera.updateProjectionMatrix();}
      const extrapolate=Math.min(.12,(now-received)/1000),elapsed=(state.bull.elapsed||0)+extrapolate;
      const gateMap=state.bull.map==='gates',bulls=state.bull.bulls||[];
      syncGates(bulls,gateMap,dt);
      for(const b of bulls)if(!sounded.has(b.id)){sounded.add(b.id);if(state.phase==='running')clank();}
      for(const p of [...state.players,...bulls]){const a=actors.get(p.id);if(!a)continue;let x=p.x,z=p.z,y=p.y||0;
        if(p.release!==undefined){a.group.visible=elapsed>=p.release&&state.phase==='running';x+=Math.sin(p.yaw)*p.speed*Math.min(extrapolate,Math.max(0,elapsed-p.release));z+=Math.cos(p.yaw)*p.speed*Math.min(extrapolate,Math.max(0,elapsed-p.release));}
        if(p.flight){const t=Math.min(1,(elapsed-p.flight.start)/p.flight.duration);x=p.flight.x+(p.flight.endX-p.flight.x)*t;z=p.flight.z+(p.flight.endZ-p.flight.z)*t;y=40*t*(1-t);a.model.rotation.x=t*7;a.model.rotation.z=t*3;}
        else {a.model.rotation.set(0,p.yaw,0);if(a.previous&&Math.hypot(x-a.previous.x,z-a.previous.z)>.002)a.movingUntil=now+150;const moving=(state.phase==='running'||celebrating)&&(p.role==='bull'?p.stun<=0&&p.speed>0:!celebrating&&now<(a.movingUntil||0));animate(a,p,now/1000,moving);}
        a.group.position.set(x,y,z);a.group.visible=p.release!==undefined?elapsed>=p.release&&state.phase==='running':p.participating!==false||state.phase==='lobby';a.shadow.position.set(x,.03,z);a.shadow.visible=a.group.visible&&!p.flight;a.arrow.position.set(x+Math.sin(p.yaw)*2,.1,z+Math.cos(p.yaw)*2);a.arrow.rotation.z=-p.yaw;a.arrow.visible=overview&&a.group.visible&&!p.flight;
        a.text.visible=overview||celebrating;a.model.visible=overview||celebrating||p.id!==playerId;a.previous={x,z};
      }
      hornTips.visible=false;
      if(!overview&&camera.fov!==(celebrating?50:82)){camera.fov=celebrating?50:82;camera.updateProjectionMatrix();}
      if(!overview&&celebrating){camera.position.set(0,10,21);camera.lookAt(0,1,-3);}
      else if(!overview){const me=state.players.find(p=>p.id===playerId);if(me&&actors.has(me.id)){const a=actors.get(me.id),view=me.role==='human'?updateHumanView(me,dt):{x:a.group.position.x,z:a.group.position.z,yaw:me.yaw};const offset=me.role==='bull'?.1:0;camera.position.set(view.x+Math.sin(view.yaw)*offset,me.role==='bull'?2.8+a.group.position.y:2.48,view.z+Math.cos(view.yaw)*offset);const lift=me.role==='bull'?Math.sin(Math.max(0,me.lift)/.45*Math.PI)*.32:0;hornTips.visible=me.role==='bull';const vertical=Math.tan(THREE.MathUtils.degToRad(camera.fov*.5)),depth=1.28;for(const tip of hornTips.children)tip.position.set(tip.userData.side*vertical*camera.aspect*depth*.68,vertical*depth*.64+lift*.10,-depth);camera.lookAt(camera.position.x+Math.sin(view.yaw)*10,camera.position.y+lift*10,camera.position.z+Math.cos(view.yaw)*10);}}
    }
    renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);
  function dispose(a){scene.remove(a.group,a.shadow,a.arrow);a.text.material.map.dispose();a.text.material.dispose();a.cape?.material.dispose();a.model.traverse(n=>{if(n.isMesh&&![...brickGeometries.values()].includes(n.geometry))n.geometry.dispose();});a.shadow.geometry.dispose();a.shadow.material.dispose();a.arrow.geometry.dispose();a.arrow.material.dispose();}
  function syncActors(){if(!models||!state)return;const all=[...state.players,...(state.bull.bulls||[])];for(const p of all){let a=actors.get(p.id);if(a&&a.role!==p.role){dispose(a);actors.delete(p.id);a=null;}if(!a)actors.set(p.id,actor(p));}for(const [id,a]of actors)if(!all.some(p=>p.id===id)){dispose(a);actors.delete(id);}if(state.phase==='lobby')sounded.clear();}
  return {ready:modelReady,update(m,id){if(m.phase==='running'&&state?.phase!=='running'||playerId!==id)humanView=null;state=m;playerId=id;received=performance.now();syncActors();}};
}
