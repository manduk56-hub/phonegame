// Same fixed overview camera in the web and Godot hosts.
export const FPS_OVERVIEW_POSITION = [34,40,42];
export function screenDirection(x,y){
  const [cx,,cz]=FPS_OVERVIEW_POSITION,length=Math.hypot(cx,cz);
  return {x:(cz*x+cx*y)/length,z:(-cx*x+cz*y)/length};
}
export function screenMovement(x,y,yaw){
  if(x===0&&y===0)return {forward:0,strafe:0};
  const world=screenDirection(x,y);
  return {forward:Math.sin(yaw)*world.x+Math.cos(yaw)*world.z,
    strafe:Math.cos(yaw)*world.x-Math.sin(yaw)*world.z};
}
export function screenAim(x,y){const world=screenDirection(x,y);return Math.atan2(world.x,world.z);}
// One pad controls both movement and facing; release preserves the last heading.
export function screenControl(x,y,yaw){
  const strength=x===0&&y===0?0:1;
  return {forward:strength,strafe:0,yaw:strength>0?screenAim(x,y):yaw};
}
