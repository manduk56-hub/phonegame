// Shared excavator-inspired finish: small stepped parts, visible hardware,
// framed blue glass and a matte cell surface, while keeping each silhouette.
export function detailCar({m,panel,box,cylinder,line}) {
  m.style='brick';
  m.detailVersion=1;
  // Real shallow blocks, not just a color texture. Clip each tile to its
  // source face so wheel openings and the authored silhouette stay intact.
  const clip=(points,axis,value,above)=>{
    const out=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      const ai=above?a[axis]>=value:a[axis]<=value,bi=above?b[axis]>=value:b[axis]<=value;
      if(ai)out.push(a);
      if(ai!==bi){const t=(value-a[axis])/(b[axis]-a[axis]);out.push(a.map((v,k)=>v+(b[k]-v)*t));}
    }
    return out;
  };
  for(const face of m.panels.slice(0,m.bodyPanelCount)){
    const [a,b,c]=face.points,ab=b.map((v,k)=>v-a[k]),ac=c.map((v,k)=>v-a[k]);
    let n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    const length=Math.hypot(...n);if(length<1e-7)continue;
    n=n.map(v=>v/length);
    const center=face.points[0].map((_,k)=>face.points.reduce((sum,p)=>sum+p[k],0)/face.points.length);
    const outward=Math.abs(n[1])>.65?[0,center[1]>.5?1:-1,0]:Math.abs(n[0])>.65?[Math.sign(center[0]),0,0]:[0,0,Math.sign(center[2])];
    if(n.reduce((v,x,k)=>v+x*outward[k],0)<0)n=n.map(v=>-v);
    // Relief belongs on the upright body panels. Sloping hood faces keep
    // their connected skin, avoiding tiny intersecting plates at the creases.
    if(Math.abs(n[0])<.85||Math.abs(n[1])>.25)continue;
    const major=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),axes=[0,1,2].filter(k=>k!==major),[u,v]=axes;
    const min=axes.map(k=>Math.min(...face.points.map(p=>p[k]))),max=axes.map(k=>Math.max(...face.points.map(p=>p[k])));
    const step=.16,gap=.0015;
    for(let x=Math.floor(min[0]/step)*step;x<max[0];x+=step)for(let y=Math.floor(min[1]/step)*step;y<max[1];y+=step){
      let piece=face.points;
      for(const [axis,value,above]of [[u,x+gap,true],[u,x+step-gap,false],[v,y+gap,true],[v,y+step-gap,false]])piece=clip(piece,axis,value,above);
      if(piece.length<3)continue;
      const height=.009;
      const raised=piece.map(p=>p.map((value,k)=>value+n[k]*height));
      panel(raised,'paint');
      for(let i=0;i<piece.length;i++)panel([piece[i],piece[(i+1)%piece.length],raised[(i+1)%piece.length],raised[i]],'paint');
    }
  }
  // Rear glazing uses the same inset frame and stepped blue reflections.
  const rearCabin=m.cabin[0],rearRoof=m.cabin[1];
  const backGlass=(u,v)=>{
    const width=rearCabin[1]+(rearRoof[1]-rearCabin[1])*v;
    return [u*width,rearCabin[3]+(rearRoof[3]-rearCabin[3])*v+.016,rearCabin[0]+(rearRoof[0]-rearCabin[0])*v-.010];
  };
  panel([backGlass(-.87,.12),backGlass(.87,.12),backGlass(.87,.86),backGlass(-.87,.86)],'#172830');
  for(let i=0;i<8;i++)for(let j=0;j<4;j++){
    const u=-.78+i*.195,v=.20+j*.14;
    const p=(u,v)=>{const point=backGlass(u,v);point[1]+=.005;point[2]-=.003;return point;};
    panel([p(u,v),p(u+.192,v),p(u+.192,v+.137),p(u,v+.137)],i<2?'#597e93':(i+j)%4===0?'#466c80':'#33566b');
  }
  const at=(z,index)=>{
    const i=m.body.findIndex(p=>p[0]>=z);
    if(i<=0)return m.body[i===0?0:m.body.length-1][index];
    const a=m.body[i-1],b=m.body[i],u=(z-a[0])/(b[0]-a[0]);
    return a[index]+(b[index]-a[index])*u;
  };
  for(const side of [-1,1])for(const axle of m.axles){
    // Raised tread blocks and shoulder marks read like the excavator tracks.
    for(let i=0;i<28;i++){
      const a=i*Math.PI*2/28;
      box([.205,.027,.048],[side*1.017,.43+Math.cos(a)*.431,axle+Math.sin(a)*.431],i%4===0?'#35414a':'#263039',[a,0,0]);
      box([.018,.035,.021],[side*1.15,.43+Math.cos(a)*.389,axle+Math.sin(a)*.389],'#414b53',[a,0,0]);
    }
    // Hub fasteners and a perforated brake disc behind the existing spokes.
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      cylinder(.014,.012,[side*1.163,.43+Math.cos(a)*.245,axle+Math.sin(a)*.245],'#101d25','x',6);
    }
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5;
      cylinder(.015,.018,[side*1.186,.43+Math.cos(a)*.051,axle+Math.sin(a)*.051],'#a1b2bc','x',6);
    }
    cylinder(.034,.020,[side*1.187,.43,axle],'#718794','x',8);
    // Segmented arch lip follows the actual opening rather than covering it.
    for(let i=0;i<12;i++){
      const a=.06+i*(Math.PI-.12)/12,b=.06+(i+1)*(Math.PI-.12)/12;
      const p=t=>{const z=axle+Math.cos(t)*.50;return [side*(at(z,1)+.012),.43+Math.sin(t)*.50,z];};
      line(p(a),p(b),.022,'#4a5355');
    }
  }
  // Upgrade the broad side glass of cars 2–6 with inset stepped reflections.
  // Wedge already has a closed, patch-built greenhouse and keeps that skin.
  if(m.referenceName!=='wedge'){
    const glass=m.panels.filter(p=>p.color==='#344f60');
    for(const p of glass){
      const [A,B,C]=p.points,D=p.points.at(-1),sign=Math.sign(A[0]);
      const surf=(u,v)=>A.map((n,k)=>(n+(B[k]-n)*u)*(1-v)+(D[k]+(C[k]-D[k])*u)*v+(k===0?sign*.004:0));
      for(let i=0;i<6;i++)for(let j=0;j<4;j++){
        const u=.06+i*.135,v=.12+j*.17;
        const color=i===0?'#7099aa':i===1&&j>1?'#5b8297':i>4?'#2c485c':(i+j)%3===0?'#42677d':'#36576c';
        panel([surf(u,v),surf(u+.13,v),surf(u+.13,v+.165),surf(u,v+.165)],color);
      }
    }
  }
  // Wipers sit on the windshield plane, with compact block pivots.
  const front=m.cabin.at(-1),top=m.cabin[m.cabin.length-2];
  const windshield=(x,t)=>[x,front[3]+(top[3]-front[3])*t+.025,front[0]+(top[0]-front[0])*t+.018];
  for(const side of [-1,1]){
    line(windshield(side*.42,.10),windshield(side*.13,.20),.018,'#1b2b32');
    box([.05,.024,.045],windshield(side*.42,.10),'#33454e');
    // Sill bolts echo the excavator's exposed connections.
    for(const z of [-.62,-.30,.02,.34])
      cylinder(.015,.017,[side*(at(z,1)+.042),.32,z],'#8c9b9f','x',6);
    // Fuel flap and a dark recessed handle mounting plate.
    const z=m.axles[0]+.57,x=side*(at(z,1)+.024),y=at(z,3)-.14;
    box([.015,.115,.15],[x,y,z],'#3c4b51');
    box([.021,.078,.112],[x+side*.007,y,z]);
    cylinder(.014,.025,[x+side*.016,y,z-.03],'#87999d','x',6);
  }
  // Rear diffuser strakes and inset plate frame remain visible from behind.
  const rear=m.body[0][0]-.052;
  box([.46,.145,.025],[0,.55,rear],'#15252d');
  box([.36,.083,.032],[0,.55,rear-.018],'#b4c1b8');
  for(let i=-2;i<=2;i++)box([.038,.12,.23],[i*.21,.285,rear+.035],'#263740');
  for(const side of [-1,1])for(let i=0;i<4;i++)
    box([.064,.017,.031],[side*(.49+i*.092),.72,rear-.015],'#e36954');
}
