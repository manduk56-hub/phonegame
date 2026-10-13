import {Match} from '../simulation.mjs';
import {mkdir,writeFile,readdir,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
await mkdir(path.join(root,'.runtime'),{recursive:true});
let engine=process.env.GODOT_EXE;
if(!engine){
  for(const dir of ['.runtime/godot','.runtime/build-cache/godot-4.6.2']){
    const files=await readdir(path.join(root,dir)).catch(()=>[]);
    const executable=files.find(file=>file.endsWith('_console.exe'));
    if(executable){engine=path.join(root,dir,executable);break;}
  }
}
if(!engine)throw Error('Godot 실행 파일을 찾지 못했습니다. GODOT_EXE를 지정하세요.');
await access(engine);
const match=new Match();
match.selectGame('fishing');
for(let i=0;i<6;i++)match.join(`낚시꾼 ${i+1}`);
match.start();
for(const player of match.players.values()){
  player.fishing.stage='waiting';
  player.fishing.fishX=player.x+Math.sin(player.yaw)*5;
  player.fishing.fishZ=player.z+Math.cos(player.yaw)*5;
}
await writeFile(path.join(root,'.runtime/fishing-card-fixture.json'),JSON.stringify(match.snapshot()));
for(const script of ['render_krill_card.gd','render_fishing_card.gd']){
  const child=spawn(engine,['--path','game','--script',`res://${script}`,'--windowed','--resolution','1600x900'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='';
  child.stdout.on('data',data=>output+=data);
  child.stderr.on('data',data=>output+=data);
  const timeout=setTimeout(()=>child.kill(),30000);
  let code;
  try{code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});}
  finally{clearTimeout(timeout);}
  if(code!==0||/SCRIPT ERROR|^ERROR:/m.test(output))throw Error(`${script}: ${output}`);
  console.log(`완료: ${script}`);
}
