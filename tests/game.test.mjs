import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {Match,ARENA} from '../simulation.mjs';
import {createServer} from '../server.mjs';

test('expanded arena allows travel beyond the old edge and stops at the new boundary',()=>{
  const m=new Match(),p=m.join('넓은 맵');m.start();
  assert.equal(m.snapshot().arena.size,66);
  assert(m.teams.every(t=>Math.abs(Math.hypot(t.x,t.z)-27)<1e-8));
  p.x=20;p.z=0;p.yaw=Math.PI/2;
  for(let i=0;i<20;i++){m.input(p.id,{travelL:1,travelR:1},1000+i*100);m.tick(.1,1000+i*100);}
  assert(p.x>20);
  p.x=ARENA.driveLimit-.1;
  for(let i=0;i<10;i++){m.input(p.id,{travelL:1,travelR:1},4000+i*100);m.tick(.1,4000+i*100);}
  assert.equal(p.x,ARENA.driveLimit);
});

test('all team counts and a 16-player single-team assignment spawn within the arena without overlap',()=>{
  const m=new Match();const players=Array.from({length:16},(_,i)=>m.join(`P${i}`));
  function check() {
    for(const p of players) {
      assert(Math.abs(p.x)<=ARENA.driveLimit&&Math.abs(p.z)<=ARENA.driveLimit,`outside: ${p.x}, ${p.z}`);
      for(const q of players)if(p!==q)assert(Math.hypot(p.x-q.x,p.z-q.z)>=1.5,'overlapping spawns');
    }
  }
  for(let count=1;count<=8;count++) {
    m.configure(count);check();
    for(const p of players)m.assign(p.id,0);
    check();m.start();check();m.lobby();check();
  }
});

test('16 drivers, 8 teams, arbitrary team assignment and reconnect preserve identity',()=>{
  const m=new Match();m.configure(8);
  const ps=Array.from({length:16},(_,i)=>m.join(`P${i}`));
  assert.deepEqual(m.teams.map(t=>ps.filter(p=>p.team===t.id).length),Array(8).fill(2));
  assert.throws(()=>m.join('17'),/16/);
  m.assign(ps[0].id,7);assert.equal(ps[0].team,7);
  m.disconnect(ps[0].id);assert.equal(m.join('ignored',ps[0].token).id,ps[0].id);
  m.start();assert.throws(()=>m.configure(2),/대기실/);
  m.lobby();m.configure(3);assert.equal(m.players.size,16);
});

test('bucket location gates digging; dirt remains conserved across delivery and theft',()=>{
  const m=new Match();m.configure(2);const a=m.join('A'),b=m.join('B');m.start();
  a.x=0;a.z=0;a.yaw=0;a.turret=0;
  m.action(a.id,'scoop');assert.equal(a.cargo,40);assert.equal(m.central,3960);
  const tip=m.bucket(a);a.x=m.teams[0].x-tip.x;a.z=m.teams[0].z-tip.z;a.cooldown=0;
  m.action(a.id,'drop');assert.equal(m.teams[0].dirt,40);assert.equal(a.cargo,0);
  b.x=a.x;b.z=a.z;b.yaw=0;b.turret=0;b.cooldown=0;
  m.action(b.id,'scoop');assert.equal(b.cargo,40);assert.equal(m.teams[0].dirt,0);assert.match(b.message,/훔쳤/);
  assert.equal(m.central+m.teams.reduce((n,t)=>n+t.dirt,0)+a.cargo+b.cargo,4000);
  b.boom=1.35;b.stick=-.25;b.cooldown=0;b.cargo=0;m.action(b.id,'scoop');assert.equal(b.cargo,0);
});

