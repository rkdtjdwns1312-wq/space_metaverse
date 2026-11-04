import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {PersistentRoomStore,toRecord} from '../server/persistent-rooms.js';
import {saveArt,validateArtStudio} from '../server/art-studio.js';
import {normalizeArtDrawing} from '../shared/art-studio.js';
mkdirSync('.local/art-storage',{recursive:true});
const directory=mkdtempSync('.local/art-storage/fixture-'),store=new PersistentRoomStore(directory);
const names=Array.from({length:35},(_,i)=>`검사${i+1}`),{room}=store.create({allowedNames:names},'teacher');
for(const nickname of names)store.createStudent(room,{nickname,pin:'1234'});
const students=[...room.players.values()].filter(p=>p.role==='student'),results=[];
let seed=12345;const random=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};
const timing=fn=>{const start=performance.now();fn();return Math.round((performance.now()-start)*100)/100;};
try{
 for(const noisy of [false,true]){
  const drawing={version:1,background:'#ffffff',strokes:Array.from({length:100},()=>({tool:'brush',color:'#123456',width:8,points:Array.from({length:60},()=>noisy?[random(601),random(401)]:[600,400])}))};
  for(const p of students){p.artStudio=[];for(let i=0;i<10;i++)saveArt(p,{requestId:`benchmark-${i}`,title:`그림 ${i}`,drawing},1);}
  const compact=students.map(p=>p.artStudio),legacy=compact.map(works=>works.map(w=>({...w,drawing:structuredClone(drawing)})));
  const legacyValidationMs=timing(()=>legacy.forEach(works=>works.forEach(w=>normalizeArtDrawing(w.drawing))));
  const compactValidationMs=timing(()=>compact.forEach(works=>validateArtStudio(works,{trustedCompact:true})));
  const legacySnapshotMs=timing(()=>{const backup=structuredClone({runtime:legacy,records:legacy});const candidate=legacy.map(works=>works.map(w=>({...w,drawing:normalizeArtDrawing(w.drawing)})));JSON.stringify(candidate)===JSON.stringify(backup.records);});
  const compactSnapshotMs=timing(()=>{const backup=structuredClone({runtime:compact,records:compact});const candidate=compact.map(works=>validateArtStudio(works,{trustedCompact:true}));JSON.stringify(candidate)===JSON.stringify(backup.records);});
  const record=toRecord(room);store.files.save(record);store.records.set(room.code,record);
  const transactions=Array.from({length:5},()=>timing(()=>store.transact(()=>{students[0].cosmicEnergy++;},room)));
  results.push({type:noisy?'6000 independent random points':'6000 repeated points',students:35,works:350,legacyArtBytes:Buffer.byteLength(JSON.stringify(legacy)),compactArtBytes:Buffer.byteLength(JSON.stringify(compact)),legacyValidationMs,compactValidationMs,legacySnapshotMs,compactSnapshotMs,fullScopedTransactionWithDiskMs:transactions});
 }
 writeFileSync('.local/art-storage/benchmark.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{store.files.close();}
