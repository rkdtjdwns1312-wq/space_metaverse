// Synthetic, isolated classroom data only. Run before/after a transaction change.
import {performance} from 'node:perf_hooks';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PersistentRoomStore,toRecord,pinHash} from '../server/persistent-rooms.js';
import {monstersOf} from '../server/monsters.js';

const scoped=process.argv.includes('--scoped'),pin=pinHash('1234');
for(const count of [1,5,10]){
 const dir=mkdtempSync(join(tmpdir(),'transaction-benchmark-')),store=new PersistentRoomStore(dir,{maxActiveRooms:10});
 try{
  const rooms=[];
  for(let n=0;n<count;n++){
   const names=Array.from({length:35},(_,i)=>String(i+1));
   const {room}=store.create({title:'측정',allowedNames:names},'teacher-'+n);rooms.push(room);
   for(const name of names){const p=store.add(room,name,'student','student-'+n+'-'+name);p.pin=structuredClone(pin);
    p.inventory=[{id:'star-crumb',quantity:50}];p.notes=Array.from({length:20},(_,i)=>({id:String(i),text:'synthetic note',at:1700000000000+i}));}
   monstersOf(room);store.records.set(room.code,structuredClone(toRecord(room)));
  }
  const room=rooms[0],player=[...room.players.values()].find(p=>p.role==='student'),diskSave=store.files.save.bind(store.files);
  const measure=(work,runs)=>{const samples=[];for(let i=0;i<runs+5;i++){const at=performance.now();store.transact(work,scoped?room:undefined);if(i>=5)samples.push(performance.now()-at);}samples.sort((a,b)=>a-b);return {medianMs:+samples[Math.floor(samples.length/2)].toFixed(2),p95Ms:+samples[Math.floor(samples.length*.95)].toFixed(2)};};
  store.files.save=()=>{};
  const cpu=measure(()=>{player.starShards++;},30),noop=measure(()=>{},30);
  store.files.save=diskSave;
  const durable=measure(()=>{player.starShards++;},10);
  console.log(JSON.stringify({rooms:count,students:count*35,scoped,cpu,noop,durable}));
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
}