test('stolen dirt can be discarded immediately outside the opponent zone by opening the bucket',()=>{
  const m=new Match();m.configure(2);const p=m.join('Saboteur');m.start();
  const opponent=m.teams[1];opponent.dirt=40;
  p.yaw=0;p.turret=0;
  const tip=m.bucket(p);p.x+=opponent.x-tip.x;p.z+=opponent.z-tip.z;
  m.action(p.id,'scoop');assert.equal(p.cargo,40);assert.equal(opponent.dirt,0);
  assert.match(p.message,/훔쳤/);
  const loadedTip=m.bucket(p);p.x+=opponent.x+3.11-loadedTip.x;
  p.curl=-.48;
  m.input(p.id,{curl:-1},1000);m.tick(.45,1000);
  assert(!m.teams.some(t=>m.inZone(m.bucket(p),t)));
  assert.equal(p.cargo,0);assert.equal(opponent.dirt,0);assert.equal(m.teams[0].dirt,0);
  assert.match(p.message,/구역 밖/);
  assert.equal(m.groundPiles.length,1);assert.equal(m.groundPiles[0].dirt,40);
  const loose=m.groundPiles[0];p.curl=-.7;
  const recoveryTip=m.bucket(p);p.x+=loose.x-recoveryTip.x;p.z+=loose.z-recoveryTip.z;p.cooldown=0;
  m.action(p.id,'scoop');assert.equal(p.cargo,40);assert.equal(m.groundPiles.length,0);
  const deliveryTip=m.bucket(p);p.x+=opponent.x-deliveryTip.x;p.z+=opponent.z-deliveryTip.z;p.cooldown=0;
  m.action(p.id,'drop');assert.equal(opponent.dirt,40);assert.equal(p.cargo,0);
});

test('unloading has no location or height restriction and empty drops award no dirt',()=>{
  const m=new Match(),p=m.join('Operator');m.start();
  for(const [x,z] of [[0,0],[10,10],[-10,-10],[ARENA.driveLimit,ARENA.driveLimit]]) {
    p.x=x;p.z=z;p.boom=1.35;p.stick=-.25;p.cargo=40;p.cooldown=0;
    m.action(p.id,'drop');assert.equal(p.cargo,0);assert.equal(m.central,4000);
    assert(m.teams.every(t=>t.dirt===0));assert.match(p.message,/구역 밖/);
  }
  p.cooldown=0;m.action(p.id,'drop');assert.match(p.message,/비어/);
  assert.equal(m.groundPiles.reduce((sum,s)=>sum+s.dirt,0),160);
  assert.equal(m.snapshot().groundPiles.length,4);
  m.lobby();assert.equal(m.groundPiles.length,0);
});

test('any team can recover loose dirt, repeated drops merge, and partial scoops conserve dirt',()=>{
  const m=new Match();m.configure(2);const a=m.join('A'),b=m.join('B');m.start();
  a.x=10;a.z=10;a.cargo=40;m.central-=40;
  m.action(a.id,'drop');a.cargo=40;m.central-=40;a.cooldown=0;m.action(a.id,'drop');
  assert.equal(m.groundPiles.length,1);assert.equal(m.groundPiles[0].dirt,80);
  const loose=m.groundPiles[0],tip=m.bucket(b);b.x+=loose.x-tip.x;b.z+=loose.z-tip.z;
  b.cargo=20;m.central-=20;
  m.action(b.id,'scoop');assert.equal(b.cargo,40);assert.equal(loose.dirt,60);
  assert.equal(m.central+a.cargo+b.cargo+m.teams.reduce((sum,t)=>sum+t.dirt,0)+m.groundPiles.reduce((sum,s)=>sum+s.dirt,0),4000);
  m.lobby();m.start();assert.equal(m.groundPiles.length,0);
});

test('separate tracks steer and ISO axes articulate; stale input stops the machine',()=>{
  const m=new Match(),p=m.join('A');m.start();p.x=0;p.z=8;p.yaw=0;
  m.input(p.id,{travelL:1,travelR:1,swing:1,boom:1,stick:1,curl:1},1000);
  m.tick(.1,1000);assert(p.z>8);assert.equal(p.yaw,0);assert(p.turret>0);assert(p.boom>.42);assert(p.stick>-1.4);assert(p.curl>-.7);
  const before=[p.x,p.z,p.yaw,p.boom,p.turret];m.tick(.1,2000);assert.deepEqual([p.x,p.z,p.yaw,p.boom,p.turret],before);
  m.input(p.id,{travelL:1,travelR:-1},2000);m.tick(.1,2000);assert(p.yaw>0);assert.equal(p.z,before[1]);
  m.disconnect(p.id);const yaw=p.yaw;m.tick(.1,2000);assert.equal(p.yaw,yaw);
  m.remaining=.01;m.tick(.1);assert.equal(m.phase,'finished');
});

