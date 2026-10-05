// The 95 cm cutting lip is at the origin; the bowl extends toward the machine.
export function bucketCutHeight(dx,dz,angle,bottom){
  const s=Math.sin(angle),c=Math.cos(angle),across=dx*c-dz*s,along=dx*s+dz*c;
  const side=Math.abs(across)/.475,back=(-along+.32)/.95;
  if(side>=1||back<0||back>=1)return Infinity;
  // Straight lip and sides, rounded heel, with a narrow bevel at the rim.
  const rim=Math.max(side,back);
  return bottom+.07*back*back+.24*Math.max(0,(rim-.78)/.22)**2;
}
