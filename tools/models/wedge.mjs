// Reference 1, rebuilt from the supplied coupe. +Z is the nose.
export function authorWedge({m,panel,box,cylinder,line}) {
  const face=(p,color='paint',shade=1)=>{panel(p,color);if(shade!==1)m.panels.at(-1).shade=shade;};
  const sections=[ // z, width, hood/deck height, shoulder height
    [-2.28,.94,.73,.80],[-2.02,1.00,.80,.89],[-1.46,1.045,.84,.98],[-1.02,1.00,.86,.91],
    [-.65,.97,.86,.87],[.30,.97,.86,.88],[.75,.985,.87,.90],[1.30,1.025,.84,.985],
    [1.66,1.01,.79,.89],[1.99,.975,.71,.76],[2.27,.90,.60,.65]
  ];
  const at=z=>{
    const i=sections.findIndex(r=>r[0]>=z);if(i===0)return sections[0];if(i<0)return sections.at(-1);
    const a=sections[i-1],b=sections[i],u=(z-a[0])/(b[0]-a[0]);return [z,...a.slice(1).map((n,k)=>n+(b[k+1]-n)*u)];
  };
  const arch=z=>Math.max(.255,...m.axles.map(a=>Math.abs(z-a)<.485?.43+Math.sqrt(.485**2-(z-a)**2):.255));
  const cross=[0,.45,.65,.78,.89,.96,1];
  const height=(u,h,t)=>{
    const ys=[h,h+.005,h+.018,h+(t-h)*.43,t,t-.02,t-.065];
    for(let i=1;i<cross.length;i++)if(u<=cross[i]){const f=(u-cross[i-1])/(cross[i]-cross[i-1]);return ys[i-1]+(ys[i]-ys[i-1])*f;}return ys.at(-1);
  };
  const top=(x,z,o=0)=>{const [,w,h,t]=at(z);return [x,height(Math.abs(x)/w,h,Math.max(t,arch(z)+.075))+o,z];};
  const side=(y,z,s=1,o=.008)=>[s*(at(z)[1]+o),y,z];
  const zs=new Set(sections.map(r=>r[0]));
  for(const a of m.axles)for(const d of [-.485,-.46,-.40,-.31,-.18,0,.18,.31,.40,.46,.485])zs.add(a+d);
  for(let z=-2.28;z<2.27;z+=.12)zs.add(z);zs.add(.75);zs.add(-1.02);
  const rings=[...zs].filter(z=>z>=-2.28&&z<=2.27).sort((a,b)=>a-b).map(z=>{
    const [,w,h,t]=at(z),bottom=arch(z),shoulder=Math.max(t,bottom+.075);
    return [[-w,bottom,z],...cross.slice(1).reverse().map(u=>[-u*w,Math.max(height(u,h,shoulder),u>.95?bottom+.016:0),z]),
      [0,h,z],...cross.slice(1).map(u=>[u*w,Math.max(height(u,h,shoulder),u>.95?bottom+.016:0),z]),
      [w,bottom,z],[w*.93,.245,z],[-w*.93,.245,z]];
  });
  // One connected skin, including the wheel openings, rather than separate fenders.
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<rings[j].length;i++){const n=(i+1)%rings[j].length;face([rings[j][i],rings[j+1][i],rings[j+1][n],rings[j][n]]);}face(rings[0]);
  m.bodyPanelCount=m.panels.length;
  const clip=(poly,axis,value,above)=>{
    const out=[];for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],ai=above?a[axis]>=value:a[axis]<=value,bi=above?b[axis]>=value:b[axis]<=value;
      if(ai)out.push(a);if(ai!==bi){const u=(value-a[axis])/(b[axis]-a[axis]);out.push(a.map((n,k)=>n+(b[k]-n)*u));}
    }return out;
  };
  const decal=(poly,color='paint',o=.006,shade=1)=>{
    const xs=poly.map(p=>p[0]),zs=poly.map(p=>p[1]);
    for(let x=Math.min(...xs);x<Math.max(...xs);x+=.055)for(let z=Math.min(...zs);z<Math.max(...zs);z+=.055){
      let p=poly;for(const [axis,value,above] of [[0,x,true],[0,x+.055,false],[1,z,true],[1,z+.055,false]])p=clip(p,axis,value,above);
      if(p.length>=3)face(p.map(([x,z])=>top(x,z,o)),color,shade);
    }
  };
  const stroke=(a,b,w,color,o=.009,shade=1)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),nx=-dz/l*w/2,nz=dx/l*w/2;
    decal([[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]],color,o,shade);
  };
  for(const s of [-1,1]){
    // Trapezoidal luggage lid creases and compact lamps, with flat interior Y marks.
    stroke([s*.50,.79],[s*.34,1.96],.013,'paint',.006,.77);
    stroke([s*.34,1.96],[0,2.055],.011,'paint',.006,.79);
    stroke([s*.55,.80],[s*.40,1.93],.018,'paint',.005,1.04);
    decal([[s*.46,2.04],[s*.71,2.15],[s*.86,1.94],[s*.80,1.73],[s*.63,1.77]],'#14212a',.010);
    const joint=[s*.665,2.005];
    stroke([s*.70,1.825],joint,.040,'#eeeedd',.012);
    stroke([s*.79,1.945],joint,.040,'#eeeedd',.012);
    stroke(joint,[s*.535,2.045],.042,'#eeeedd',.012);
  }
  decal([[-.033,1.985],[.033,1.985],[.024,2.052],[0,2.075],[-.025,2.052]],'#28302b',.012);
  decal([[-.016,2.005],[.016,2.005],[0,2.048]],'#bba043',.014);
  const pocket=outline=>{
    const back=outline.map(([x,y,z])=>[x,y,z-.12]);face(back,'#0e1921');
    for(let i=0;i<outline.length;i++)face([outline[i],outline[(i+1)%outline.length],back[(i+1)%outline.length],back[i]],'#27363c');
  };
  pocket([[-.32,.25,2.335],[.32,.25,2.335],[.39,.50,2.35],[-.39,.50,2.35]]);
  for(const s of [-1,1]){
    const p=(x,y,z=2.31)=>[s*x,y,z];
    const a=p(.59,.285),b=p(.86,.27),c=p(.99,.34),d=p(.935,.53),e=p(.62,.555),f=p(.535,.50);
    pocket([a,b,c,d,e,f]);
    const nose=top(s*.90,2.27),lid=top(s*.47,2.27),cl=p(.32,.25,2.335),ch=p(.39,.50,2.35);
    face([[0,.50,2.35],ch,lid,top(0,2.27)]);face([ch,f,e,lid]);face([lid,e,d,nose]);face([ch,cl,a,f]);
    face([cl,p(.35,.22,2.38),p(.59,.23,2.345),a]);face([a,p(.59,.23,2.345),p(.88,.22),b]);
    face([b,p(.88,.22),p(1.0,.285),c]);face([c,p(1.0,.285),nose,d]);
    face([[0,.25,2.335],cl,p(.35,.22,2.38),[0,.215,2.39]],'#273039');
    face([p(.35,.22,2.38),p(.59,.23,2.345),p(.59,.205,2.35),p(.35,.20,2.38)]);
    face([nose,p(1.0,.285),p(.90,.245,2.27)]);
  }
  // Closed greenhouse: glass, gasket and frame are adjacent patches of one surface.
  const front=.75,roofFront=-.05,roofRear=-.83,rear=-1.12,roofY=1.285,rearY=1.265;
  face([[-.63,roofY,roofFront],[.63,roofY,roofFront],[.675,rearY,roofRear],[-.675,rearY,roofRear]]);
  face([[-.675,rearY,roofRear],[.675,rearY,roofRear],[.78,.93,rear],[-.78,.93,rear]]);
  const frontSurface=(u,v)=>[u*(.795*(1-v)+.63*v),top(u*.795,front)[1]*(1-v)+roofY*v,front+(roofFront-front)*v];
  const us=[-1,-.965,-.925,-.80,-.64,-.48,-.32,0,.32,.48,.64,.80,.925,.965,1],vs=[0,.035,.07,.24,.48,.72,.93,.965,1];
  for(let i=0;i<us.length-1;i++)for(let j=0;j<vs.length-1;j++){
    const u=(us[i]+us[i+1])/2,v=(vs[j]+vs[j+1])/2;
    const color=Math.abs(u)>.965?'paint':Math.abs(u)>.925||v<.07||v>.93?'#17242b':u<-.64||u>.64?'#5c7e95':u<-.32?'#38566c':'#42657d';
    face([frontSurface(us[i],vs[j]),frontSurface(us[i+1],vs[j]),frontSurface(us[i+1],vs[j+1]),frontSurface(us[i],vs[j+1])],color);
  }
  for(const s of [-1,1]){
    const A=top(s*.795,front),B=[s*.81,.89,-1.025],C=[s*.675,rearY,roofRear],D=[s*.63,roofY,roofFront];
    const surf=(u,v)=>A.map((n,k)=>(n+(B[k]-n)*u)*(1-v)+(D[k]+(C[k]-D[k])*u)*v);
    const ts=[0,.045,.09,.28,.52,.71,.755,.81,.93,.96,1],ys=[0,.04,.09,.30,.60,.89,.94,1];
    for(let i=0;i<ts.length-1;i++)for(let j=0;j<ys.length-1;j++){
      const u=(ts[i]+ts[i+1])/2,v=(ys[j]+ys[j+1])/2,glass=u>.09&&u<.93&&v>.09&&v<.89,rim=u>.045&&u<.96&&v>.04&&v<.94;
      const color=u>.71&&u<.755?'#19252c':glass?(u>.755?'#29475a':u<.28?'#52768b':'#375a71'):rim?'#17242b':'paint';
      face([surf(ts[i],ys[j]),surf(ts[i+1],ys[j]),surf(ts[i+1],ys[j+1]),surf(ts[i],ys[j+1])],color);
    }
    face([B,C,[s*.78,.93,rear],top(s*.81,-1.025)]);
    face([top(s*.81,-1.025),[s*.78,.93,rear],top(s*.78,rear)]);
    face([side(.31,.75,s),side(.30,-.94,s),side(.405,-1.015,s),side(.37,-.30,s),side(.37,.68,s)],'paint',.89);
    face([side(.37,.68,s),side(.37,-.30,s),side(.405,-1.015,s),side(.44,-.97,s),side(.395,-.20,s)],'paint',1.04);
    face([[.415,-.96],[.87,-.86],[.885,-.535],[.80,-.475],[.40,-.77]].map(([y,z])=>side(y,z,s,.012)),'#15242c');
    face([[.43,-.92],[.83,-.82],[.845,-.56],[.78,-.525],[.43,-.78]].map(([y,z])=>side(y,z,s,.016)),'#20313a');
    const seam=[[.83,.62],[.395,.59],[.37,-.25],[.74,-.43]];
    for(let i=0;i<seam.length-1;i++){const [y,z]=seam[i],[yy,zz]=seam[i+1];face([side(y,z,s,.012),side(yy,zz,s,.012),side(yy+.010,zz,s,.012),side(y+.010,z,s,.012)],'paint',.64);}
    box([.012,.025,.12],[s*.985,.82,-.12],'#7f7133');
    line([s*.795,.915,.56],[s*.94,.94,.56],.035,'#1d2b32');
    face([[s*.90,.935,.65],[s*1.075,.945,.635],[s*1.08,.985,.50],[s*.94,.993,.48]]);
    face([[s*.90,.935,.65],[s*1.075,.945,.635],[s*1.075,.91,.635],[s*.90,.91,.65]],'paint',.85);
    face([[s*1.075,.945,.635],[s*1.08,.985,.50],[s*1.08,.915,.50],[s*1.075,.91,.635]],'paint',.86);
    face([[s*.94,.993,.48],[s*1.08,.985,.50],[s*1.08,.915,.50],[s*.94,.925,.48]],'#617984');
    decal([[s*.51,-1.02],[s*.72,-1.13],[s*.77,-1.57],[s*.66,-1.68],[s*.56,-1.40]],'#17242a',.01);
  }
  decal([[-.37,-1.19],[.37,-1.19],[.42,-1.79],[-.42,-1.79]],'#17262e',.01);
  for(let i=0;i<6;i++)stroke([-.39,-1.26-i*.085],[.39,-1.26-i*.085],.024,'#40515b',.014);
  for(const s of [-1,1]){box([.43,.064,.028],[s*.65,.72,-2.295],'#a2302d');box([.22,.095,.11],[s*.53,.32,-2.30],'#28333b');}
  box([1.73,.19,.025],[0,.475,-2.29],'#25313a');
  for(const s of [-1,1])for(const z of m.axles){
    cylinder(.427,.245,[s*1.017,.43,z],'#17212b','x',16);
    cylinder(.346,.256,[s*1.022,.43,z],'#45515e','x',16);
    cylinder(.318,.264,[s*1.026,.43,z],'#202d38','x',16);
    cylinder(.268,.267,[s*1.028,.43,z],'#263540','x',16);
    box([.019,.15,.065],[s*1.165,.43,z+.20],'#8f844c');
    for(let i=0;i<10;i++){const a=i*Math.PI/5;line([s*1.167,.43+Math.cos(a)*.10,z+Math.sin(a)*.10],[s*1.17,.43+Math.cos(a+.13)*.311,z+Math.sin(a+.13)*.311],.035,'#53616e');}
    cylinder(.077,.280,[s*1.032,.43,z],'#445462','x',12);cylinder(.04,.286,[s*1.034,.43,z],'#8c959a','x',8);
  }
  m.style='brick';m.body=sections.map(([z,w,h,t])=>[z,w,.245,t]);
  m.cabin=[[rear,.78,.86,.93],[roofRear,.675,.86,rearY],[roofFront,.63,.86,roofY],[front,.795,.86,.90]];
}