test('closing and opening the bucket via joystick transfers dirt without action buttons',()=>{
  const m=new Match();m.configure(2);const p=m.join('Operator');m.start();
  p.x=0;p.z=0;p.yaw=0;p.turret=0;p.curl=.05;
  m.input(p.id,{curl:1},1000);m.tick(.1,1000);assert.equal(p.cargo,40);
  const tip=m.bucket(p);p.x=m.teams[0].x-tip.x;p.z=m.teams[0].z-tip.z;p.curl=-.48;p.cooldown=0;
  m.input(p.id,{curl:-1},1000);m.tick(.1,1000);assert.equal(p.cargo,0);assert.equal(m.teams[0].dirt,40);
});

test('curl moves the actual teeth and all articulated axes stop at the ground',()=>{
  const m=new Match(),p=m.join('Operator');m.start();
  const open=m.bucket(p);p.curl=.4;const closed=m.bucket(p);
  assert(closed.height>open.height+.1,'closing must lift the teeth');
  assert(Math.hypot(closed.x-p.x,closed.z-p.z)<Math.hypot(open.x-p.x,open.z-p.z)-.2,'closing must draw the teeth toward the body');
  p.curl=-.7;p.stick=-1.7;
  const pulled=m.bucket(p);
  assert(Math.hypot(pulled.x-p.x,pulled.z-p.z)<Math.hypot(open.x-p.x,open.z-p.z),'pulling the arm must reduce reach');
  m.lobby();m.start();assert(m.bucket(p).height>=.02);
  let now=1000;
  for(let step=0;step<400;step++) {
    const control=step<100?{boom:-1,curl:-1,stick:-1}:step<200?{boom:1,curl:1,stick:1}:step<300?{boom:-1,stick:1,curl:-1}:{boom:1,stick:-1,curl:1};
    m.input(p.id,control,now);m.tick(.05,now);now+=50;
    assert(m.bucket(p).height>=.01999,`ground penetration at ${step}`);
  }
});

test('raised bucket can unload at a visible square zone corner; empty ground cannot be mined',()=>{
  const m=new Match();m.configure(2);const p=m.join('Operator');m.start();p.yaw=0;p.turret=0;
  p.boom=1.2;p.stick=-.4;p.curl=-.8;p.cargo=40;
  const offset=m.bucket(p);p.x+=m.teams[0].x+2.9-offset.x;p.z+=m.teams[0].z+2.9-offset.z;
  assert(m.bucket(p).height>1.1);m.action(p.id,'drop');assert.equal(m.teams[0].dirt,40);assert.equal(p.cargo,0);
  // The coloured scoring zone is larger than its visible dirt mound.
  p.cooldown=0;m.action(p.id,'scoop');assert.equal(p.cargo,0);assert.equal(m.teams[0].dirt,40);
});

