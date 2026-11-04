import assert from 'node:assert/strict';
import {once} from 'node:events';
import {WebSocket} from 'ws';
import {createServer} from '../server.mjs';
const app=await createServer({host:'127.0.0.1',port:0,manualTick:true}),clients=[];
const base=`http://127.0.0.1:${app.port}`;
async function connect(hello){const ws=new WebSocket(base.replace('http:','ws:')),messages=[];clients.push(ws);ws.on('message',b=>messages.push(JSON.parse(b)));await once(ws,'open');ws.send(JSON.stringify(hello));return {ws,messages,send:v=>ws.send(JSON.stringify(v))};}
async function wait(c,fn){const start=Date.now();while(Date.now()-start<3000){const v=c.messages.find(fn);if(v)return v;await new Promise(r=>setTimeout(r,10));}throw Error('Timed out');}
try{
 for(const path of ['/mole-view.js','/mole-controller.js','/mole.css'])assert.equal((await fetch(base+path)).status,200);
 const config=await fetch(base+'/config').then(r=>r.json()),host=await connect({type:'host',key:config.adminKey});await wait(host,m=>m.type==='host-ready');host.send({type:'game',game:'mole'});await wait(host,m=>m.game==='mole');
 const phones=await Promise.all(Array.from({length:16},(_,i)=>connect({type:'join',room:app.room,name:'친구 '+i})));const users=await Promise.all(phones.map(p=>wait(p,m=>m.type==='joined')));host.send({type:'start'});await wait(host,m=>m.phase==='running');
 phones[1].send({type:'mole',action:'pop',hole:4,id:users[0].id});await wait(phones[1],m=>m.phase==='running');assert(!app.match.mole.visible);
 phones[0].send({type:'mole',action:'pop',hole:4});const up=await wait(host,m=>m.mole?.visible);for(const p of phones){const same=await wait(p,m=>m.mole?.visible);assert.deepEqual(same.mole,up.mole);}
 phones[1].send({type:'mole',action:'whack',hole:4,serial:up.mole.serial,id:users[2].id});await wait(host,m=>m.players?.some(p=>p.id===users[1].id&&p.score===3));assert.equal(app.match.players.get(users[2].id).score,0);assert.equal(app.match.players.get(users[1].id).score,3);
 phones[1].ws.close();await once(phones[1].ws,'close');const again=await connect({type:'join',room:app.room,token:users[1].token});assert.equal((await wait(again,m=>m.type==='joined')).id,users[1].id);assert.equal(app.match.players.get(users[1].id).score,3);
 for(let i=0;i<16;i++){app.match.mole.turnLeft=.01;app.match.tick(.1);}assert.equal(app.match.phase,'finished');assert.deepEqual(app.match.results.winnerIds,[users[1].id]);host.send({type:'lobby'});await wait(host,m=>m.phase==='lobby'&&m.players?.every(p=>p.score===0));
 console.log('PASS: 16 real WebSocket users share identical board; role and action ownership, hit, reconnect, rotation, winner and reset');
}finally{clients.forEach(c=>c.terminate());await app.close();}
