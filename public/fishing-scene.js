import * as THREE from '/vendor/three.module.js';
import {catchPose,CATCH_DURATION,ceremonyPose} from './fishing-effects.js';
const data=await fetch('/fishing-models.json').then(r=>r.json());
export function createFishingScene(canvas){
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
 renderer.setClearColor('#126477');const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#fff5d3','#246778',2.2));
 const sun=new THREE.DirectionalLight('#ffedc5',2.4);sun.position.set(-14,25,12);scene.add(sun);
 const camera=new THREE.OrthographicCamera(-32,32,21,-21,.1,180);camera.position.set(24,48,36);camera.lookAt(0,0,0);
 const winnerCamera=new THREE.PerspectiveCamera(48,1,.05,180);
 const materials=new Map(),boxGeometry=new THREE.BoxGeometry(1,1,1);
 const mat=c=>{if(!materials.has(c))materials.set(c,new THREE.MeshStandardMaterial({color:c,roughness:.9}));return materials.get(c);};
 function box(parent,size,pos,color){const b=new THREE.Mesh(boxGeometry,mat(color));b.scale.set(...size);b.position.set(...pos);parent.add(b);return b;}
 function model(parts,color='#edbc56'){const root=new THREE.Group(),groups=new Map();for(const p of parts){const c=p.color==='@color'?color:p.color;if(!groups.has(c))groups.set(c,[]);groups.get(c).push(p);}const pose=new THREE.Object3D();for(const [color,list]of groups){const mesh=new THREE.InstancedMesh(boxGeometry,mat(color),list.length);list.forEach((p,i)=>{pose.position.set(...p.pos);pose.scale.set(...p.size);pose.rotation.set(...p.rotation);pose.updateMatrix();mesh.setMatrixAt(i,pose.matrix);});mesh.instanceMatrix.needsUpdate=true;root.add(mesh);}return root;}
 function clearModel(root){root.traverse(n=>{if(n.isInstancedMesh)n.dispose();});}
 scene.add(model(data.boat));
 const waves=[];for(let i=0;i<80;i++){const a=i*2.399,r=10+Math.sqrt(i/80)*25;const w=box(scene,[1+(i%4)*.4,.015,.07],[Math.sin(a)*r,.02,Math.cos(a)*r],i%2?'#3b98a4':'#268595');waves.push(w);}
 const actors=new Map(),catches=new Map();let state,receivedAt=0,cameraOwner,cameraDistance=34,lastFrame=0;
 function create(p){const g=new THREE.Group();scene.add(g);const body=model(data.actor,p.color);g.add(body);const rod=model(data.rod);rod.position.set(.1,1.18,.62);body.add(rod);
 const float=new THREE.Group();box(float,[.18,.23,.18],[0,.12,0],'#fff4ce');box(float,[.18,.23,.18],[0,.35,0],'#ed533d');box(float,[.055,.35,.055],[0,.61,0],'#273b40');scene.add(float);
 const fish=model(data.fishModels[p.fishing.species]);scene.add(fish);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:p.color}));scene.add(line);
 const ring=new THREE.Mesh(new THREE.RingGeometry(.65,.85,32),new THREE.MeshBasicMaterial({color:p.color,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.05;g.add(ring);
 return {g,body,rod,float,fish,line,species:p.fishing.species};}
 function update(m){state=m;receivedAt=performance.now();for(const p of m.players){if(!actors.has(p.id))actors.set(p.id,create(p));const a=actors.get(p.id),f=p.fishing;
 a.g.position.set(p.x,p.y,p.z);a.g.rotation.y=p.yaw;a.g.visible=m.phase==='lobby'||p.participating;
 a.body.rotation.z=f.stage==='fighting'?f.direction*.09:0;a.rod.rotation.x=f.stage==='casting'?-.65:f.stage==='fighting'?-.18:0;
 a.float.visible=['casting','waiting','bite','fighting'].includes(f.stage);a.float.position.set(f.fishX,.12+f.bob,f.fishZ);
 if(a.species!==f.species){scene.remove(a.fish);clearModel(a.fish);a.fish=model(data.fishModels[f.species]);scene.add(a.fish);a.species=f.species;}
 a.fish.visible=f.stage==='fighting';a.fish.scale.setScalar(.62);a.fish.position.set(f.fishX,.24,f.fishZ);a.fish.rotation.y=f.direction*Math.PI/2;
 a.line.visible=a.float.visible;const tip=new THREE.Vector3(0,2.7,4.1).applyAxisAngle(new THREE.Vector3(0,1,0),p.yaw).add(a.g.position);
 a.line.geometry.setFromPoints([tip,a.float.position]);}
 for(const [id,a]of actors)if(!m.players.some(p=>p.id===id)){for(const key of ['g','float','fish','line']){scene.remove(a[key]);if(key==='g'||key==='fish')clearModel(a[key]);}a.line.geometry.dispose();a.line.material.dispose();actors.delete(id);}
 const events=m.fishing.catches||[],recent=events.filter(e=>m.fishing.elapsed-e.at<CATCH_DURATION),pile=events.filter(e=>m.fishing.elapsed-e.at>=CATCH_DURATION).slice(-20),visible=[...pile,...recent];
 for(const e of visible)if(!catches.has(e.id)){const mesh=model(data.fishModels[e.species]);scene.add(mesh);catches.set(e.id,{mesh,event:e});}
 for(const [id,v]of catches)if(!visible.some(e=>e.id===id)){scene.remove(v.mesh);clearModel(v.mesh);catches.delete(id);}}
 let running=true;function render(t){if(!running)return;requestAnimationFrame(render);if(canvas.hidden||!canvas.clientWidth||document.hidden)return;
 const dt=Math.min(.05,(t-lastFrame)/1000||.016);lastFrame=t;
 const w=canvas.clientWidth,h=canvas.clientHeight;if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);
 camera.left=-23*w/h;camera.right=23*w/h;camera.top=23;camera.bottom=-23;camera.updateProjectionMatrix();waves.forEach((v,i)=>v.position.x+=Math.sin(t*.0004+i)*.002);
 const elapsed=(state?.fishing.elapsed||0)+Math.min(.15,(t-receivedAt)/1000);
 for(const {mesh,event}of catches.values()){const pose=catchPose(event,elapsed);mesh.position.set(...pose.position);mesh.rotation.set(...pose.rotation);mesh.scale.setScalar(pose.scale);}
 for(const [id,a]of actors){const e=state?.fishing.catches?.findLast(e=>e.playerId===id&&elapsed-e.at<CATCH_DURATION);if(e){const swing=Math.sin(Math.PI*Math.min(1,(elapsed-e.at)/CATCH_DURATION));a.body.rotation.y=Math.PI*swing;a.body.rotation.z=-.15*swing;a.rod.rotation.x=-1.1*swing;}else a.body.rotation.y=0;}
 const c=state?.phase==='finished'&&state.fishing.ceremony,p=c&&state.players.find(p=>p.id===c.id);let view=camera;
 for(const [id,a]of actors){a.rod.visible=!p||p.id!==id||c.distance>3;if(p?.id===id){a.body.rotation.z=c.stage==='reeling'?-.04:0;a.rod.rotation.x=c.stage==='casting'?-.65:c.stage==='reeling'?-.18:0;}}
 if(p){if(cameraOwner!==p.id){cameraOwner=p.id;cameraDistance=c.distance;}cameraDistance+=(c.distance-cameraDistance)*(1-Math.exp(-dt*10));const pose=ceremonyPose(p,{distance:cameraDistance});winnerCamera.aspect=w/h;winnerCamera.updateProjectionMatrix();winnerCamera.position.set(...pose.eye);winnerCamera.lookAt(...pose.target);view=winnerCamera;}else cameraOwner=null;
 renderer.render(scene,view);}
 requestAnimationFrame(render);return {update,state:()=>state,dispose(){running=false;scene.traverse(n=>{if(n.isInstancedMesh)n.dispose();if(n.geometry&&n.geometry!==boxGeometry)n.geometry.dispose();});materials.forEach(v=>v.dispose());boxGeometry.dispose();renderer.dispose();}};
}