test('final results rank ties equally, omit empty teams and survive ceremony and reconnect',()=>{
  const m=new Match();m.configure(4);
  const players=Array.from({length:4},(_,i)=>m.join(`결과 ${i}`));
  m.assign(players[3].id,0);m.start();
  m.teams[0].dirt=80;m.teams[1].dirt=80;m.teams[2].dirt=40;
  players[0].delivered=80;players[1].delivered=80;players[2].delivered=80;players[3].delivered=40;
  m.tick(901,1000);
  assert.deepEqual(m.results.winnerIds,[0,1]);
  assert.deepEqual(m.results.teams.map(t=>[t.id,t.rank,t.score]),[[0,1,80],[1,1,80],[2,3,40]]);
  assert.deepEqual(m.results.players.map(p=>p.rank),[1,1,1,4]);
  const result=structuredClone(m.results),a=players[0],loser=players[2];
  assert.equal(a.yaw,0);assert.equal(a.z,ARENA.driveLimit);
  const pos=[a.x,a.z,a.yaw],loserPose=[loser.turret,loser.boom];
  m.input(a.id,{travelL:1,travelR:-1,swing:1,boom:1,stick:1,curl:1},2000);
  m.input(loser.id,{swing:1,boom:1},2000);
  const before=a.turret;m.tick(.1,2000);assert(a.turret>before);
  assert.deepEqual([a.x,a.z,a.yaw],pos);assert.deepEqual([loser.turret,loser.boom],loserPose);
  m.action(a.id,'scoop');m.action(a.id,'drop');assert.deepEqual(m.results,result);
  m.disconnect(a.id);m.join('ignored',a.token);assert.equal(a.delivered,80);
  const stopped=a.turret;m.tick(.1,3000);assert.equal(a.turret,stopped);
  m.lobby();assert.equal(m.results,null);assert.equal(a.delivered,0);
});

test('disruption counts only actual sand removed from an opponent and resets for the next round',()=>{
  const m=new Match();m.configure(2);const p=m.join('방해꾼');m.start();
  const position=zone=>{const tip=m.bucket(p);p.x+=zone.x-tip.x;p.z+=zone.z-tip.z;p.cooldown=0;};
  p.x=0;p.z=0;p.yaw=0;p.turret=0;m.action(p.id,'scoop');assert.equal(p.disrupted,0);
  p.cargo=0;m.teams[0].dirt=400;position(m.teams[0]);m.action(p.id,'scoop');assert.equal(p.disrupted,0);
  p.cargo=20;m.teams[1].dirt=400;position(m.teams[1]);m.action(p.id,'scoop');assert.equal(p.disrupted,20);
  p.cooldown=0;m.action(p.id,'scoop');assert.equal(p.disrupted,20);
  p.cargo=0;p.boom=1.35;p.stick=-.25;p.cooldown=0;m.action(p.id,'scoop');assert.equal(p.disrupted,20);
  p.boom=.50;p.stick=-1.4;p.curl=-.7;position(m.teams[1]);m.action(p.id,'scoop');assert.equal(p.disrupted,60);
  m.disconnect(p.id);m.join('ignored',p.token);assert.equal(p.disrupted,60);
  m.tick(901);assert.equal(m.results.players[0].disrupted,60);
  m.lobby();assert.equal(p.disrupted,0);m.start();assert.equal(p.disrupted,0);
});

test('individual record counts own-team deliveries only and zero-score matches have no winners',()=>{
  const m=new Match();m.configure(2);const p=m.join('운반자');m.start();
  const place=team=>{const tip=m.bucket(p);p.x+=team.x-tip.x;p.z+=team.z-tip.z;p.cooldown=0;p.cargo=40;};
  place(m.teams[0]);m.action(p.id,'drop');assert.equal(p.delivered,40);
  place(m.teams[1]);m.action(p.id,'drop');assert.equal(p.delivered,40);
  p.x=12;p.z=12;p.cargo=40;p.cooldown=0;m.action(p.id,'drop');assert.equal(p.delivered,40);
  m.lobby();m.start();m.tick(901);assert.deepEqual(m.results.winnerIds,[]);
  assert.equal(m.results.players[0].score,0);
});

function peer(port) {
  const ws=new WebSocket(`ws://127.0.0.1:${port}`),messages=[],waiters=[];
  ws.on('message',raw=>{const m=JSON.parse(raw);messages.push(m);for(const w of [...waiters])if(w.predicate(m)){waiters.splice(waiters.indexOf(w),1);clearTimeout(w.timer);w.resolve(m);}});
  return {ws,open:new Promise(resolve=>ws.on('open',resolve)),send:m=>ws.send(JSON.stringify(m)),wait:predicate=>{
    const found=messages.find(predicate);if(found)return Promise.resolve(found);
    return new Promise((resolve,reject)=>{const waiter={predicate,resolve,timer:setTimeout(()=>reject(Error('Message timeout')),3000)};waiters.push(waiter);});
  }};
}

