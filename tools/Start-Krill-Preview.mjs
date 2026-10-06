import {createServer} from '../server.mjs';
const port=Number(process.env.PORT||3003);
const app=await createServer({port,host:'0.0.0.0'});
app.match.selectGame('krill');
console.log(`KRILL ESCAPE · PC: http://localhost:${app.port}\n폰: ${app.addresses.map(a=>a+'/controller?room='+app.room).join(', ')}`);
