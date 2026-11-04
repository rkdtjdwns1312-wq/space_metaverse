import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {ART_LIMITS as L,blankArtDrawing,normalizeArtDrawing} from '../shared/art-studio.js';
import {validateArtStudio,saveArt,deleteArt,listArt,getArt} from '../server/art-studio.js';
const now=Date.parse('2026-11-04T02:00:00Z'),drawing=()=>({version:1,background:'#ffffff',strokes:[{tool:'brush',color:'#aabbcc',width:8,points:[[0,0],[600,400]]}]}),draft=(n=0)=>({requestId:`art-request-${n}`,title:`그림 ${n}`,drawing:drawing()});
const player=id=>({id,role:'student',nickname:id});
test('drawing validation bounds colors, tools, coordinates, strokes, points and encoded size',()=>{
 assert.deepEqual(normalizeArtDrawing(drawing()),drawing());assert.deepEqual(normalizeArtDrawing(blankArtDrawing()),blankArtDrawing());
 for(const change of [d=>d.version=2,d=>d.url='https://example.test',d=>d.background='url(x)',d=>d.strokes[0].color='#fff',d=>d.strokes[0].tool='image',d=>d.strokes[0].width=41,d=>d.strokes[0].width=1.5,d=>d.strokes[0].points=[[601,0]],d=>d.strokes[0].points=[[0,401]],d=>d.strokes[0].points=[[-1,1]],d=>d.strokes[0].points=[[NaN,1]],d=>d.strokes[0].points=[[.5,1]],d=>d.strokes[0].points=[[0,0,1]],d=>d.strokes[0].points=[],d=>d.strokes[0].points=Array.from({length:1001},()=>[0,0]),d=>d.strokes=Array.from({length:101},()=>drawing().strokes[0]),d=>d.strokes=Array.from({length:7},()=>({...drawing().strokes[0],points:Array.from({length:1000},()=>[1,1])}))]){const d=drawing();change(d);assert.equal(normalizeArtDrawing(d),null);}
 const maximum={...drawing(),strokes:Array.from({length:100},()=>({...drawing().strokes[0],points:Array.from({length:60},()=>[600,400])}))};assert(normalizeArtDrawing(maximum));assert(Buffer.byteLength(JSON.stringify({...draft(),drawing:maximum}))<128*1024);assert.equal(L.works,10);
});
test('ten works, idempotent new save, revision editing at capacity and deletion preserve other artwork',()=>{
 const p=player('a');for(let i=0;i<10;i++)saveArt(p,draft(i),now);assert.equal(p.artStudio.length,10);assert.equal(saveArt(p,draft(0),now).work.id,p.artStudio[0].id);
 const replay=saveArt(p,{...draft(0),title:'아직 저장하지 않은 수정'},now);assert.equal(replay.replayed,true);assert.equal(replay.work.title,'그림 0');
 const before=structuredClone(p);assert.throws(()=>saveArt(p,draft(10),now),/10개/);assert.deepEqual(p,before);
 const w=p.artStudio[0],edited=saveArt(p,{...draft(),id:w.id,revision:1,title:'새 제목'},now+1).work;assert.equal(edited.revision,2);assert.equal(p.artStudio.length,10);
 assert.throws(()=>saveArt(p,{...draft(),id:w.id,revision:1},now+2),/다른 창/);assert.throws(()=>deleteArt(p,{id:w.id,revision:1}),/다른 창/);
 deleteArt(p,{id:w.id,revision:2});assert.equal(p.artStudio.length,9);assert.deepEqual(p.artStudio,before.artStudio.slice(1));saveArt(p,draft(10),now+3);assert.equal(p.artStudio.length,10);
});
test('explicit same-class viewing exposes only selected drawing, never foreign class or edit ownership',()=>{
 const a=player('a'),b=player('b'),teacher={id:'teacher',role:'teacher'},room={players:new Map([a,b,teacher].map(p=>[p.id,p]))};const w=saveArt(a,draft(),now).work;
 for(const viewer of [a,b,teacher]){const list=listArt(room,viewer,{ownerId:a.id});assert.equal(list.works.length,1);assert.equal(list.works[0].drawing,undefined);assert.equal(list.works[0].requestId,undefined);assert.deepEqual(getArt(room,viewer,{ownerId:a.id,id:w.id}).work.drawing,w.drawing);assert.throws(()=>getArt(room,viewer,{ownerId:'foreign',id:w.id}));}
 for(const p of [b,teacher]){assert.throws(()=>saveArt(p,{...draft(),ownerId:a.id,id:w.id,revision:1},now));assert.throws(()=>deleteArt(p,{ownerId:a.id,id:w.id,revision:1}));assert.throws(()=>deleteArt(p,{id:w.id,revision:1}));}
 assert.throws(()=>saveArt(teacher,draft(),now));assert.equal(a.artStudio[0].revision,1);
});
test('legacy defaults and bounded persisted records round trip; malformed or duplicate records reject',()=>{
 assert.deepEqual(validateArtStudio(),[]);const p=player('a');saveArt(p,draft(),now);assert.deepEqual(validateArtStudio(JSON.parse(JSON.stringify(p.artStudio))),p.artStudio);
 for(const change of [a=>a.push(a[0]),a=>a[0].revision=0,a=>a[0].updatedAt=now-1,a=>a[0].drawing.data='!!!!',a=>a[0].title='',a=>a[0].title='x'.repeat(41),a=>a[0].requestId='bad']){const state=structuredClone(p.artStudio);change(state);assert.throws(()=>validateArtStudio(state));}
});

test('compact persisted drawings migrate legacy JSON, reject corruption and bounded inflation, and expose only decoded selected art',()=>{
 const p=player('a'),created=saveArt(p,draft(),now).work;
 assert.equal(p.artStudio[0].drawing.encoding,'deflate-json-v1');
 assert.equal(p.artStudio[0].drawing.strokes,undefined);
 const legacy=[{...p.artStudio[0],drawing:drawing()}],migrated=validateArtStudio(legacy);
 assert.deepEqual(migrated,p.artStudio);
 const room={players:new Map([[p.id,p]])};
 assert.deepEqual(getArt(room,p,{id:created.id}).work.drawing,drawing());
 assert.equal(JSON.stringify(listArt(room,p)).includes('deflate-json'),false);
 for(const content of ['not json',JSON.stringify({...drawing(),background:'invalid'}),'x'.repeat(L.bytes+1)]){
  const corrupt=structuredClone(p.artStudio);corrupt[0].drawing.data=deflateRawSync(Buffer.from(content)).toString('base64');
  assert.throws(()=>validateArtStudio(corrupt));
 }
 const corrupt=structuredClone(p.artStudio);corrupt[0].drawing.data='AAAA';assert.throws(()=>validateArtStudio(corrupt));
 // Even a corrupt persisted compressed stream is not decoded by the explicitly
 // trusted hot snapshot path; full startup validation above always rejects it.
 assert.deepEqual(validateArtStudio(corrupt,{trustedCompact:true}),corrupt);
 assert.throws(()=>saveArt(p,{...draft(1),drawing:p.artStudio[0].drawing},now));
});
