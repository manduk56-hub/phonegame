import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readdir,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {WebSocket} from 'ws';
import {createServer} from '../server.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(path.join(root,'.runtime'),{recursive:true});
let godot=process.env.GODOT_EXE;
if(!godot){const files=await readdir(path.join(root,'.runtime/godot'));godot=path.join(root,'.runtime/godot',files.find(f=>f.endsWith('_console.exe')));}
const app=await createServer({port:0,host:'127.0.0.1'});
let renderer;
try {
  const phones=Array.from({length:16},(_,i)=>new Promise((resolve,reject)=>{
    const ws=new WebSocket(`ws://127.0.0.1:${app.port}`);
    ws.once('error',reject);
    ws.once('open',()=>ws.send(JSON.stringify({type:'join',room:app.room,name:i===0?'긴 이름의 참가자 테스트':'참가자 '+(i+1)})));
    ws.on('message',raw=>{if(JSON.parse(raw).type==='joined')resolve(ws);});
  }));
  const connectedPhones=await Promise.all(phones);
  connectedPhones[0].send(JSON.stringify({type:'chat',text:'모바일 채팅 연동 확인 <b>그대로 표시</b>'}));
  renderer=spawn(godot,['--path',path.join(root,'game'),'--script','res://verify_lobby.gd','--',`--server=http://127.0.0.1:${app.port}`],{cwd:root,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',finished=false;
  renderer.stdout.on('data',b=>{
    stdout+=b;
    if(!finished&&stdout.includes('VERIFY_FINISH')){finished=true;app.match.tick(901);}
  });
  renderer.stderr.on('data',b=>stderr+=b);
  const timeout=setTimeout(()=>renderer.kill(),30000);
  const code=await new Promise((resolve,reject)=>{renderer.once('error',reject);renderer.once('exit',resolve);});
  clearTimeout(timeout);
  process.stdout.write(stdout);process.stderr.write(stderr);
  assert.equal(code,0,'Native lobby verification failed');
  assert(!/SCRIPT ERROR|^ERROR:/m.test(stderr));
  assert(stdout.includes('PASS: native lobby'));
} finally {
  if(renderer&&renderer.exitCode===null)renderer.kill();
  await app.close();
}
