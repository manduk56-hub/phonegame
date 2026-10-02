import {readdir,mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Match} from '../simulation.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=path.join(root,'.runtime');
await mkdir(runtime,{recursive:true});
let executable=process.env.GODOT_EXE;
if(!executable) {
  const files=await readdir(path.join(runtime,'godot'));
  executable=path.join(runtime,'godot',files.find(f=>f.endsWith('_console.exe'))||'missing');
}
const match=new Match();match.configure(8);
for(let i=0;i<16;i++) {
  match.join(`Pose ${i+1}`);
  // Assign test poses after all players have joined (joining resets lobby poses).
}
let i=0;
for(const p of match.players.values()) {
  p.boom=.4+i*.025;p.stick=-1.4+i*.035;p.curl=-.7+i*.1;p.turret=i*.41;i++;
}
const fixture=path.join(runtime,'geometry-fixture.json');
await writeFile(fixture,JSON.stringify(match.snapshot()));
const render=process.argv.includes('--render');
const args=render?['--path',path.join(root,'game'),'--','--capture',`--fixture=${fixture}`]:['--headless','--path',path.join(root,'game'),'--script','res://verify_geometry.gd','--','--preview',`--fixture=${fixture}`];
const result=spawnSync(executable,args,{encoding:'utf8',timeout:30000});
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
if(result.error)throw result.error;
process.exitCode=result.status===0&&!/SCRIPT ERROR|^ERROR:/m.test(result.stderr||'')?0:1;
if(render&&process.exitCode===0) {
  const metrics=JSON.parse(await readFile(path.join(runtime,'render-metrics.json'),'utf8'));
  if(metrics.players!==16||metrics.fps<=0||metrics.draw_calls<=0)throw Error('Incomplete rendering evidence');
  console.log('16-player static rendering validated; this is not a physical-phone or network latency test.');
}
