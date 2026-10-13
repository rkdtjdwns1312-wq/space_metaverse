import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {io} from 'socket.io-client';
import {createClassroomServer} from '../../server/app.js';
import {STREET} from '../../shared/config.js';

export const call=(socket,event,data={})=>socket.timeout(4000).emitWithAck(event,data);
export const ok=result=>{assert.equal(result.ok,true,result.error);return result;};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function readingFixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'reading-rewards-')),sockets=[],key='reading-rewards-test';
 let game,url,teacher,student,other,code,id,otherId,token,closed=true,now=Date.parse('2026-10-13T14:59:59Z');
 async function start(){game=createClassroomServer({teacherKey:key,dataDir:directory,teacherManagedAccounts:false,studentHours:false,clock:()=>now});url=`http://127.0.0.1:${(await game.listen()).port}`;closed=false;}
 async function connect(){const socket=io(url,{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;}
 async function join(){student=await connect();const r=ok(await call(student,'room:join',{code,nickname:'하나',pin:'1234'}));id=r.selfId;token=r.token;other=await connect();otherId=ok(await call(other,'room:join',{code,nickname:'둘',pin:'1234'})).selfId;}
 t.after(async()=>{sockets.forEach(s=>s.disconnect());if(!closed)await game.close();assert(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(directory).startsWith('reading-rewards-'));fs.rmSync(directory,{recursive:true,force:true});});
 await start();teacher=await connect();code=ok(await call(teacher,'room:create',{teacherKey:key,title:'발전소 보상 검사',allowedNames:['하나','둘']})).room.code;await join();
 const f={get game(){return game;},get room(){return game.store.rooms.get(code);},get p(){return f.room.players.get(id);},get q(){return f.room.players.get(otherId);},
  get student(){return student;},get other(){return other;},get teacher(){return teacher;},get teacherPlayer(){return [...f.room.players.values()].find(p=>p.role==='teacher');},get now(){return now;},get token(){return token;},connect,
  advance(ms=86400000){now+=ms;},at(kind,p=f.p){const station=STREET.objects.find(o=>o.kind===kind+'-station');assert(station);Object.assign(p,{mapId:STREET.id,x:station.x,y:station.y+120,input:{x:0,y:0,at:0}});},
  mutate(fn){return game.store.transact(()=>fn(f.p,f.room));},
  async restart(){sockets.forEach(s=>s.disconnect());await game.close();closed=true;await start();teacher=await connect();ok(await call(teacher,'room:open',{teacherKey:key,code}));await join();},
  async reconnect(){student.disconnect();for(let i=0;i<100&&f.p.connected;i++)await wait(20);assert.equal(f.p.connected,false);student=await connect();ok(await call(student,'session:resume',{token}));},
  async fail(fn){const save=game.store.files.save.bind(game.store.files);game.store.files.save=()=>{throw Error('reading disk failure');};try{await fn();}finally{game.store.files.save=save;}}
 };return f;
}
