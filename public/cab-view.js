import {createWaterTerrain} from './water-view.js';
import * as THREE from '/vendor/three.module.js';

// Local rendering from the authoritative match state, with no video streams.
export function createCabView(canvas, status) {
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'});}
  catch{status.textContent='이 브라우저에서 3D 화면을 사용할 수 없습니다.';return {update(){},offline(){}};}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  const scene=new THREE.Scene();scene.background=new THREE.Color('#b9c6b1');
  scene.fog=new THREE.Fog('#b9c6b1',45,120);
  scene.add(new THREE.HemisphereLight(0xe4f2ff,0x786346,2));
  const sun=new THREE.DirectionalLight(0xfff2d4,2);sun.position.set(-12,30,18);scene.add(sun);
  const waterTerrain=createWaterTerrain(scene);
  const camera=new THREE.PerspectiveCamera(75,1,.08,150);
  const materials=new Map(),geometry=new THREE.BoxGeometry(1,1,1);
  const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshLambertMaterial({color}));return materials.get(color);};
  function box(parent,size,pos,color){const mesh=new THREE.Mesh(geometry,typeof color==='string'?material(color):color);mesh.scale.set(...size);mesh.position.set(...pos);parent.add(mesh);return mesh;}
  function batch(group){
    const groups=new Map();
    for(const child of [...group.children]){
      if(child.isGroup)batch(child);
      if(!child.isMesh||child.isInstancedMesh||child.userData.dynamic)continue;
      if(!groups.has(child.material))groups.set(child.material,[]);groups.get(child.material).push(child);
    }
    for(const [mat,parts] of groups){
      const mesh=new THREE.InstancedMesh(geometry,mat,parts.length);
      parts.forEach((part,i)=>{part.updateMatrix();mesh.setMatrixAt(i,part.matrix);group.remove(part);});
      mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;group.add(mesh);
    }
  }
  function remove(group){scene.remove(group);group.traverse(n=>{if(n.isInstancedMesh)n.dispose();});}
  let terrain;
  const asphaltCanvas=document.createElement('canvas');asphaltCanvas.width=asphaltCanvas.height=256;
  const asphaltContext=asphaltCanvas.getContext('2d'),asphaltPixels=asphaltContext.createImageData(256,256);
  let grainSeed=42;
  for(let i=0;i<asphaltPixels.data.length;i+=4){
    grainSeed=(Math.imul(grainSeed,1664525)+1013904223)>>>0;
    const shade=(grainSeed>>>24)%19-9;
    asphaltPixels.data.set([49+shade,53+shade,59+shade,255],i);
  }
  asphaltContext.putImageData(asphaltPixels,0,0);
  const asphaltTexture=new THREE.CanvasTexture(asphaltCanvas);
  asphaltTexture.wrapS=asphaltTexture.wrapT=THREE.RepeatWrapping;
  asphaltTexture.colorSpace=THREE.SRGBColorSpace;
  const asphaltMaterial=new THREE.MeshLambertMaterial({map:asphaltTexture});
  function makeTerrain(size){
    if(terrain)remove(terrain);
    terrain=new THREE.Group();scene.add(terrain);
    const roadLength=size*5;
    asphaltTexture.repeat.set(size/8,roadLength/8);
    box(terrain,[size,.5,roadLength],[0,-.3,0],asphaltMaterial);
    const roadHalf=size/2-2,laneWidth=roadHalf/4;
    for(const side of [-1,1]){
      box(terrain,[size*3,.4,roadLength],[side*(size/2+4+size*1.5),-.25,0],'#4f793b');
      box(terrain,[.16,.012,roadLength],[side*.22,-.032,0],'#e8b83f');
      box(terrain,[.18,.012,roadLength],[side*roadHalf,-.032,0],'#e4e3d9');
      for(let lane=1;lane<4;lane++)for(let z=-roadLength/2+2;z+1.5<roadLength/2;z+=6){
        box(terrain,[.14,.012,3],[side*lane*laneWidth,-.032,z],'#deded6');
      }
      box(terrain,[4,.3,roadLength],[side*(size/2+2),.05,0],'#93958f');
      box(terrain,[.3,.36,roadLength],[side*(size/2+.15),.08,0],'#c9cbc3');
      box(terrain,[.025,.012,roadLength],[side*(size/2+2.15),.206,0],'#70746f');
      for(let z=-roadLength/2+3;z<roadLength/2;z+=3){
        box(terrain,[3.7,.012,.035],[side*(size/2+2.15),.206,z],'#70746f');
        box(terrain,[.3,.012,.035],[side*(size/2+.15),.266,z],'#93958f');
      }
    }
    batch(terrain);canvas.dataset.mapSize=String(size);
  }
  function pile(parent,radius){
    const group=new THREE.Group();parent.add(group);
    for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++){
      const d=Math.hypot(x,z);if(d>4.4)continue;
      const h=Math.max(.2,(4.6-d)*.55);
      box(group,[radius/4.4,h,radius/4.4],[x*radius/4.4,h/2,z*radius/4.4],['#c29652','#cca35e','#d7b374'][(x*x+z*z)%3]);
    }return group;
  }
  const central=pile(scene,4.3),vehicles=new Map(),groundPiles=new Map();let zones=[],teamCount=0,state,ownId,updates=0;
  batch(scene);
  function vehicle(p){
    const root=new THREE.Group(),upper=new THREE.Group();scene.add(root);root.add(upper);upper.position.y=1.45;
    const paint=new THREE.MeshLambertMaterial({color:state.teams[p.team].color}),dark='#303740';
    for(const side of [-1,1]){
      box(root,[.48,.48,2.1],[side*.65,.35,0],dark);
      for(let n=0;n<10;n++)box(root,[.55,.09,.1],[side*.65,.6,-.96+n*.21],'#606874');
    }
    box(root,[1.3,.25,1.5],[0,.68,0],dark);
    box(upper,[1.5,.6,1.4],[0,-.25,-.15],paint);box(upper,[1.6,.7,.6],[0,-.15,-.8],paint);
    box(upper,[1.42,.12,.58],[0,.36,-.76],paint);
    for(let n=0;n<4;n++)box(upper,[1.13,.055,.03],[0,.14-n*.13,-1.115],dark);
    const cab=new THREE.Group();upper.add(cab);
    box(cab,[.65,1.1,.85],[-.42,.45,.08],dark);
    box(cab,[.58,.7,.035],[-.42,.55,.52],'#86b0c4');
    box(cab,[.035,.7,.72],[-.755,.55,.1],'#6996ad');
    box(cab,[.8,.15,1],[-.42,1.05,.1],dark);
    const boom=new THREE.Group();upper.add(boom);
    const stick=new THREE.Group();stick.position.z=2.4;boom.add(stick);
    const bucket=new THREE.Group();bucket.position.z=2.1;stick.add(bucket);
    function beam(parent,length,width,height,arch){for(let i=0;i<12;i++){const t=(i+.5)/12;box(parent,[width,height,length/12+.02],[0,Math.sin(t*Math.PI)*arch,t*length],paint);}}
    beam(boom,2.4,.35,.32,.28);beam(stick,2.1,.26,.28,.1);
    const bowl=new THREE.Group();bowl.position.set(0,-.46,-.13);bucket.add(bowl);
    for(const side of [-1,1])box(bucket,[.09,.19,.24],[side*.17,-.015,-.035],dark);
    box(bucket,[.43,.12,.12],[0,0,0],'#858b91');
    box(bucket,[.18,.12,.16],[0,.065,-.1],dark);
    box(bowl,[.95,.12,.7],[0,0,-.2],dark);box(bowl,[.95,.45,.1],[0,.23,.13],dark);
    for(const side of [-1,1])box(bowl,[.1,.4,.7],[side*.45,.18,-.2],dark);
    for(let i=0;i<4;i++)box(bowl,[.12,.09,.26],[-.33+i*.22,-.02,-.6],'#85868a');
    const dirt=box(bowl,[.7,.27,.4],[0,.16,-.15],'#c29652');
    dirt.userData.dynamic=true;
    batch(root);
    const model={root,upper,cab,boom,stick,bucket,dirt,paint,p,initialized:false};vehicles.set(p.id,model);return model;
  }
  function update(m,id){
    state=m;ownId=id;updates++;canvas.dataset.updates=String(updates);canvas.dataset.owner=id;
    const mapSize=m.arena?.size||44;
    if(canvas.dataset.mapSize!==String(mapSize))makeTerrain(mapSize);
    canvas.dataset.players=String(m.players.length);
    if(teamCount!==m.teamCount){
      for(const z of zones)remove(z.root);zones=[];teamCount=m.teamCount;
      for(const t of m.teams){const root=new THREE.Group();scene.add(root);root.position.set(t.x,0,t.z);
        box(root,[6.2,.05,6.2],[0,.025,0],t.color);
        for(const s of [-1,1]){box(root,[6.2,.1,.12],[0,.08,s*3.1],t.color);box(root,[.12,.1,6.2],[s*3.1,.08,0],t.color);}
        const mound=pile(root,2.5);batch(root);zones.push({root,pile:mound});
      }
    }
    waterTerrain.update(m);terrain.visible=!m.water;for(const z of zones)z.root.visible=!m.water;
    central.visible=!m.water&&m.central>0;central.scale.y=Math.max(.025,m.central/4000);
    const loosePresent=new Set((m.groundPiles||[]).map(s=>s.id));
    for(const [key,node] of groundPiles)if(!loosePresent.has(key)){remove(node);groundPiles.delete(key);}
    for(const s of m.groundPiles||[]){
      let node=groundPiles.get(s.id);
      if(!node){node=pile(scene,s.radius);batch(node);groundPiles.set(s.id,node);}
      node.position.set(s.x,0,s.z);node.scale.y=Math.max(.05,Math.min(2.5,s.dirt/40));
    }
    for(const t of m.teams){zones[t.id].pile.visible=t.dirt>0;zones[t.id].pile.scale.y=Math.max(.05,Math.min(2.5,t.dirt/400));}
    const present=new Set(m.players.map(p=>p.id));
    for(const [key,v] of vehicles)if(!present.has(key)){remove(v.root);v.paint.dispose();vehicles.delete(key);}
    for(const p of m.players){const v=vehicles.get(p.id)||vehicle(p);v.p=p;v.paint.color.set(m.teams[p.team].color);v.cab.visible=p.id!==id;v.dirt.visible=p.cargo>0;}
    status.textContent='운전석 시점 · 상부 방향 기준';canvas.dataset.state='live';
  }
  const position=new THREE.Vector3(),target=new THREE.Vector3();let previous=0,frames=0;
  const turn=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
  function frame(now){
    requestAnimationFrame(frame);
    if(document.visibilityState!=='visible'||matchMedia('(orientation: portrait)').matches||canvas.clientWidth===0||now-previous<33)return;
    const dt=Math.min(.1,(now-previous)/1000);previous=now;
    if(!state||!vehicles.has(ownId))return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
    for(const v of vehicles.values()){
      const p=v.p,t=v.initialized?Math.min(1,dt*15):1;v.initialized=true;
      v.root.position.lerp(position.set(p.x,p.y||0,p.z),t);v.root.rotation.y=turn(v.root.rotation.y,p.yaw,t);
      v.upper.rotation.y=turn(v.upper.rotation.y,p.turret,t);
      v.boom.rotation.x=-p.boom;v.stick.rotation.x=-p.stick;v.bucket.rotation.x=p.curl-Math.PI/2;
    }
    scene.updateMatrixWorld(true);
    const own=vehicles.get(ownId),heading=own.root.rotation.y+own.upper.rotation.y;
    camera.position.copy(own.upper.localToWorld(position.set(-.42,.58,.13)));
    target.copy(camera.position).add(position.set(Math.sin(heading),-.16,Math.cos(heading)));camera.lookAt(target);
    waterTerrain.animate(now/1000);renderer.render(scene,camera);canvas.dataset.frames=String(++frames);
    canvas.dataset.drawCalls=String(renderer.info.render.calls);
    // Evidence also lets the browser check that articulation matches server geometry.
    const teeth=own.bucket.localToWorld(position.set(0,-.48,-.73));
    canvas.dataset.bucket=JSON.stringify([teeth.x,teeth.y,teeth.z]);
    canvas.dataset.camera=JSON.stringify([camera.position.x,camera.position.y,camera.position.z]);
  }
  requestAnimationFrame(frame);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='3D 화면이 중단됐습니다. 새로고침해주세요.';});
  return {update,offline(){status.textContent='운전석 연결 대기 중';canvas.dataset.state='offline';}};
}
