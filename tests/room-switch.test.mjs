import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createServer} from '../server.mjs';

test('one phone connection plays both games repeatedly with the same room and identity',async()=>{
  const app=await createServer({host:'127.0.0.1',port:0,manualTick:true});
  const clients=[];
  async function connect(hello){
    const ws=new WebSocket(`ws://127.0.0.1:${app.port}`);clients.push(ws);
    const messages=[];ws.on('message',raw=>messages.push(JSON.parse(raw)));
    await once(ws,'open');ws.send(JSON.stringify(hello));
    return {ws,messages,send:m=>ws.send(JSON.stringify(m))};
  }
  async function wait(client,predicate){
    const deadline=Date.now()+3000;
    while(Date.now()<deadline){const m=client.messages.find(predicate);if(m)return m;await new Promise(r=>setTimeout(r,10));}
    throw Error('State did not arrive');
  }
  try{
    const cfg=await fetch(`http://127.0.0.1:${app.port}/config`).then(r=>r.json());
    const host=await connect({type:'host',key:cfg.adminKey});await wait(host,m=>m.type==='host-ready');
    const phone=await connect({type:'join',room:app.room,name:'한 번 참가'});
    const joined=await wait(phone,m=>m.type==='joined');
    for(const game of ['excavator','racing','excavator','racing']){
      phone.messages.length=0;host.send({type:'game',game});
      const state=await wait(phone,m=>m.type==='state'&&m.game===game&&m.phase==='lobby');
      assert.equal(state.connection.room,app.room);assert.equal(state.players.length,1);
      assert.equal(state.players[0].id,joined.id);assert.equal(state.players[0].name,'한 번 참가');
      assert.equal(state.players[0].connected,true);
      host.send({type:'start'});await wait(phone,m=>m.phase==='running'&&m.game===game);
      phone.send({type:'input',...(game==='racing'?{throttle:1}:{travelL:1})});
      await new Promise(r=>setTimeout(r,30));
      assert.equal(app.match.players.get(joined.id).input[game==='racing'?'throttle':'travelL'],1);
      host.send({type:'lobby'});await new Promise(r=>setTimeout(r,60));
    }
    assert.equal(phone.messages.filter(m=>m.type==='joined').length,0);
    assert.equal(phone.ws.readyState,WebSocket.OPEN);
    assert.equal(app.match.players.get(joined.id).token,joined.token);
  }finally{for(const ws of clients)ws.terminate();await app.close();}
});
