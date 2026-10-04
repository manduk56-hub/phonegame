import * as THREE from '/vendor/three.module.js';
let artPromise;
const loadArt=()=>artPromise??=fetch('/fps-art.json').then(r=>{if(!r.ok)throw Error('FPS art load failed');return r.json();});
export function createFpsScene(canvas,{overview=false}={}){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1)*.9);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  canvas.style.imageRendering='pixelated';
  const scene=new THREE.Scene();scene.background=new THREE.Color('#adb9bc');scene.fog=overview?null:new THREE.Fog('#adb9bc',40,100);
  scene.add(new THREE.HemisphereLight(0xdde7e5,0x64614f,1.4));const sun=new THREE.DirectionalLight(0xffefcc,2.0);sun.position.set(-20,45,22);sun.castShadow=true;sun.shadow.mapSize.set(overview?2048:1024,overview?2048:1024);Object.assign(sun.shadow.camera,{left:-45,right:45,top:45,bottom:-45,near:1,far:100});sun.shadow.bias=-.001;sun.shadow.normalBias=.025;scene.add(sun);
  const camera=overview?new THREE.OrthographicCamera(-43,43,33,-33,.1,200):new THREE.PerspectiveCamera(75,1,.05,120);
  if(overview){camera.position.set(34,40,42);camera.lookAt(0,0,0);}
  let materials={},art,state,playerId,aim,baseSignature='',last=performance.now(),lastShot=0,kick=0;
  function box(w,h,d,x,y,z,color,parent=scene){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:1}));mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
  const ground=box(66,.2,66,0,-.1,0,'#827e63');
  const actors=new Map(),bases=new THREE.Group(),tracers=new THREE.Group();scene.add(bases,tracers);
  const flag=new THREE.Group();scene.add(flag);
  const bright=(w,h,d,x,y,z,color,parent=flag)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshBasicMaterial({color}));mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
  const pole=bright(.12,3.6,.12,-.95,1.8,0,'#fff4bf');
  const banner=new THREE.Group();flag.add(banner);banner.position.y=3.05;
  bright(2.7,1.4,.09,.35,0,0,'#352500',banner);bright(2.6,1.3,.12,.35,0,0,'#ffdc19',banner);bright(.16,1.3,.14,-.25,0,0,'#ffffff',banner);bright(2.6,.14,.14,.35,0,0,'#ffffff',banner);
  const pedestal=bright(.8,.15,.8,0,.075,0,'#ffdc19');
  const pickup=new THREE.Group();scene.add(pickup);
  const disc=new THREE.Mesh(new THREE.CircleGeometry(1,64),new THREE.MeshBasicMaterial({color:'#ffce19',transparent:true,opacity:.20,side:THREE.DoubleSide,depthWrite:false}));disc.rotation.x=-Math.PI/2;disc.position.y=.035;pickup.add(disc);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.95,1,64),new THREE.MeshBasicMaterial({color:'#ffe83e',side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.05;pickup.add(ring);
  const beacon=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,3.6,8),new THREE.MeshBasicMaterial({color:'#ffe83e',transparent:true,opacity:.30,depthWrite:false}));beacon.position.y=1.8;pickup.add(beacon);
  const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=80;const ctx=labelCanvas.getContext('2d');ctx.fillStyle='#352500';ctx.fillRect(0,0,512,80);ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.fillStyle='#ffe83e';ctx.fillText('깃발 · 원 안에서 자동 획득',256,52);
  const labelTexture=new THREE.CanvasTexture(labelCanvas);const marker=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture}));marker.position.y=4.2;marker.scale.set(4.3,.67,1);flag.add(marker);
  const gun=new THREE.Group();gun.position.set(.26,-.19,-.5);gun.rotation.y=Math.PI;camera.add(gun);scene.add(camera);gun.visible=!overview;
  function combine(list){const geometry=new THREE.BufferGeometry();for(const attr of ['position','normal','uv']){const count=list.reduce((n,g)=>n+g.getAttribute(attr).array.length,0),array=new Float32Array(count);let cursor=0;for(const g of list){array.set(g.getAttribute(attr).array,cursor);cursor+=g.getAttribute(attr).array.length;}geometry.setAttribute(attr,new THREE.BufferAttribute(array,attr==='uv'?2:3));}return geometry;}
  function model(parts,teamColor){const root=new THREE.Group(),byMaterial=new Map(),edges=[];
    for(const p of parts){const transform=new THREE.Matrix4().compose(new THREE.Vector3(...p.pos),new THREE.Quaternion().setFromEuler(new THREE.Euler(...p.rot)),new THREE.Vector3(1,1,1));const source=new THREE.BoxGeometry(...p.size);const edge=new THREE.EdgesGeometry(source);edge.applyMatrix4(transform);edges.push(edge);const geo=source.toNonIndexed();source.dispose();geo.applyMatrix4(transform);if(!byMaterial.has(p.mat))byMaterial.set(p.mat,[]);byMaterial.get(p.mat).push(geo);}
    for(const [name,geometries]of byMaterial){const material=name==='team'?new THREE.MeshStandardMaterial({color:teamColor||'#fff',roughness:1}):materials[name];const mesh=new THREE.Mesh(combine(geometries),material);for(const g of geometries)g.dispose();mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);if(name==='team')root.userData.teamMaterial=material;}
    const edgeArray=new Float32Array(edges.reduce((n,g)=>n+g.attributes.position.array.length,0));let offset=0;for(const g of edges){edgeArray.set(g.attributes.position.array,offset);offset+=g.attributes.position.array.length;g.dispose();}const edgeGeometry=new THREE.BufferGeometry();edgeGeometry.setAttribute('position',new THREE.BufferAttribute(edgeArray,3));root.add(new THREE.LineSegments(edgeGeometry,new THREE.LineBasicMaterial({color:'#252b28',transparent:true,opacity:.55})));return root;
  }
  loadArt().then(value=>{art=value;for(const [name,t]of Object.entries(art.textures)){const map=new THREE.DataTexture(new Uint8Array(t.pixels),t.size,t.size);map.colorSpace=THREE.SRGBColorSpace;map.magFilter=map.minFilter=THREE.NearestFilter;map.generateMipmaps=false;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.needsUpdate=true;materials[name]=new THREE.MeshStandardMaterial({map,roughness:1});}
    ground.material=materials.ground.clone();ground.material.map=materials.ground.map.clone();ground.material.map.repeat.set(22,22);ground.material.map.needsUpdate=true;
    scene.add(model(art.world));gun.add(model(art.rifle));
    // Two gloved hands and olive sleeves wrap the actual 3D rifle.
    const hands=[{size:[.14,.14,.22],pos:[.07,-.12,.32],mat:'glove',rot:[0,0,.2]},{size:[.18,.19,.5],pos:[.20,-.18,.10],mat:'olive',rot:[-.1,.45,-.2]},{size:[.11,.14,.14],pos:[-.07,-.14,-.13],mat:'glove',rot:[0,0,0]},{size:[.16,.18,.35],pos:[-.19,-.20,-.18],mat:'olive',rot:[-.3,-.15,.2]}];gun.add(model(hands));
    for(const mesh of gun.children)mesh.traverse(n=>{if(n.isMesh){n.castShadow=false;n.receiveShadow=false;}});
    canvas.dataset.art='ready';if(state)update(state,playerId,aim);
  }).catch(e=>{canvas.dataset.error=e.message;});
  function disposeRoot(root){root.traverse(c=>{c.geometry?.dispose();if(c.isLineSegments)c.material.dispose();});root.userData.teamMaterial?.dispose();}
  function update(m,id,viewAim){state=m;playerId=id;aim=viewAim;if(!art)return;
    const sig=JSON.stringify(m.teams.map(t=>[t.id,t.color,t.x,t.z]));
    if(sig!==baseSignature){for(const c of [...bases.children]){bases.remove(c);c.geometry.dispose();c.material.dispose();}for(const t of m.teams){box(5,.12,5,t.x,.06,t.z,t.color,bases);for(const side of [-1,1]){box(5,.025,.10,t.x,.135,t.z+side*2.3,'#e8dcc0',bases);box(.10,.025,5,t.x+side*2.3,.135,t.z,'#e8dcc0',bases);}}baseSignature=sig;}
    const present=new Set();for(const p of m.players){present.add(p.id);let root=actors.get(p.id);if(!root){root=model(art.actor,m.teams[p.team].color);const rifle=model(art.rifle);rifle.scale.setScalar(.6);rifle.position.set(.03,1.09,.21);root.add(rifle);actors.set(p.id,root);scene.add(root);}root.userData.teamMaterial.color.set(m.teams[p.team].color);root.position.set(p.x,0,p.z);root.rotation.y=p.yaw;root.visible=p.hp>0&&p.connected&&(overview||p.id!==id);}
    for(const [id,root]of actors)if(!present.has(id)){scene.remove(root);disposeRoot(root);actors.delete(id);}
    const carrier=m.players.find(p=>p.id===m.fps.flag.carrier),carrying=Boolean(carrier);
    flag.position.set(carrier?.x??m.fps.flag.x,carrying?2.2:0,carrier?.z??m.fps.flag.z);
    flag.visible=overview||carrier?.id!==id;pole.scale.y=carrying?.5:1;pole.position.y=carrying?.9:1.8;banner.position.y=carrying?.9:3.05;marker.visible=!carrying;pedestal.visible=!carrying;
    const radius=m.fps.flag.pickupRadius??2.5;pickup.position.set(m.fps.flag.x,0,m.fps.flag.z);disc.scale.set(radius,radius,1);ring.scale.set(radius,radius,1);pickup.visible=!carrying;
    canvas.dataset.flagMode=carrying?'carried':'ground';canvas.dataset.pickupRadius=String(radius);
    for(const line of [...tracers.children]){tracers.remove(line);line.geometry.dispose();line.material.dispose();}
    for(const s of m.fps.shots){const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(s.x,s.y,s.z),new THREE.Vector3(s.ex,s.ey,s.ez)]);tracers.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#ffdc82'})));if(s.player===id&&s.id>lastShot){kick=.06;lastShot=s.id;}}
  }
  function frame(now){requestAnimationFrame(frame);if(!state||!art||!canvas.isConnected||canvas.closest('[hidden]'))return;const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;
    const dt=Math.min(.1,(now-last)/1000);last=now;
    if(canvas.width!==Math.floor(width*renderer.getPixelRatio())||canvas.height!==Math.floor(height*renderer.getPixelRatio())){renderer.setSize(width,height,false);if(overview){camera.left=-33*width/height;camera.right=33*width/height;}else camera.aspect=width/height;camera.updateProjectionMatrix();}
    if(!overview){const p=state.players.find(p=>p.id===playerId);if(p){camera.position.set(p.x,state.fps.arena.eye,p.z);const yaw=aim?.yaw??p.yaw,pitch=aim?.pitch??p.pitch;camera.lookAt(p.x+Math.sin(yaw)*Math.cos(pitch),camera.position.y+Math.sin(pitch),p.z+Math.cos(yaw)*Math.cos(pitch));gun.visible=p.hp>0;kick=Math.max(0,kick-dt*.5);gun.position.z=-.5+kick;}}
    flag.rotation.y=Math.atan2(camera.position.x-flag.position.x,camera.position.z-flag.position.z);renderer.render(scene,camera);canvas.dataset.draws=String(renderer.info.render.calls);canvas.dataset.frames=String(Number(canvas.dataset.frames||0)+1);
  }requestAnimationFrame(frame);return {update};
}
