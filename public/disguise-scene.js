import * as THREE from '/vendor/three.module.js';
export function createDisguiseScene(canvas,{playerId=null}={}){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor('#182b32');
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-18,18,12,-12,.1,150);camera.position.set(0,30,26);camera.lookAt(0,0,0);
 scene.add(new THREE.HemisphereLight('#fff4dd','#516a78',2));const sun=new THREE.DirectionalLight('#fff4dd',2);sun.position.set(-10,20,12);scene.add(sun);
 const world=new THREE.Group();scene.add(world);const actors=new Map(),rings=new THREE.Group();scene.add(rings);let state,mapId,live=true;
 const materials=new Map(),geo=new THREE.BoxGeometry(1,1,1);
 const mat=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.9}));return materials.get(color);};
 function box(root,w,h,d,x,y,z,color){const o=new THREE.Mesh(geo,mat(color));o.scale.set(w,h,d);o.position.set(x,y,z);root.add(o);return o;}
 function build(map){world.clear();for(const a of actors.values())scene.remove(a);actors.clear();box(world,30,.2,22,0,-.1,0,map.floor);
  for(let x=-15;x<=15;x+=3)box(world,.025,.015,22,x,.015,0,'#7d8f91');for(let z=-11;z<=11;z+=2)box(world,30,.015,.025,0,.015,z,'#7d8f91');
  for(const p of map.props){box(world,p.w,p.h,p.d,p.x,p.h/2,p.z,p.color);if(map.id==='gallery')box(world,p.w*.65,.7,.06,p.x,p.h*.6,p.z+p.d/2+.04,'#eed393');if(map.id==='warehouse')box(world,p.w*.8,.22,p.d*.8,p.x,p.h+.11,p.z,'#b79567');}
  box(world,30,.35,.2,0,.175,-11,'#3e555f');box(world,.2,.35,22,-15,.175,0,'#3e555f');box(world,.2,.35,22,15,.175,0,'#3e555f');
 }
 function actor(map){const a=new THREE.Group();box(a,.55,.65,.33,0,.85,0,map.coat);box(a,.38,.38,.36,0,1.38,0,'#e5bf97');box(a,.4,.12,.38,0,1.61,0,map.id==='warehouse'?'#ffe18a':'#303d49');box(a,.08,.05,.035,-.09,1.4,.19,'#253440');box(a,.08,.05,.035,.09,1.4,.19,'#253440');const legs=[];for(const x of [-.15,.15])legs.push(box(a,.16,.5,.2,x,.25,0,'#34434b'));for(const x of [-.38,.38])box(a,.15,.52,.18,x,.85,0,map.coat);if(map.id==='warehouse')box(a,.5,.3,.4,0,.78,.4,'#b79567');a.userData.legs=legs;scene.add(a);return a;}
 const ringGeo=new THREE.RingGeometry(.55,.7,24),ringMaterial=new THREE.MeshBasicMaterial({color:'#ffba58',side:THREE.DoubleSide,depthTest:false});
 function ring(x,z,color){const r=new THREE.Mesh(ringGeo,color==='self'?selfMat:ringMaterial);r.rotation.x=-Math.PI/2;r.position.set(x,.04,z);rings.add(r);}
 const selfMat=new THREE.MeshBasicMaterial({color:'#b3f5ee',side:THREE.DoubleSide,depthTest:false});
 function update(m){state=m;const s=m.disguise;if(mapId!==s.map.id){mapId=s.map.id;build(s.map);}rings.clear();const people=[...s.npcs,...m.players.filter(p=>m.phase==='lobby'?p.connected:p.alive&&p.participating)],present=new Set();for(const p of people){present.add(p.id);if(!actors.has(p.id))actors.set(p.id,actor(s.map));const a=actors.get(p.id);a.position.set(p.x,0,p.z);a.rotation.y=p.yaw||0;a.userData.moving=p.moving;if(p.id===playerId)ring(p.x,p.z,'self');if(p.exposed>0)ring(p.x,p.z,'exposed');}for(const [id,a]of actors)if(!present.has(id)){scene.remove(a);actors.delete(id);}for(const p of s.revealPoints||[])ring(p.x,p.z,'reveal');}
 function frame(t){if(!live)return;requestAnimationFrame(frame);if(!canvas.clientWidth||document.hidden)return;const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);const aspect=w/h,halfH=Math.max(12,17/aspect);camera.left=-halfH*aspect;camera.right=halfH*aspect;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();if(state?.disguise.curtain>0){renderer.setClearColor('#11191d');renderer.clear();return;}renderer.setClearColor('#182b32');for(const a of actors.values())for(let i=0;i<2;i++)a.userData.legs[i].rotation.x=a.userData.moving?Math.sin(t*.009+i*Math.PI)*.4:0;renderer.render(scene,camera);}
 requestAnimationFrame(frame);return {update,dispose(){live=false;geo.dispose();ringGeo.dispose();ringMaterial.dispose();selfMat.dispose();for(const m of materials.values())m.dispose();renderer.dispose();}};
}
