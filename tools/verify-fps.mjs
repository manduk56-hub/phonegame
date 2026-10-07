import {createServer} from '../server.mjs';
import {spawn} from 'node:child_process';
import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
let godot=process.env.GODOT_EXE;
if(!godot){const files=await readdir(path.join(root,'.runtime/godot'));godot=path.join(root,'.runtime/godot',files.find(f=>f.endsWith('_console.exe')));}
const app=await createServer({port:0,host:'127.0.0.1'});let renderer;
try{
  app.match.join('FPS 검증 참가자');
  renderer=spawn(godot,['--headless','--path',path.join(root,'game'),'--script','res://verify_menu.gd','--',`--server=http://127.0.0.1:${app.port}`],{cwd:root,env:{...process.env,DIRT_RALLY_SERVER_URL:`http://127.0.0.1:${app.port}`,DIRT_RALLY_HOST_KEY:''},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='';renderer.stdout.on('data',b=>stdout+=b);renderer.stderr.on('data',b=>stderr+=b);
  const timeout=setTimeout(()=>renderer.kill(),30000);
  const code=await new Promise((resolve,reject)=>{renderer.once('error',reject);renderer.once('exit',resolve);});clearTimeout(timeout);
  process.stdout.write(stdout);process.stderr.write(stderr);
  assert.equal(code,0);assert(!/SCRIPT ERROR|^ERROR:/m.test(stderr));assert(stdout.includes('all six playable games'));
  assert.equal(app.match.game,'fps');assert.equal(app.match.players.size,1);
}finally{if(renderer&&renderer.exitCode===null)renderer.kill();await app.close();}