test('remote server publishes only its public URL and never exposes host credentials through a loopback proxy',async()=>{
  const key='test-host-key-'.repeat(4),publicUrl='https://dirt-rally.115.68.208.145.sslip.io';
  const app=await createServer({port:0,host:'127.0.0.1',publicUrl:publicUrl+'/',hostKey:key});
  try {
    const base=`http://127.0.0.1:${app.port}`;
    const response=await fetch(base+'/config',{headers:{'X-Forwarded-For':'127.0.0.1'}});
    const cfg=await response.json();
    assert.equal(response.headers.get('cache-control'),'no-store');
    assert.deepEqual(cfg.addresses,[publicUrl]);assert.equal(cfg.joinAddress,publicUrl);
    assert.equal(cfg.hostAuth,'token');assert.equal(cfg.adminKey,null);assert(!JSON.stringify(cfg).includes(key));
    const host=peer(app.port);await host.open;
    host.send({type:'host',key:'wrong'});await host.wait(m=>m.type==='error');
    host.send({type:'host',key});await host.wait(m=>m.type==='host-ready');
    host.send({type:'configure',teams:3,duration:60});await host.wait(m=>m.teamCount===3);
    host.send({type:'network',address:'http://192.168.1.50:3000'});await host.wait(m=>m.type==='error');
    const phone=peer(app.port);await phone.open;
    phone.send({type:'join',room:cfg.room,name:'원격 운전자'});await phone.wait(m=>m.type==='joined');
    host.send({type:'start'});await phone.wait(m=>m.phase==='running');
    phone.send({type:'input',travelL:1,travelR:1});
    await new Promise(r=>setTimeout(r,50));assert.equal([...app.match.players.values()][0].input.travelL,1);
    const display=peer(app.port);await display.open;display.send({type:'display'});await display.wait(m=>m.type==='error');
    const QRCode=(await import('qrcode')).default;
    const qr=await fetch(base+'/qr?address=http://untrusted.example').then(r=>r.text());
    assert.equal(qr,await QRCode.toString(`${publicUrl}/controller?room=${cfg.room}`,{type:'svg',margin:2}));
  } finally {await app.close();}
});

test('public URL requires a strong host key and rejects ambiguous URL paths and credentials',async()=>{
  await assert.rejects(createServer({publicUrl:'https://example.com'}),/HOST_KEY/);
  for(const publicUrl of ['ftp://example.com','https://example.com/game','https://user:pass@example.com','https://example.com/?x=1','https://example.com/#fragment']) {
    await assert.rejects(createServer({publicUrl,hostKey:'x'.repeat(48)}),/PUBLIC_URL/);
  }
});

test('chat broadcasts trusted names, validates messages, limits repeats and restores history',async()=>{
  const app=await createServer({port:0,host:'127.0.0.1',manualTick:true});
  try {
    const a=peer(app.port),b=peer(app.port);await Promise.all([a.open,b.open]);
    a.send({type:'join',room:app.room,name:'운전자'});b.send({type:'join',room:app.room,name:'친구'});
    const identity=await a.wait(m=>m.type==='joined');await b.wait(m=>m.type==='joined');
    const cfg=await fetch(`http://127.0.0.1:${app.port}/config`).then(r=>r.json());
    const host=peer(app.port),display=peer(app.port);await Promise.all([host.open,display.open]);
    host.send({type:'host',key:cfg.adminKey});display.send({type:'display'});
    await host.wait(m=>m.type==='host-ready');await display.wait(m=>m.type==='chat-history');
    a.send({type:'chat',text:'  안녕하세요 <script>  ',name:'가짜',playerId:'가짜'});
    const received=await b.wait(m=>m.type==='chat');
    assert.equal(received.message.name,'운전자');assert.equal(received.message.playerId,identity.id);
    assert.equal(received.message.text,'안녕하세요 <script>');
    assert.deepEqual((await a.wait(m=>m.type==='chat')).message,received.message);
    assert.deepEqual((await host.wait(m=>m.type==='chat')).message,received.message);
    assert.deepEqual((await display.wait(m=>m.type==='chat')).message,received.message);
    a.send({type:'chat',text:'연속 전송'});assert.match((await a.wait(m=>m.type==='chat-error')).message,/잠시/);
    b.send({type:'chat',text:' '.repeat(5)});assert.match((await b.wait(m=>m.type==='chat-error')).message,/1~200/);
    b.send({type:'chat',text:'x'.repeat(201)});
    const reconnect=peer(app.port);await reconnect.open;reconnect.send({type:'join',room:app.room,token:identity.token});
    assert.deepEqual((await reconnect.wait(m=>m.type==='chat-history')).messages,[received.message]);
    assert.equal((await reconnect.wait(m=>m.type==='joined')).id,identity.id);
  } finally {await app.close();}
});

