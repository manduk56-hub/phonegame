import * as THREE from '/vendor/three.module.js';
import {decodeSurface,groundGeometry,waterGeometry} from './water-surface.js';

export function createWaterTerrain(scene){
  const root=new THREE.Group();scene.add(root);
  const geometry=new THREE.BoxGeometry(1,1,1),materials=new Map();let signature='',surfaces=[],falls=[];
  const material=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshLambertMaterial({color}));return materials.get(color);};
  const dirtMaterial=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  const waterMaterial=new THREE.MeshLambertMaterial({color:'#50cfe4',side:THREE.DoubleSide});
  function box(parent,size,pos,color){const mesh=new THREE.Mesh(geometry,material(color));mesh.scale.set(...size);mesh.position.set(...pos);parent.add(mesh);return mesh;}
  function update(m){
    root.visible=Boolean(m.water)&&m.phase!=='finished';if(!m.water)return;const w=m.water;
    const key=JSON.stringify([m.excavatorMap.id,m.teamCount,w.rows,w.cols,w.size,w.start,w.lanes.map(l=>[l.x,l.z,l.angle])]);
    if(signature!==key){
      for(const surface of surfaces){surface.ground.geometry.dispose();surface.flow.geometry.dispose();}
      root.clear();surfaces=[];falls=[];signature=key;
      box(root,[m.teamCount*7.8+2.2,.3,(w.rows-1)*w.size+5],[0,-1.05,w.start+(w.rows-1)*w.size/2],'#56815b');
      for(const lane of w.lanes){
        const bank=new THREE.Group();root.add(bank);bank.rotation.y=lane.angle;bank.position.set(lane.x,0,lane.z);
        const len=(w.rows-1)*w.size,mid=w.start+len/2,width=(w.cols-1)*w.size;
        for(const side of [-1,1])box(bank,[3,.9,len+4],[side*(width/2+1.5),-.45,mid],'#759368');
        box(bank,[7.8,4.2,2],[0,1.3,w.start-1.3],'#68766a');
        const fall=box(bank,[3.8,3.9,.15],[0,1.55,w.start-.22],'#7cdeef');falls.push(fall);fall.userData.streaks=[];
        for(let i=0;i<6;i++){const streak=box(bank,[.05,.55,.04],[(i-2.5)*.55,0,w.start-.11],'#e2fbff');streak.userData.offset=i/6;fall.userData.streaks.push(streak);}
        box(bank,[width+.6,.09,.13],[0,.06,w.start+len],m.teams[lane.team].color);
        box(bank,[width+.6,.06,.13],[0,.12,w.start+len+.2],'#fff2cd');
        const ground=new THREE.Mesh(new THREE.BufferGeometry(),dirtMaterial),flow=new THREE.Mesh(new THREE.BufferGeometry(),waterMaterial);bank.add(ground,flow);
        surfaces.push({ground,flow,revision:-1,encoded:''});
      }
    }
    w.lanes.forEach((lane,i)=>{
      const surface=surfaces[i];if(surface.encoded===lane.surface)return;surface.encoded=lane.surface;
      const {depth,wet}=decodeSurface(lane.surface,w.rows*w.cols);
      if(surface.revision!==lane.revision){
        surface.revision=lane.revision;const mesh=groundGeometry(w,depth),g=new THREE.BufferGeometry();surface.ground.geometry.dispose();surface.ground.geometry=g;
        g.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));g.setAttribute('normal',new THREE.BufferAttribute(mesh.normals,3));g.setAttribute('color',new THREE.BufferAttribute(mesh.colors,3));g.setIndex(new THREE.BufferAttribute(mesh.indices,1));g.computeBoundingSphere();
      }
      const points=waterGeometry(w,depth,wet),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(points,3));g.computeVertexNormals();g.computeBoundingSphere();surface.flow.geometry.dispose();surface.flow.geometry=g;
      surface.flow.visible=points.length>0;
    });
  }
  function animate(time){for(const fall of falls){fall.material.color.setHSL(.52,.65,.65+Math.sin(time*4)*.08);for(const streak of fall.userData.streaks)streak.position.y=3.4-((time*1.2+streak.userData.offset)%1)*3.6;}}
  return {update,animate,root};
}

export function createWaterOverview(canvas){
  let renderer;try{renderer=new THREE.WebGLRenderer({canvas,antialias:true});}catch{return {update(){}};}
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));const scene=new THREE.Scene();scene.background=new THREE.Color('#bccdb9');
  scene.add(new THREE.HemisphereLight(0xe7f6ff,0x786346,2.5));const light=new THREE.DirectionalLight(0xfff4d9,2);light.position.set(10,30,20);scene.add(light);
  const camera=new THREE.PerspectiveCamera(48,1,.1,200);camera.position.set(35,44,40);camera.lookAt(0,0,0);
  const terrain=createWaterTerrain(scene);let state;
  const markers=new THREE.Group();scene.add(markers);const shape=new THREE.BoxGeometry(1.3,.9,2);
  const paints=Array.from({length:8},()=>new THREE.MeshLambertMaterial());
  function update(m){state=m;terrain.update(m);const distance=Math.max(26,m.teamCount*4.5+12);camera.position.set(distance*.8,distance,distance);camera.lookAt(0,0,0);markers.clear();for(const p of m.players){paints[p.team].color.set(m.teams[p.team].color);const mesh=new THREE.Mesh(shape,paints[p.team]);mesh.position.set(p.x,(p.y||0)+.6,p.z);mesh.rotation.y=p.yaw;markers.add(mesh);}}
  function frame(time){requestAnimationFrame(frame);if(canvas.hidden||!state||!canvas.clientWidth)return;const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();terrain.animate(time/1000);renderer.render(scene,camera);}requestAnimationFrame(frame);
  return {update};
}
