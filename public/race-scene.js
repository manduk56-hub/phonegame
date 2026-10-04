import * as THREE from '/vendor/three.module.js';
const shapes=await fetch('/car-shapes.json').then(r=>r.json());
const mats=new Map();
const material=color=>{if(!mats.has(color))mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.85}));return mats.get(color);};
const combinedMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.85});
const brickMaterial=combinedMaterial.clone();
brickMaterial.onBeforeCompile=shader=>{
  shader.vertexShader='varying vec3 brickPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nbrickPosition = position;');
  shader.fragmentShader='varying vec3 brickPosition;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nvec3 brickCell=floor(brickPosition*10.0);\nfloat brickGrain=fract(sin(dot(brickCell,vec3(12.9898,78.233,37.719)))*43758.5453);\ndiffuseColor.rgb *= 0.89+floor(brickGrain*3.0)*0.06;');
};
brickMaterial.customProgramCacheKey=()=> 'excavator-brick-skin-v2';
function mergeGroup(root,brick=false){
  const positions=[],normals=[],colors=[];
  for(const child of [...root.children]){
    if(!child.isMesh)continue;child.updateMatrix();const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geometry.applyMatrix4(child.matrix);
    const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),color=child.material.color;
    for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));normals.push(n.getX(i),n.getY(i),n.getZ(i));colors.push(color.r,color.g,color.b);}
    geometry.dispose();child.geometry.dispose();root.remove(child);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const mesh=new THREE.Mesh(geometry,brick?brickMaterial:combinedMaterial);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
}
function box(parent,w,h,d,x,y,z,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function partColor(part,paint){const base=part.color==='paint'?paint:part.color;if(!part.shade)return base;const c=new THREE.Color(base).convertLinearToSRGB().multiplyScalar(part.shade);c.r=Math.min(1,c.r);c.g=Math.min(1,c.g);c.b=Math.min(1,c.b);return '#'+c.convertSRGBToLinear().getHexString();}
export function makeCar(kind,color){
  const root=new THREE.Group(),shape=shapes[kind]||shapes.gt;
    for(const part of shape.parts){const mesh=box(root,...part.size,...part.pos,part.color==='paint'?color:part.color);mesh.rotation.set(...part.rot);}
    for(const part of shape.cylinders){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(part.radius,part.radius,part.height,part.segments),material(part.color));mesh.position.set(...part.pos);if(part.axis==='x')mesh.rotation.z=Math.PI/2;else if(part.axis==='z')mesh.rotation.x=Math.PI/2+(part.tilt||0);root.add(mesh);}
    for(const part of shape.panels){const vertices=[],normals=[],p=part.points;for(let i=1;i<p.length-1;i++){vertices.push(...p[0],...p[i],...p[i+1],...p[0],...p[i+1],...p[i]);if(part.normals)for(const [index,sign]of [[0,1],[i,1],[i+1,1],[0,-1],[i+1,-1],[i,-1]])normals.push(...part.normals[index].map(n=>n*sign));}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));if(normals.length)geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));else geo.computeVertexNormals();root.add(new THREE.Mesh(geo,material(partColor(part,color))));}
  mergeGroup(root,shape.style==='brick');return root;
}
let previewRenderer;
export function renderCarPreview(canvas,kind,color){
  if(!previewRenderer){previewRenderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});previewRenderer.setSize(320,210);previewRenderer.setClearColor('#aab7b1');}
  const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#e5f3ff','#78866a',2.5));const light=new THREE.DirectionalLight('#fff0d6',2.5);light.position.set(-3,7,5);scene.add(light);
  const car=makeCar(kind,color);scene.add(car);box(scene,12,.08,12,0,-.06,0,'#9aa69d');
  const camera=new THREE.OrthographicCamera(-3.4,3.4,2.23,-2.23,.1,30);camera.position.set(5,3.4,6);camera.lookAt(0,.65,0);
  previewRenderer.render(scene,camera);canvas.width=320;canvas.height=210;canvas.getContext('2d').drawImage(previewRenderer.domElement,0,0);
  scene.traverse(n=>n.geometry?.dispose());
}
export function createRaceScene(canvas,{overview=false}={}){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor('#b4cccd');
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  const scene=new THREE.Scene();scene.fog=new THREE.Fog('#b4cccd',100,240);
  scene.add(new THREE.HemisphereLight('#e1f2ff','#677a43',2.2));
  const sun=new THREE.DirectionalLight('#fff1d0',2.4);sun.position.set(-40,65,25);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-80;sun.shadow.camera.right=80;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;scene.add(sun);
  const camera=overview?new THREE.OrthographicCamera(-80,80,50,-50,.1,500):new THREE.PerspectiveCamera(78,1,.1,240);
  const world=new THREE.Group();scene.add(world);const cars=new Map();let latest,id,built=false,lastTime=performance.now(),frame,disposed=false;
  function build(track){
    box(world,200,.3,150,0,-.21,0,'#79965a');
    const points=track.points;
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);
      const road=box(world,track.width,.10,len+.15,(a.x+b.x)/2,.02,(a.z+b.z)/2,'#404a50');road.rotation.y=yaw;
      for(const side of [-1,1]){
        const x=(a.x+b.x)/2+Math.cos(yaw)*side*(track.width/2+.45),z=(a.z+b.z)/2-Math.sin(yaw)*side*(track.width/2+.45);
        const curb=box(world,.9,.18,len+.12,x,.13,z,i%6<3?'#e7ddd0':'#cf6757');curb.rotation.y=yaw;
        const rail=box(world,.25,.6,len+.15,x+Math.cos(yaw)*side*1.6,.4,z-Math.sin(yaw)*side*1.6,'#b6beb5');rail.rotation.y=yaw;
      }
      if(i%6===0){const mark=box(world,.12,.01,len*3,(a.x+b.x)/2,.081,(a.z+b.z)/2,'#c9c9b8');mark.rotation.y=yaw;}
    }
    const a=points[0],b=points[1],yaw=Math.atan2(b.x-a.x,b.z-a.z);
    for(let i=0;i<12;i++)for(let j=0;j<2;j++){
      const localX=(i-5.5),localZ=(j-.5)*.8;
      const flag=box(world,1,.02,.8,a.x+localX*Math.cos(yaw)+localZ*Math.sin(yaw),.09,a.z-localX*Math.sin(yaw)+localZ*Math.cos(yaw),(i+j)%2?'#f6edda':'#1d262c');flag.rotation.y=yaw;
    }
    for(const side of [-1,1])box(world,.4,5,.4,a.x+Math.cos(yaw)*side*7,2.5,a.z-Math.sin(yaw)*side*7,'#334147');
    const gantry=box(world,14,.65,.5,a.x,5,a.z,'#efc369');gantry.rotation.y=yaw;
    // Paddock, grandstands and pixel trees sit away from the racing line.
    for(let i=0;i<5;i++)box(world,18,.8,1.8,25,1+i*.7,-47-i*1.8,i%2?'#e8c482':'#738795');
    box(world,28,3,8,-28,1.5,-48,'#d9ceae');box(world,29,.4,9,-28,3.2,-48,'#555e58');
    for(let i=0;i<36;i++){
      const x=-85+(i%12)*15,z=i<12?-62:i<24?57:65;
      box(world,.55,2,.55,x,1,z,'#766148');box(world,3,3,3,x,3,z,'#496b45');box(world,2,1.5,2,x,5,z,'#678653');
    }
    mergeGroup(world);built=true;
  }
  function update(state,playerId){latest=state;id=playerId;if(!built)build(state.circuit);
    for(const p of state.players){let car=cars.get(p.id);const signature=p.car+p.color;
      if(car?.userData.signature!==signature){if(car){scene.remove(car);car.traverse(n=>n.geometry?.dispose());}car=makeCar(p.car,p.color);car.userData.signature=signature;car.position.set(p.x,0,p.z);car.rotation.y=p.yaw;cars.set(p.id,car);scene.add(car);}
      car.userData.target=p;car.visible=overview||p.id!==id;
    }
    for(const [key,car]of cars)if(!state.players.some(p=>p.id===key)){scene.remove(car);car.traverse(n=>n.geometry?.dispose());cars.delete(key);}
  }
  function render(time){if(disposed)return;frame=requestAnimationFrame(render);if(!latest||!canvas.clientWidth||!canvas.clientHeight)return;
    const dt=Math.min(.1,(time-lastTime)/1000);lastTime=time;const w=canvas.clientWidth,h=canvas.clientHeight;
    if(canvas.width!==Math.floor(w*renderer.getPixelRatio())||canvas.height!==Math.floor(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);
    for(const car of cars.values()){const p=car.userData.target;car.position.lerp(new THREE.Vector3(p.x,0,p.z),Math.min(1,dt*16));car.rotation.y+=Math.atan2(Math.sin(p.yaw-car.rotation.y),Math.cos(p.yaw-car.rotation.y))*Math.min(1,dt*16);}
    if(overview){const halfW=Math.max(76,48*w/h),halfH=halfW*h/w;camera.left=-halfW;camera.right=halfW;camera.top=halfH;camera.bottom=-halfH;camera.position.set(0,100,48);camera.lookAt(0,0,0);}
    else{camera.aspect=w/h;const car=cars.get(id);if(!car)return;const yaw=car.rotation.y;camera.position.set(car.position.x+Math.sin(yaw)*.2,1.35,car.position.z+Math.cos(yaw)*.2);camera.lookAt(camera.position.x+Math.sin(yaw)*20,1.15,camera.position.z+Math.cos(yaw)*20);}
    camera.updateProjectionMatrix();renderer.render(scene,camera);
  }frame=requestAnimationFrame(render);
  return {update,dispose(){disposed=true;cancelAnimationFrame(frame);renderer.dispose();scene.traverse(n=>n.geometry?.dispose());}};
}
