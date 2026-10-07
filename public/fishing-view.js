import * as THREE from '/vendor/three.module.js';
import {catchPose,CATCH_DURATION,ceremonyPose} from './fishing-effects.js';

// The phone camera stays at the angler's eye: server distance moves the catch.
export async function createFishingView(canvas) {
 const data=await fetch('/fishing-models.json').then(r=>{if(!r.ok)throw Error('Fishing models unavailable');return r.json();});
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor('#99cfd3');
 const scene=new THREE.Scene();scene.fog=new THREE.Fog('#99cfd3',35,95);
 scene.add(new THREE.HemisphereLight('#fff6dc','#277483',2.4));
 const sun=new THREE.DirectionalLight('#fff0cf',2.5);sun.position.set(-14,25,12);scene.add(sun);
 const camera=new THREE.PerspectiveCamera(58,1,.06,130);
 const geometry=new THREE.BoxGeometry(),materials=new Map();
 const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.85}));return materials.get(color);};
 function box(parent,size,pos,color){const mesh=new THREE.Mesh(geometry,material(color));mesh.scale.set(...size);mesh.position.set(...pos);parent.add(mesh);return mesh;}
 function model(parts,color='#edbc56'){const group=new THREE.Group(),colors=new Map(),pose=new THREE.Object3D();
  for(const part of parts){const tint=part.color==='@color'?color:part.color;if(!colors.has(tint))colors.set(tint,[]);colors.get(tint).push(part);}
  for(const [color,parts] of colors){const mesh=new THREE.InstancedMesh(geometry,material(color),parts.length);parts.forEach((part,i)=>{pose.position.set(...part.pos);pose.scale.set(...part.size);pose.rotation.set(...part.rotation);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);});group.add(mesh);}return group;
 }
 const sea=new THREE.Mesh(new THREE.PlaneGeometry(240,240),material('#197e91'));sea.rotation.x=-Math.PI/2;scene.add(sea);
 const boat=model(data.boat);boat.visible=false;scene.add(boat);
 const champion=new THREE.Group();scene.add(champion);let championId,championDistance=34;
 const waveParts=[];for(let i=0;i<180;i++){const a=i*2.399,r=6+Math.sqrt(i/180)*65;waveParts.push({size:[.5+i%4*.3,.015,.045],pos:[Math.sin(a)*r,.025,Math.cos(a)*r],rotation:[0,0,0],color:i%2?'#56adb3':'#32959f'});}const waves=model(waveParts);scene.add(waves);
 const float=new THREE.Group();box(float,[.18,.25,.18],[0,.13,0],'#fff4d6');box(float,[.18,.25,.18],[0,.38,0],'#f34e38');box(float,[.04,.36,.04],[0,.68,0],'#ffe4a6');float.scale.setScalar(1.25);scene.add(float);
 const ripple=new THREE.Mesh(new THREE.RingGeometry(.3,.34,40),new THREE.MeshBasicMaterial({color:'#b6eee0',transparent:true,opacity:.55,side:THREE.DoubleSide}));ripple.rotation.x=-Math.PI/2;scene.add(ripple);
 const fish=new THREE.Group();scene.add(fish);let species;
 const rod=model(data.rod);scene.add(rod);
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:'#fff3ce',transparent:true,opacity:.85}));scene.add(line);
 const target=new THREE.Vector3(),position=new THREE.Vector3(),eye=new THREE.Vector3(),look=new THREE.Vector3(),tip=new THREE.Vector3();
 let player,state,receivedAt=0,active=false,initialized=false,last=0,frameId;
 function render(now){frameId=requestAnimationFrame(render);if(!active||document.hidden||!canvas.clientWidth||matchMedia('(orientation: portrait)').matches)return;
  const dt=Math.min(.05,(now-last)/1000||.016);last=now;
  const w=canvas.clientWidth,h=canvas.clientHeight;
  if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const p=player,f=p.fishing,visible=state?.phase!=='finished'&&['casting','waiting','bite','fighting'].includes(f.stage);
  const elapsed=(state?.fishing.elapsed||0)+Math.min(.15,(now-receivedAt)/1000);
  const caught=state?.fishing.catches?.findLast(e=>e.playerId===p.id&&elapsed-e.at<CATCH_DURATION);
  const ceremony=state?.phase==='finished'&&state.fishing.ceremony;
  const fov=caught&&!ceremony?88:58;if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
  boat.visible=Boolean(caught||ceremony);champion.visible=Boolean(ceremony);
  const forward=new THREE.Vector3(Math.sin(p.yaw),0,Math.cos(p.yaw));
  eye.set(p.x,p.y+1.65,p.z).addScaledVector(forward,.15);camera.position.copy(eye);
  target.set(visible?f.fishX:p.x+forward.x*9,.08+(visible?f.bob:0),visible?f.fishZ:p.z+forward.z*9);
  if(!initialized){position.copy(target);initialized=true;}else position.lerp(target,1-Math.exp(-dt*12));
  // Tracking turns the head, never moving the eye toward the fish.
  look.copy(position);look.y=.35;camera.lookAt(look);
  float.visible=ripple.visible=line.visible=visible;float.position.copy(position);float.rotation.z=f.stage==='bite'?Math.sin(now*.026)*.24:Math.sin(now*.002)*.035;
  ripple.position.set(position.x,.035,position.z);ripple.scale.setScalar(1+Math.sin(now*.005)*.1+(f.stage==='bite'?.4:0));
  fish.visible=f.stage==='fighting';fish.position.set(position.x,.15,position.z);fish.scale.setScalar(.62);
  fish.rotation.y=p.yaw+Math.PI/2+f.direction*.45+Math.sin(now*.007)*.12;fish.rotation.z=Math.sin(now*.009)*.08;
  // Hold the rod at the lower edge of the first-person view.
  rod.position.copy(eye).addScaledVector(forward,.35);rod.position.x-=Math.cos(p.yaw)*.75;rod.position.z+=Math.sin(p.yaw)*.75;rod.position.y-=1.05;rod.rotation.set(f.stage==='casting'?-.5:-.12,p.yaw+.18,0);rod.scale.setScalar(.55);
  tip.set(0,.81,1.96).applyEuler(rod.rotation).add(rod.position);
  const points=line.geometry.attributes.position;points.setXYZ(0,tip.x,tip.y,tip.z);points.setXYZ(1,position.x,position.y+.45,position.z);points.needsUpdate=true;line.geometry.computeBoundingSphere();
  waves.position.y=Math.sin(now*.0015)*.013;
  if(caught&&!ceremony){const pose=catchPose(caught,elapsed);fish.visible=true;fish.position.set(...pose.position);fish.rotation.set(...pose.rotation);fish.scale.setScalar(pose.scale);float.visible=ripple.visible=line.visible=false;camera.lookAt(0,3.4,0);rod.visible=false;}else rod.visible=!ceremony;
  if(ceremony){const winner=state.players.find(p=>p.id===ceremony.id);if(winner){
   if(championId!==winner.id){champion.traverse(n=>{if(n.isInstancedMesh)n.dispose();});champion.clear();champion.add(model(data.actor,winner.color));const winnerRod=model(data.rod);winnerRod.name='rod';winnerRod.position.set(.1,1.18,.62);champion.add(winnerRod);championId=winner.id;championDistance=ceremony.distance;}
   champion.position.set(winner.x,winner.y,winner.z);champion.rotation.y=winner.yaw;
   const winnerRod=champion.getObjectByName('rod');winnerRod.rotation.x=ceremony.stage==='casting'?-.65:ceremony.stage==='reeling'?-.18:0;winnerRod.visible=championDistance>3;
   championDistance+=(ceremony.distance-championDistance)*(1-Math.exp(-dt*10));const pose=ceremonyPose(winner,{distance:championDistance});camera.position.set(...pose.eye);camera.lookAt(...pose.target);float.visible=ripple.visible=line.visible=fish.visible=false;
  }}else championId=null;
  renderer.render(scene,camera);
 }
 frameId=requestAnimationFrame(render);
 return {update(p,m){if(player?.id!==p.id||player?.fishing.stage==='ready'&&p.fishing.stage==='casting')initialized=false;player=p;state=m;receivedAt=performance.now();active=true;
  if(species!==p.fishing.species){fish.traverse(n=>{if(n.isInstancedMesh)n.dispose();});fish.clear();fish.add(model(data.fishModels[p.fishing.species]));species=p.fishing.species;}},hide(){active=false;initialized=false;},dispose(){active=false;cancelAnimationFrame(frameId);scene.traverse(n=>{if(n.isInstancedMesh)n.dispose();if(n.geometry&&n.geometry!==geometry)n.geometry.dispose();});materials.forEach(m=>m.dispose());ripple.material.dispose();line.material.dispose();geometry.dispose();renderer.dispose();}};
}