test('real WebSockets: QR, 16 concurrent clients, capacity, host access, reconnect and game controls',async()=>{
  const app=await createServer({port:0,host:'127.0.0.1',manualTick:true});
  try {
    const cfg=await fetch(`http://127.0.0.1:${app.port}/config`).then(r=>r.json());
    assert.equal(cfg.app,'dirt-rally');assert.equal(cfg.protocol,1);assert(cfg.addresses.includes(cfg.joinAddress));
    const qr=await fetch(`http://127.0.0.1:${app.port}/qr`).then(r=>r.text());assert(qr.includes('<svg'));
    const rejectedHost=peer(app.port);await rejectedHost.open;rejectedHost.send({type:'host',key:'invalid'});
    assert.match((await rejectedHost.wait(m=>m.type==='error')).message,/접속 정보/);
    const host=peer(app.port);await host.open;host.send({type:'host',key:cfg.adminKey});await host.wait(m=>m.type==='host-ready');await host.wait(m=>m.type==='state');
    host.send({type:'network',address:cfg.addresses[0]});
    assert.equal((await host.wait(m=>m.connection?.address===cfg.addresses[0])).connection.room,cfg.room);
    host.send({type:'network',address:'http://unrelated.example:3000'});
    assert.match((await host.wait(m=>m.type==='error')).message,/네트워크/);
    host.send({type:'configure',teams:8,duration:60});await host.wait(m=>m.teamCount===8);
    const clients=Array.from({length:16},()=>peer(app.port));await Promise.all(clients.map(c=>c.open));
    clients.forEach((c,i)=>c.send({type:'join',room:cfg.room,name:`Phone ${i}`}));
    const identities=await Promise.all(clients.map(c=>c.wait(m=>m.type==='joined')));assert.equal(new Set(identities.map(p=>p.id)).size,16);
    const extra=peer(app.port);await extra.open;extra.send({type:'join',room:cfg.room,name:'17'});assert.match((await extra.wait(m=>m.type==='error')).message,/16/);
    clients[0].send({type:'configure',teams:1,duration:30});await new Promise(r=>setTimeout(r,80));assert.equal(app.match.teamCount,8);
    host.send({type:'start'});await host.wait(m=>m.phase==='running');
    clients[0].send({type:'input',travelL:1,travelR:1});await new Promise(r=>setTimeout(r,30));assert.equal(app.match.players.get(identities[0].id).input.travelL,1);
    const reconnect=peer(app.port);await reconnect.open;reconnect.send({type:'join',room:cfg.room,token:identities[0].token});assert.equal((await reconnect.wait(m=>m.type==='joined')).id,identities[0].id);
    await new Promise(r=>setTimeout(r,50));assert.equal(app.match.players.get(identities[0].id).connected,true);
    reconnect.ws.close();await new Promise(r=>setTimeout(r,50));assert.equal(app.match.players.get(identities[0].id).connected,false);
    assert(!JSON.stringify(app.match.snapshot()).includes(identities[1].token));
  } finally {await app.close();}
});
