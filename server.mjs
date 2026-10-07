import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {networkInterfaces} from 'node:os';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {WebSocketServer,WebSocket} from 'ws';
import QRCode from 'qrcode';
import {Match} from './simulation.mjs';
export async function createServer({port=3000,host='0.0.0.0',manualTick=false,publicUrl='',hostKey='',keepLanAddresses=false}={}) {
  let publicAddress=normalizePublicUrl(publicUrl);
  if(publicAddress&&hostKey.length<32)throw Error('PUBLIC_URL 사용 시 HOST_KEY는 32자 이상이어야 합니다.');
  const tokenAuth=Boolean(publicAddress||hostKey);
  const sourceVersion=createHash('sha256').update(await readFile(new URL('./server.mjs',import.meta.url))).digest('hex');
  const match=new Match(), adminKey=hostKey||randomBytes(24).toString('hex');
  const room=randomBytes(3).toString('hex').toUpperCase();
  const chatHistory=[],chatSentAt=new Map();
  let chatSequence=0;
  const files={'/':'host.html','/controller':'controller.html','/style.css':'style.css','/host.js':'host.js','/controller.js':'controller.js','/results.js':'results.js','/pointer-pad.js':'pointer-pad.js','/cab-view.js':'cab-view.js','/water-view.js':'water-view.js','/water-surface.js':'water-surface.js','/bucket-shape.js':'bucket-shape.js'};
  Object.assign(files,{'/race-scene.js':'race-scene.js','/race-controller.js':'race-controller.js','/race-sensors.js':'race-sensors.js','/race.css':'race.css','/race-minimap.js':'race-minimap.js','/race-broadcast.js':'race-broadcast.js','/fps-scene.js':'fps-scene.js','/fps-controller.js':'fps-controller.js','/fps.css':'fps.css','/fps-controls.js':'fps-controls.js'});
  Object.assign(files,{'/bull-scene.js':'bull-scene.js','/bull-controller.js':'bull-controller.js','/bull.css':'bull.css','/brick-model.js':'brick-model.js'});
  Object.assign(files,{'/fishing-scene.js':'fishing-scene.js','/fishing-view.js':'fishing-view.js','/fishing-effects.js':'fishing-effects.js','/fishing-controller.js':'fishing-controller.js','/fishing-controls.js':'fishing-controls.js','/fishing.css':'fishing.css'});
  Object.assign(files,{'/krill-scene.js':'krill-scene.js','/krill-controller.js':'krill-controller.js','/krill.css':'krill.css'});
  let addresses=[],lanAddresses=[],joinAddress='',internetStatus=publicAddress?'online':'local';
  const snapshot=()=>({...match.snapshot(),connection:{room,address:joinAddress,internetStatus}});
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/krill-models.json'){res.setHeader('Content-Type','application/json');res.end(await readFile(new URL('./game/krill-models.json',import.meta.url)));return;}
      if(url.pathname==='/assets/krill-card.png'){res.setHeader('Content-Type','image/png');res.end(await readFile(new URL('./public/assets/krill-card.png',import.meta.url)));return;}
      if(url.pathname==='/fishing-models.json'){res.setHeader('Content-Type','application/json');res.end(await readFile(new URL('./game/fishing-models.json',import.meta.url)));return;}
      if(['/assets/fishing-card.png','/assets/fishing-fish-models.png'].includes(url.pathname)){res.setHeader('Content-Type','image/png');res.end(await readFile(new URL('./public'+url.pathname,import.meta.url)));return;}
      if(url.pathname==='/bull-models.json'){res.setHeader('Content-Type','application/json');res.end(await readFile(new URL('./game/bull-models.json',import.meta.url)));return;}
      if(url.pathname==='/fps-art.json'){res.setHeader('Content-Type','application/json');res.end(await readFile(new URL('./game/fps-art.json',import.meta.url)));return;}
      if(url.pathname==='/car-shapes.json'){
        res.setHeader('Content-Type','application/json');res.end(await readFile(new URL('./game/car-shapes.json',import.meta.url)));return;
      }
      if(url.pathname==='/circuits.json'){
        res.setHeader('Content-Type','application/json');res.end(await readFile(new URL('./game/circuits.json',import.meta.url)));return;
      }
      if(/^\/assets\/(racing-models|race-(wedge|classic|tourer|muscle|exotic|gt))\.png$/.test(url.pathname)){
        res.setHeader('Content-Type','image/png');res.end(await readFile(new URL('./public'+url.pathname,import.meta.url)));return;
      }
      if(['/assets/bull.png','/assets/runner.png','/assets/bull-card.png'].includes(url.pathname)){res.setHeader('Content-Type','image/png');res.end(await readFile(new URL('./public'+url.pathname,import.meta.url)));return;}
      if(['/assets/fps-reference.png','/assets/fps-model-card.png'].includes(url.pathname)){res.setHeader('Content-Type','image/png');res.end(await readFile(new URL('./public'+url.pathname,import.meta.url)));return;}
      if(url.pathname==='/assets/dirt-rally-card.png') {
        res.setHeader('Content-Type','image/png');
        res.end(await readFile(new URL('./public/assets/dirt-rally-card.png',import.meta.url)));return;
      }
      if(['/vendor/three.module.js','/vendor/three.core.js'].includes(url.pathname)) {
        res.setHeader('Content-Type','text/javascript; charset=utf-8');
        res.end(await readFile(new URL(`./node_modules/three/build/${url.pathname.split('/').pop()}`,import.meta.url)));return;
      }
      if(url.pathname==='/fonts/NeoDunggeunmoPro-Regular.woff2'||url.pathname==='/fonts/LICENSE.txt') {
        res.setHeader('Content-Type',url.pathname.endsWith('.woff2')?'font/woff2':'text/plain; charset=utf-8');
        res.end(await readFile(new URL(`./public${url.pathname}`,import.meta.url)));return;
      }
      if(url.pathname==='/config') {
        res.setHeader('Content-Type','application/json');
        res.setHeader('Cache-Control','no-store');
        res.end(JSON.stringify({app:'dirt-rally',protocol:1,sourceVersion,room,addresses,joinAddress,publicAddress,internetStatus,hostAuth:tokenAuth?'token':'local',adminKey:!tokenAuth&&local(req.socket.remoteAddress)?adminKey:null}));return;
      }
      if(url.pathname==='/qr') {
        const target=addresses.find(a=>a===url.searchParams.get('address'))||joinAddress;
        res.setHeader('Content-Type','image/svg+xml');res.end(await QRCode.toString(`${target}/controller?room=${room}`,{type:'svg',width:1024,margin:4}));return;
      }
      const file=files[url.pathname];if(!file) {res.writeHead(404);res.end();return;}
      res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');
      res.end(await readFile(new URL(`./public/${file}`,import.meta.url)));
    } catch {res.writeHead(500);res.end('서버 오류');}
  });
  const wss=new WebSocketServer({server,maxPayload:4096});
  const send=(ws,value)=>{if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<65536) ws.send(JSON.stringify(value));};
  wss.on('connection',(ws,req)=>{
    let role=null,id=null; ws.alive=true;
    ws.on('pong',()=>ws.alive=true);
    ws.on('message',raw=>{
      try {
        const m=JSON.parse(raw.toString());
        if(!role) {
          if(m.type==='host'&&(tokenAuth||local(req.socket.remoteAddress))&&validKey(m.key,adminKey)) role='host';
          else if(m.type==='display'&&!tokenAuth&&local(req.socket.remoteAddress)) role='display';
          else if(m.type==='join'&&m.room===room) {
            const p=match.join(m.name,m.token); role='player';id=p.id;
            for(const old of wss.clients) if(old!==ws&&old.playerId===id) {old.playerId=null;old.close(4001,'Reconnected elsewhere');}
            ws.playerId=id;send(ws,{type:'joined',id,token:p.token});
          } else throw Error('접속 정보가 올바르지 않습니다. PC의 QR코드를 다시 스캔하세요.');
          if(role==='host')send(ws,{type:'host-ready'});
          ws.sessionRole=role;send(ws,{type:'chat-history',messages:chatHistory});
          send(ws,snapshot());return;
        }
        if(role==='player') {
          if(m.type==='chat') {
            const p=match.players.get(id);
            if(ws.playerId!==id||!p?.connected)return;
            const body=typeof m.text==='string'?m.text.trim():'';
            if(!body||body.length>200){send(ws,{type:'chat-error',message:'메시지는 1~200자로 입력하세요.'});return;}
            const now=Date.now();
            if(now-(chatSentAt.get(id)||0)<1000){send(ws,{type:'chat-error',message:'잠시 후 다시 전송하세요.'});return;}
            chatSentAt.set(id,now);
            const message={id:++chatSequence,playerId:id,name:p.name,text:body};
            chatHistory.push(message);if(chatHistory.length>50)chatHistory.shift();
            for(const client of wss.clients)if(client.playerId||['host','display'].includes(client.sessionRole))send(client,{type:'chat',message});
          }
          if(m.type==='input') match.input(id,m);
          if(m.type==='fire')match.fire(id,m);
          if(m.type==='car')match.chooseCar(id,m.car);
          if(m.type==='race-view'&&match.game==='racing'&&['first','third'].includes(m.viewMode)){const p=match.players.get(id);if(p)p.viewMode=m.viewMode;}
          if(m.type==='action'&&['scoop','drop','cast','hook','tail'].includes(m.action)) match.action(id,m.action);
        } else if(role==='host') {
          if(m.type==='game')match.selectGame(m.game);
          if(m.type==='network') {
            if(!addresses.includes(m.address))throw Error('현재 PC의 네트워크 주소를 선택하세요.');
            joinAddress=m.address;
          }
          if(m.type==='configure') match.configure(m.teams,m.duration);
          if(m.type==='bull-choice')match.chooseBull(m.id);
          if(m.type==='bull-map')match.selectBullMap(m.map);
          if(m.type==='track') match.selectTrack(m.track);
          if(m.type==='excavator-map') match.selectExcavatorMap(m.map);
          if(m.type==='assign') match.assign(m.id,m.team);
          if(m.type==='remove') {
            match.remove(m.id);
            for(const client of wss.clients) if(client.playerId===m.id) {send(client,{type:'removed'});client.playerId=null;client.close(4002,'Removed');}
          }
          if(m.type==='start') match.start();
          if(m.type==='lobby') match.lobby();
        }
      } catch(e) {send(ws,{type:'error',message:e.message});}
    });
    ws.on('close',()=>{if(ws.playerId) match.disconnect(ws.playerId);});
    ws.on('error',()=>{});
  });
  let previous=performance.now();
  const timer=setInterval(()=>{
    const now=performance.now();if(!manualTick) match.tick(Math.min(.1,(now-previous)/1000));previous=now;
    const state=snapshot();for(const ws of wss.clients) send(ws,state);
  },50);
  const heartbeat=setInterval(()=>{for(const ws of wss.clients) {if(!ws.alive) {ws.terminate();continue;}ws.alive=false;ws.ping();}},5000);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);}).catch(error=>{clearInterval(timer);clearInterval(heartbeat);throw error;});
  const actualPort=server.address().port;
  lanAddresses=[...new Set(Object.values(networkInterfaces()).flat().filter(a=>a.family==='IPv4'&&!a.internal).map(a=>`http://${a.address}:${actualPort}`))];
  if(!lanAddresses.length) lanAddresses=[`http://127.0.0.1:${actualPort}`];
  addresses=publicAddress?[publicAddress,...(keepLanAddresses?lanAddresses:[])]:lanAddresses;
  joinAddress=addresses[0];
  // Only the owning process can publish a tunnel address. Never expose this
  // operation as an HTTP endpoint or trust forwarded loopback addresses.
  const setPublicUrl=(value,status=value?'online':'local')=>{
    if(!tokenAuth||hostKey.length<32)throw Error('터널 사용 시 HOST_KEY는 32자 이상이어야 합니다.');
    publicAddress=normalizePublicUrl(value);
    if(!['online','local','connecting','reconnecting','failed'].includes(status))throw Error('올바르지 않은 연결 상태');
    internetStatus=status;
    addresses=publicAddress?[publicAddress,...(keepLanAddresses?lanAddresses:[])]:lanAddresses;
    joinAddress=addresses[0];
  };
  return {server,wss,match,room,port:actualPort,get addresses(){return addresses;},setPublicUrl,close:async()=>{clearInterval(timer);clearInterval(heartbeat);for(const ws of wss.clients) ws.terminate();await new Promise(resolve=>wss.close(resolve));await new Promise(resolve=>server.close(resolve));}};
}
function local(ip) {return ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip);}
function validKey(value,key) {
  return typeof value==='string'&&timingSafeEqual(createHash('sha256').update(value).digest(),createHash('sha256').update(key).digest());
}
function normalizePublicUrl(value) {
  if(!value)return '';
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('PUBLIC_URL은 경로 없는 http(s) 서버 주소여야 합니다.');
  return url.origin;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]) {
  const app=await createServer({port:Number(process.env.PORT||3000),host:process.env.HOST||'0.0.0.0',publicUrl:process.env.PUBLIC_URL||'',hostKey:process.env.HOST_KEY||''});
  console.log(`PC 대기실: http://localhost:${app.port}\n폰 접속: ${app.addresses.join(', ')}\n방 코드: ${app.room}`);
}
