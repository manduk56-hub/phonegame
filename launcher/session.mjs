import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,unlink,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {lookup} from 'node:dns/promises';
import {Resolver} from 'node:dns/promises';
import https from 'node:https';
import {createServer} from '../server.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
export const tunnelAddress=text=>text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/i)?.[0]||'';
const tunnelResolver=new Resolver({timeout:2000,tries:1});
tunnelResolver.setServers(['1.1.1.1','1.0.0.1']);
export async function resolveTunnelHost(hostname,{systemLookup=lookup,publicResolve=name=>tunnelResolver.resolve4(name)}={}) {
  try {return await systemLookup(hostname,{all:true});}
  catch(error) {
    if(!['ENOTFOUND','EAI_AGAIN'].includes(error.code)||!/^[a-z0-9-]+\.trycloudflare\.com$/i.test(hostname))throw error;
    return (await publicResolve(hostname)).map(address=>({address,family:4}));
  }
}
function readTunnelConfig(url,signal) {
  // Keep the URL hostname for TLS validation and HTTP routing; only DNS falls back.
  if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com\/?$/i.test(url))return fetch(`${url}/config`,{signal}).then(async response=>({ok:response.ok,config:await response.json()}));
  return new Promise((resolve,reject)=>{
    const request=https.get(`${url}/config`,{signal,lookup:(hostname,options,callback)=>{
      resolveTunnelHost(hostname).then(addresses=>options.all?callback(null,addresses):callback(null,addresses[0].address,addresses[0].family),callback);
    }},response=>{
      let body='';response.setEncoding('utf8');
      response.on('data',chunk=>{body+=chunk;if(body.length>65536)response.destroy(Error('Invalid tunnel response'));});
      response.once('error',reject);
      response.once('end',()=>{try{resolve({ok:response.statusCode===200,config:JSON.parse(body)});}catch(error){reject(error);}});
    });
    request.once('error',reject);
  });
}
export async function verifyTunnel(url,room,{timeout=60000,signal}={}) {
  const end=Date.now()+timeout;
  while(Date.now()<end&&!signal?.aborted) {
    try {
      const {ok,config}=await readTunnelConfig(url,AbortSignal.any([AbortSignal.timeout(5000),...(signal?[signal]:[])]));
      if(ok&&config.app==='dirt-rally'&&config.room===room&&config.hostAuth==='token'&&config.adminKey===null)return;
    } catch { }
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw Error('외부 연결을 확인하지 못했습니다. 인터넷 연결을 확인하고 잠시 후 다시 실행하세요.');
}

export async function runSession({mode='internet',statusPath,stopPath,cloudflared=path.join(root,'runtime/cloudflared.exe'),gameExe=path.join(root,'game/Playroom.exe'),gameArgs=[],launchGame=true,onReady}={}) {
  if(!['internet','lan'].includes(mode))throw Error('지원하지 않는 실행 모드');
  let app,tunnel,game,stopping=false,stopTimer,lockOwned=false,reconnectTask;
  const stateDir=path.dirname(statusPath||path.join(process.env.LOCALAPPDATA||root,'Playroom/session.json'));
  await mkdir(stateDir,{recursive:true});
  const lockPath=path.join(stateDir,'session.lock');
  const status=async(stage,message,extra={})=>{
    const data={stage,message,mode,pid:process.pid,updatedAt:new Date().toISOString(),...extra};
    if(statusPath){const tmp=`${statusPath}.${process.pid}.tmp`;await writeFile(tmp,JSON.stringify(data));await rename(tmp,statusPath);}
    return data;
  };
  const controller=new AbortController();
  const killChild=async child=>{
    if(!child||child.exitCode!==null||child.signalCode!==null)return;
    const exited=new Promise(resolve=>child.once('exit',resolve));
    child.kill();
    await Promise.race([exited,new Promise(resolve=>setTimeout(resolve,2000))]);
  };
  const close=async()=>{
    if(stopping)return;
    stopping=true;controller.abort();clearInterval(stopTimer);
    await Promise.all([killChild(game),killChild(tunnel)]);
    if(reconnectTask)await reconnectTask.catch(()=>{});
    if(app)await app.close();
    if(lockOwned)await unlink(lockPath).catch(()=>{});
  };
  const signalHandler=()=>{void close();};
  process.once('SIGINT',signalHandler);process.once('SIGTERM',signalHandler);
  try {
    try {await writeFile(lockPath,String(process.pid),{flag:'wx'});lockOwned=true;}
    catch(error) {
      if(error.code!=='EEXIST')throw error;
      const owner=Number(await readFile(lockPath,'utf8'));
      let live=false;try {if(owner>0){process.kill(owner,0);live=true;}}catch{}
      if(live)throw Error('이미 게임이 실행 중입니다. 현재 게임을 종료한 뒤 다시 실행하세요.');
      await unlink(lockPath);await writeFile(lockPath,String(process.pid),{flag:'wx'});lockOwned=true;
    }
    if(stopPath) {
      await unlink(stopPath).catch(()=>{});
      stopTimer=setInterval(()=>{access(stopPath).then(()=>close()).catch(()=>{});},500);
    }
    await status('starting','내 PC에서 게임 서버를 준비하고 있습니다.');
    const hostKey=randomBytes(32).toString('hex');
    app=await createServer({port:0,host:'0.0.0.0',hostKey,keepLanAddresses:true});
    const localUrl=`http://127.0.0.1:${app.port}`;
    const startTunnel=async(reconnecting=false)=>{
      if(stopping)throw Error('실행을 취소했습니다.');
      app.setPublicUrl('',reconnecting?'reconnecting':'connecting');
      await status(reconnecting?'reconnecting':'connecting',reconnecting?'외부 연결을 복구하고 있습니다. QR이 바뀌면 다시 스캔하세요.':'다른 Wi-Fi에서도 참가할 수 있도록 연결하고 있습니다.');
      // An explicit empty config avoids inheriting the user's personal tunnels.
      const configPath=path.join(stateDir,`tunnel-${process.pid}.yaml`);
      await writeFile(configPath,'{}\n');
      const child=spawn(cloudflared,['tunnel','--config',configPath,'--no-autoupdate','--url',localUrl],{cwd:stateDir,windowsHide:true,stdio:['ignore','pipe','pipe']});
      tunnel=child;
      try {
        const url=await new Promise((resolve,reject)=>{
          let tail='';
          const timeout=setTimeout(()=>finish(Error('터널 주소 발급 시간이 초과되었습니다.')),45000);
          const read=data=>{tail=(tail+data.toString()).slice(-8192);const url=tunnelAddress(tail);if(url)finish(null,url);};
          const failed=()=>finish(Error('터널 연결이 종료되었습니다. 인터넷 연결을 확인하세요.'));
          const aborted=()=>finish(Error('실행을 취소했습니다.'));
          function finish(error,url){clearTimeout(timeout);child.stdout.off('data',read);child.stderr.off('data',read);child.off('error',failed);child.off('exit',failed);controller.signal.removeEventListener('abort',aborted);error?reject(error):resolve(url);}
          child.stdout.on('data',read);child.stderr.on('data',read);child.once('error',failed);child.once('exit',failed);controller.signal.addEventListener('abort',aborted,{once:true});
        });
        // Drain logs without persisting account tokens or host credentials.
        child.stdout.resume();child.stderr.resume();
        await verifyTunnel(url,app.room,{signal:controller.signal});
        if(child.exitCode!==null||child.signalCode!==null||stopping)throw Error('터널 연결이 종료되었습니다.');
        app.setPublicUrl(url);
        return url;
      } catch(error) {await killChild(child);throw error;}
      finally {await unlink(configPath).catch(()=>{});}
    };
    if(mode==='internet')await startTunnel();
    if(stopping)return;
    if(launchGame) {
      game=spawn(gameExe,gameArgs,{cwd:root,windowsHide:false,env:{...process.env,DIRT_RALLY_SERVER_URL:localUrl,DIRT_RALLY_HOST_KEY:hostKey},stdio:['ignore','pipe','pipe']});
      await new Promise((resolve,reject)=>{game.once('spawn',resolve);game.once('error',reject);});
      game.stdout.resume();game.stderr.resume();
    }
    const ready=()=>status('running','게임이 실행 중입니다. 화면의 QR로 참가하세요.',{room:app.room,addresses:app.addresses,localUrl,gamePid:game?.pid});
    await ready();
    await onReady?.({app,close,localUrl});
    const watchTunnel=()=>{
      const child=tunnel;
      child.once('exit',()=>{
        if(stopping)return;
        reconnectTask=(async()=>{
          for(let attempt=0;attempt<3&&!stopping;attempt++) {
            try {await startTunnel(true);if(stopping)return;await ready();watchTunnel();return;}
            catch {if(stopping)return;}
          }
          app.setPublicUrl('','failed');
          await status('connection-failed','외부 연결이 끊겼습니다. 같은 Wi-Fi에서는 계속 참가할 수 있습니다.',{room:app.room,addresses:app.addresses,localUrl});
        })();
      });
      if(child.exitCode!==null||child.signalCode!==null)child.emit('exit');
    };
    if(mode==='internet')watchTunnel();
    if(game)await new Promise(resolve=>{if(game.exitCode!==null||game.signalCode!==null)resolve();else game.once('exit',resolve);});
    else if(!controller.signal.aborted)await new Promise(resolve=>controller.signal.addEventListener('abort',resolve,{once:true}));
    await close();await status('stopped','게임을 종료했습니다.');
  } catch(error) {
    await close();await status('error',error.message);throw error;
  } finally {
    process.removeListener('SIGINT',signalHandler);process.removeListener('SIGTERM',signalHandler);
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const options={};
  for(const arg of process.argv.slice(2)){const split=arg.indexOf('=');if(split>0)options[arg.slice(2,split)]=arg.slice(split+1);}
  runSession({mode:options.mode,statusPath:options.status,stopPath:options.stop,gameExe:options.game||undefined,gameArgs:options.project?['--path',options.project]:[],cloudflared:options.tunnel||undefined}).catch(error=>{console.error(error.message);process.exitCode=1;});
}
