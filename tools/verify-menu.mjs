import {createServer} from '../server.mjs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const app=await createServer({host:'127.0.0.1',port:0});
app.match.join('검증 드라이버');
const engine=process.env.GODOT_EXE||'.runtime/build-cache/godot-4.6.2/Godot_v4.6.2-stable_win64_console.exe';
let child;
try{
  child=spawn(engine,['--headless','--path','game','--script','res://verify_menu.gd'],{windowsHide:true,env:{...process.env,DIRT_RALLY_SERVER_URL:`http://127.0.0.1:${app.port}`,DIRT_RALLY_HOST_KEY:''},stdio:['ignore','pipe','pipe']});
  let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);const timeout=setTimeout(()=>child.kill(),15000);
  const code=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});clearTimeout(timeout);
  assert.equal(code,0,output);assert(!/SCRIPT ERROR|^ERROR:/m.test(output),output);assert(output.includes('PASS:'),output);console.log(output);
}finally{child?.kill();await app.close();}
