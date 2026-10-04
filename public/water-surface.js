// Shared geometry for browser terrain, independent of WebGL for verification.
export function decodeSurface(encoded,count){
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  if(bytes.length!==count*3)throw Error('Invalid water terrain');
  const depth=new Float32Array(count),wet=new Float32Array(count);
  for(let i=0;i<count;i++){depth[i]=(bytes[i*3]|bytes[i*3+1]<<8)/1000;wet[i]=bytes[i*3+2]/255;}
  return {depth,wet};
}
export function groundGeometry(w,depth){
  const positions=new Float32Array(depth.length*3),normals=new Float32Array(depth.length*3),colors=new Float32Array(depth.length*3),indices=[];
  const at=(r,c)=>depth[Math.max(0,Math.min(w.rows-1,r))*w.cols+Math.max(0,Math.min(w.cols-1,c))];
  for(let row=0;row<w.rows;row++)for(let col=0;col<w.cols;col++){
    const i=row*w.cols+col,k=i*3,d=depth[i];
    positions.set([(col-(w.cols-1)/2)*w.size,-d,w.start+row*w.size],k);
    const nx=(at(row,col+1)-at(row,col-1))/(2*w.size),nz=(at(row+1,col)-at(row-1,col))/(2*w.size),length=Math.hypot(nx,1,nz);
    normals.set([nx/length,1/length,nz/length],k);
    const shade=1-Math.min(.35,d*.35);colors.set([.78*shade,.64*shade,.43*shade],k);
    if(row<w.rows-1&&col<w.cols-1){const b=i+w.cols;indices.push(i,b,i+1,i+1,b,b+1);}
  }
  return {positions,normals,colors,indices:new Uint16Array(indices)};
}
export function waterGeometry(w,depth,wet){
  const positions=[];
  const point=i=>({x:(i%w.cols-(w.cols-1)/2)*w.size,z:w.start+Math.floor(i/w.cols)*w.size,q:Math.min(wet[i]-.04,(depth[i]+w.level)*4)});
  function triangle(ids){
    if(ids.every(i=>wet[i]<=.04||depth[i]+w.level<=0))return;
    const input=ids.map(point),clipped=[];
    for(let i=0;i<3;i++){
      const a=input[i],b=input[(i+1)%3];if(a.q>0)clipped.push(a);
      if((a.q>0)!==(b.q>0)){const t=a.q/(a.q-b.q);clipped.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}
    }
    for(let i=1;i<clipped.length-1;i++)for(const p of [clipped[0],clipped[i],clipped[i+1]])positions.push(p.x,w.level+.006,p.z);
  }
  for(let row=0;row<w.rows-1;row++)for(let col=0;col<w.cols-1;col++){
    const a=row*w.cols+col,b=a+w.cols;triangle([a,b,a+1]);triangle([a+1,b,b+1]);
  }
  return new Float32Array(positions);
}
