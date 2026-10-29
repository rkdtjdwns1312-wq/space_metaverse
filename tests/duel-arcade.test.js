import test from 'node:test';
import assert from 'node:assert/strict';
import {createDuelArcade} from '../server/duel-arcade.js';
import {DUEL_ARCADES,DUEL_MEMORY_SIZES,omokLine,isOmokDoubleThree} from '../shared/duel-arcade.js';
import {onStreetFloor,STREET_LAYOUT} from '../shared/street-layout.js';
import {STREET} from '../shared/config.js';

function fixture(){
  let now=1000,failFinish=false;const events=[],finished=[];
  const makeRoom=code=>({code,players:new Map(['a','b','c','t'].map(id=>[id,{id,nickname:id,role:id==='t'?'teacher':'student',connected:true,socketId:code+id,mapId:'star-street',x:DUEL_ARCADES[0].x,y:DUEL_ARCADES[0].y}]))});
  const rooms=new Map(['one','two'].map(code=>[code,makeRoom(code)]));
  const duel=createDuelArcade({getRoom:code=>rooms.get(code),clock:()=>now,random:n=>n-1,onFinished:value=>{if(failFinish)throw Error('simulated save failure');finished.push(value);},
    emitPrivate:(code,id,event,value)=>events.push({code,id,event,value:structuredClone(value)})});
  const session=(id,code='one')=>({room:rooms.get(code),player:rooms.get(code).players.get(id)});
  const view=(id='a',code='one')=>events.findLast(e=>e.code===code&&e.id===id&&e.event==='duel:state')?.value;
  function start(game='memory',sizeId='3x4',code='one'){
    const machine=DUEL_ARCADES.find(m=>m.gameId===game);
    for(const p of rooms.get(code).players.values())Object.assign(p,{x:machine.x,y:machine.y});
    const pending=duel.invite(session('a',code),{objectId:machine.id,targetId:'b',sizeId}).state.game;
    duel.respond(session('b',code),{inviteId:pending.id,accept:true});return view('a',code).game;
  }
  function move(index,id=view().game.turnId,code='one',extra={}){
    const g=view(id,code).game;return duel.move(session(id,code),{sessionId:g.id,revision:g.revision,index,...extra});
  }
  return {duel,rooms,events,finished,session,view,start,move,setFailFinish:value=>{failFinish=value;},advance:ms=>{now+=ms;duel.onTick();}};
}

test('only a completed Omok match reports one idempotent winner event with classroom and match identity',()=>{
  const f=fixture(),game=f.start('omok'),winner=game.turnId,loser=game.players.find(p=>p.id!==winner).id;
  for(let x=3;x<=7;x++){
    f.move(7*15+x,winner);
    if(x<7)f.move(x,loser);
  }
  assert.equal(f.view().game.phase,'finished');assert.equal(f.view().game.winnerId,winner);
  assert.deepEqual(f.finished,[{roomCode:'one',matchId:game.id,playerId:winner}]);
});

test('failed Omok win persistence leaves the final move retryable and never publishes an unrecorded finish',()=>{
  const f=fixture(),game=f.start('omok'),winner=game.turnId,loser=game.players.find(p=>p.id!==winner).id;
  for(let x=3;x<7;x++){f.move(7*15+x,winner);f.move(x,loser);}
  const finalIndex=7*15+7;f.setFailFinish(true);
  assert.throws(()=>f.move(finalIndex,winner),/simulated save failure/);
  const unchanged=f.view().game;
  assert.equal(unchanged.phase,'playing');assert.equal(unchanged.winnerId,null);assert.equal(unchanged.board[finalIndex],0);
  assert.deepEqual(f.finished,[]);
  f.setFailFinish(false);f.move(finalIndex,winner);
  assert.equal(f.view().game.phase,'finished');assert.equal(f.view().game.winnerId,winner);
  assert.equal(f.finished.length,1);assert.equal(f.finished[0].matchId,game.id);
});

test('both machines including radius fit inside the playground floor',()=>{
  assert.deepEqual(DUEL_ARCADES.map(m=>[m.x,m.y]),[
    [500,STREET_LAYOUT.lower.y-195],
    [1300,STREET_LAYOUT.lower.y-195]
  ]);
  assert.deepEqual(DUEL_ARCADES.map(m=>m.name),['별 그림 짝 맞추기 경쟁 게임','별 오목 경쟁 게임']);
  assert.equal(DUEL_ARCADES[0].x,STREET.objects.find(o=>o.id==='arcade-baseball').x,'그림 짝 맞추기 기계는 숫자야구와 x를 맞춤');
  assert.equal(DUEL_ARCADES[1].x,STREET.objects.find(o=>o.id==='arcade-path').x,'오목 기계는 길 게임과 x를 맞춤');
  assert.ok(DUEL_ARCADES.every(m=>m.y<STREET.objects.find(o=>o.id==='arcade-memory').y-250),'큰 기계와 오락기 줄 사이에 시각적 간격을 둠');
  for(const m of DUEL_ARCADES)assert.equal(onStreetFloor({id:'star-street'},m.x,m.y,m.radius),true,`${m.id} stays on lower playground island`);
});

test('invitation is private; before consent no deck, moves, or resets exist',()=>{
  const f=fixture(),pending=f.duel.invite(f.session('a'),{objectId:'duel-memory',targetId:'b',sizeId:'4x5'}).state.game;
  assert.equal(pending.phase,'invited');assert.equal(pending.sizeId,'4x5');assert.equal(pending.cards,undefined);
  assert.equal(f.events.filter(e=>e.event==='duel:invite').length,1);
  assert.equal(f.events.find(e=>e.event==='duel:invite').id,'b');
  assert.equal(f.events.some(e=>e.id==='c'||e.code==='two'),false);
  assert.throws(()=>f.move(0),/차례/);
  assert.throws(()=>f.duel.proposal(f.session('a'),{sessionId:pending.id,revision:0,kind:'rematch'}),/골라/);
  assert.throws(()=>f.duel.respond(f.session('a'),{inviteId:pending.id,accept:true}),/초대/);
  assert.throws(()=>f.duel.respond(f.session('b','two'),{inviteId:pending.id,accept:true}),/초대/);
});

test('invalid sizes, teacher invites, remote and cross-map targets are refused',()=>{
  const f=fixture();
  for(const sizeId of [undefined,'4x4','100x100',{},null])assert.throws(()=>f.duel.invite(f.session('a'),{objectId:'duel-memory',targetId:'b',sizeId}),/크기/);
  for(const [from,to] of [['a','t'],['t','a'],['a','a']])assert.throws(()=>f.duel.invite(f.session(from),{objectId:'duel-memory',targetId:to,sizeId:'3x4'}),/학생/);
  f.session('b').player.mapId='space-plaza';assert.throws(()=>f.start(),/가까이/);
  f.session('b').player.mapId='star-street';f.session('b').player.x=1000;
  assert.throws(()=>f.duel.invite(f.session('a'),{objectId:'duel-memory',targetId:'b',sizeId:'3x4'}),/가까이/);
});

for(const size of DUEL_MEMORY_SIZES)test(size.id+' server deck stays hidden; matches keep turn, mismatch locks and changes turn',()=>{
  const f=fixture(),g=f.start('memory',size.id),first=g.turnId;
  assert.equal(g.cards.length,size.pairs*2);assert(g.cards.every(c=>c.value===null));
  f.move(0);let state=f.view().game;assert.equal(state.cards.filter(c=>c.value!==null).length,1);
  assert.equal(JSON.stringify(state).includes('deck'),false);
  f.move(size.pairs);state=f.view().game;assert.equal(state.turnId,first);assert.equal(state.players.find(p=>p.id===first).score,1);
  f.move(1);f.move(2);assert.throws(()=>f.move(3),/그림/);
  assert.equal(f.view().game.turnId,first);f.advance(999);assert.equal(f.view().game.turnId,first);
  f.advance(1);state=f.view().game;assert.notEqual(state.turnId,first);assert.equal(state.cards[1].value,null);assert.equal(state.cards[2].value,null);
});

test('revision and session reject click races, replays and forged result/identity data',()=>{
  const f=fixture(),g=f.start(),id=g.turnId,move={sessionId:g.id,revision:g.revision,index:0,winnerId:'a',score:99,playerId:'a',deck:[0,0]};
  f.duel.move(f.session(id),move);
  assert.throws(()=>f.duel.move(f.session(id),{...move,index:1}),/画面|화면/);
  assert.throws(()=>f.duel.move(f.session('c'),{...move,index:2}),/놀이/);
  assert.throws(()=>f.duel.move(f.session(id,'two'),move),/놀이/);
  for(const index of [-1,12,0.3,'2',NaN])assert.throws(()=>f.move(index),/빈칸/);
  assert.throws(()=>f.move(0),/카드/);
  assert.equal(f.view().game.players.reduce((s,p)=>s+p.score,0),0);
  assert.equal(f.view().game.winnerId,null);
});

test('memory completes with most pairs winner and equal scores draw',()=>{
  const f=fixture(),g=f.start(),id=g.turnId;
  for(let i=0;i<6;i++){f.move(i);f.move(i+6);}
  assert.equal(f.view().game.phase,'finished');assert.equal(f.view().game.winnerId,id);
  const d=fixture();d.start();for(let i=0;i<3;i++){d.move(i);d.move(i+6);}
  d.move(3);d.move(4);d.advance(1000);for(let i=3;i<6;i++){d.move(i);d.move(i+6);}
  assert.equal(d.view().game.phase,'finished');assert.equal(d.view().game.winnerId,null);
});

test('rematch and exit require peer consent; rematch preserves chosen size and expires old game IDs',()=>{
  const f=fixture(),g=f.start('memory','5x6');f.move(0);
  let current=f.view().game;
  f.duel.proposal(f.session('a'),{sessionId:current.id,revision:current.revision,kind:'rematch'});
  let p=f.view().game;
  assert.throws(()=>f.move(1),/요청/);
  assert.throws(()=>f.duel.proposalRespond(f.session('a'),{sessionId:p.id,revision:p.revision,proposalId:p.proposal.id,accept:true}),/요청/);
  f.duel.proposalRespond(f.session('b'),{sessionId:p.id,revision:p.revision,proposalId:p.proposal.id,accept:true});
  current=f.view().game;assert.notEqual(current.id,g.id);assert.equal(current.sizeId,'5x6');assert.equal(current.cards.length,30);assert(current.cards.every(c=>c.value===null));
  assert.throws(()=>f.duel.move(f.session(current.turnId),{sessionId:g.id,revision:current.revision,index:0}),/바뀌/);
  f.duel.proposal(f.session('a'),{sessionId:current.id,revision:current.revision,kind:'leave'});p=f.view().game;
  f.duel.proposalRespond(f.session('b'),{sessionId:p.id,revision:p.revision,proposalId:p.proposal.id,accept:false});assert(f.view().game);
  current=f.view().game;f.duel.proposal(f.session('a'),{sessionId:current.id,revision:current.revision,kind:'leave'});p=f.view().game;
  f.duel.proposalRespond(f.session('b'),{sessionId:p.id,revision:p.revision,proposalId:p.proposal.id,accept:true});assert.equal(f.view().game,null);
});

test('disconnect pauses for 30s, timely reconnect resumes, late reconnect ends game',()=>{
  const f=fixture();f.start();f.session('b').player.connected=false;f.advance(1);assert.equal(f.view().game.paused,true);
  assert.throws(()=>f.move(0,'a'),/연결/);f.advance(29999);assert(f.view().game);
  f.session('b').player.connected=true;f.advance(0);assert.equal(f.view().game.paused,false);
  f.session('b').player.connected=false;f.advance(1);f.advance(30000);assert.equal(f.view().game,null);
  const end=f.events.findLast(e=>e.event==='duel:state'&&e.value.game?.phase==='finished');assert.equal(end.value.game.winnerId,'a');
  const late=fixture();late.start();late.session('b').player.connected=false;late.advance(1);
  late.advance(30000);late.session('b').player.connected=true;late.advance(1);assert.equal(late.view().game,null);
});

for(const outcome of ['win','draw'])for(const departure of ['disconnect','map','playerLeft'])
test(`finished ${outcome} stays immutable after ${departure} and the cabinet is released`,()=>{
  const f=fixture();f.start();
  for(let i=0;i<3;i++){f.move(i);f.move(i+6);}
  if(outcome==='draw'){f.move(3);f.move(4);f.advance(1000);}
  for(let i=3;i<6;i++){f.move(i);f.move(i+6);}
  const completed=f.view().game;
  assert.equal(completed.phase,'finished');
  assert.equal(completed.winnerId===null,outcome==='draw');
  const result=g=>({winnerId:g.winnerId,reason:g.reason,scores:g.players.map(p=>p.score),winningLine:g.winningLine});
  const expected=result(completed),departing=completed.winnerId||'b',remaining=completed.players.find(p=>p.id!==departing).id;
  f.duel.open(f.session('t'),{objectId:'duel-memory'});
  if(departure==='disconnect'){
    f.session(departing).player.connected=false;f.advance(0);f.advance(30000);
  }else if(departure==='map'){
    f.session(departing).player.mapId='space-plaza';f.advance(0);
  }else f.duel.playerLeft('one',departing);
  const terminal=f.events.filter(e=>e.event==='duel:state'&&e.value.game?.id===completed.id&&e.value.game.phase==='finished');
  assert(terminal.length>0);
  for(const event of terminal)assert.deepEqual(result(event.value.game),expected);
  assert.equal(f.view(remaining).game,null);assert.equal(f.view('t').game,null);
  assert.equal(f.duel.open(f.session('c'),{objectId:'duel-memory'}).state.busy,false);
});

test('mismatch reveal freezes until BOTH players reconnect, preserving remaining time across repeated pauses',()=>{
  const f=fixture();f.start();f.duel.open(f.session('t'),{objectId:'duel-memory'});
  f.move(0);f.move(1);f.advance(250);
  const first=f.view().game,turn=first.turnId,other=first.players.find(p=>p.id!==turn).id;
  const showing=(viewer,paused)=>{
    const g=f.view(viewer).game;assert.equal(g.paused,paused);assert.equal(g.turnId,turn);
    assert.deepEqual(g.cards,first.cards);assert.equal(g.revealUntil===null,paused);
  };
  f.session(other).player.connected=false;f.advance(0);showing('t',true);
  assert.throws(()=>f.move(2,turn),/연결/);
  f.advance(4000);showing('t',true);
  f.session(turn).player.connected=false;f.advance(0);
  f.session(other).player.connected=true;f.advance(0);f.advance(4000);showing(other,true);
  f.session(turn).player.connected=true;f.advance(0);showing(turn,false);showing(other,false);
  f.advance(300);showing('t',false);
  f.session(other).player.connected=false;f.advance(0);f.advance(2000);showing('t',true);
  f.session(other).player.connected=true;f.advance(0);showing(other,false);
  f.advance(449);showing('t',false);assert.throws(()=>f.move(2,turn),/그림/);
  f.advance(1);
  for(const id of [turn,other,'t']){
    const g=f.view(id).game;assert.equal(g.turnId,other);assert.equal(g.revealUntil,null);
    assert(g.cards.every(card=>card.value===null));
  }
  f.advance(1000);assert.equal(f.view().game.turnId,other,'the turn changes only once');
});

test('disconnect deadline still ends a suspended reveal and rematch starts a fresh reveal timer',()=>{
  const f=fixture();f.start();f.move(0);f.move(1);f.advance(250);
  f.session('b').player.connected=false;f.advance(0);f.advance(30000);
  assert.equal(f.view('a').game,null);
  const terminal=f.events.findLast(e=>e.event==='duel:state'&&e.value.game?.phase==='finished').value.game;
  assert.equal(terminal.winnerId,'a');assert.equal(terminal.reason,'disconnect');
  assert.equal(terminal.revealUntil,null);assert(terminal.cards.every(card=>card.value===null));
  const r=fixture();r.start();r.move(0);r.move(1);r.advance(250);
  r.session('b').player.connected=false;r.advance(0);r.advance(1000);
  r.session('b').player.connected=true;r.advance(0);
  let g=r.view().game;
  r.duel.proposal(r.session('a'),{sessionId:g.id,revision:g.revision,kind:'rematch'});g=r.view().game;
  r.duel.proposalRespond(r.session('b'),{sessionId:g.id,revision:g.revision,proposalId:g.proposal.id,accept:true});
  const restarted=r.view().game;assert.notEqual(restarted.id,g.id);assert.equal(restarted.revealUntil,null);
  assert(restarted.cards.every(card=>card.value===null));
  r.move(0);r.move(1);const turn=r.view().game.turnId;
  r.advance(999);assert.equal(r.view().game.turnId,turn);
  r.advance(1);assert.notEqual(r.view().game.turnId,turn);
});

test('departure, invite expiry, room deletion clean state without leaking to other rooms',()=>{
  const f=fixture();f.start();f.start('memory','3x4','two');f.session('b').player.mapId='space-plaza';f.advance(1);
  assert.equal(f.view().game,null);assert.equal(f.view('a','two').game.phase,'playing');
  f.rooms.delete('two');f.advance(1);
  const e=fixture();e.duel.invite(e.session('a'),{objectId:'duel-memory',targetId:'b',sizeId:'3x4'});e.advance(30000);assert.equal(e.view().game,null);
});

test('teachers spectate current public cards only; other students see occupied machine',()=>{
  const f=fixture();f.start();f.move(0);
  const teacher=f.duel.open(f.session('t'),{objectId:'duel-memory'}).state;
  assert(teacher.game.spectator);assert.equal(teacher.game.cards.filter(c=>c.value!==null).length,1);
  const stranger=f.duel.open(f.session('c'),{objectId:'duel-memory'}).state;assert.equal(stranger.busy,true);assert.equal(stranger.game,null);
  assert.throws(()=>f.duel.move(f.session('t'),{sessionId:teacher.game.id,revision:teacher.game.revision,index:1}),/놀이/);
});

const cell=(x,y)=>y*15+x;
function position(points,white=[]){const board=Array(225).fill(0);for(const [x,y] of points)board[cell(x,y)]=1;for(const [x,y] of white)board[cell(x,y)]=2;return board;}
test('black double-three: straight, broken, diagonals, no mutation',()=>{
  for(const points of [
    [[7,7],[6,7],[8,7],[7,6],[7,8]],
    [[7,7],[5,7],[8,7],[7,5],[7,8]],
    [[7,7],[6,6],[8,8],[6,8],[8,6]]
  ]){const b=position(points),before=[...b];assert.equal(isOmokDoubleThree(b,112),true);assert.deepEqual(b,before);}
});
test('blocked/edge threes, old unrelated threes, and just one direction are legal',()=>{
  const blocked=position([[7,7],[6,7],[8,7],[7,6],[7,8]],[[5,7],[9,7]]);assert.equal(isOmokDoubleThree(blocked,112),false);
  const edge=position([[1,1],[0,1],[2,1],[1,0],[1,2]]);assert.equal(isOmokDoubleThree(edge,16),false);
  const old=position([[3,7],[4,7],[5,7],[7,7],[7,6],[7,8]]);assert.equal(isOmokDoubleThree(old,112),false);
  const straight=position([[7,7],[6,7],[8,7]]);assert.equal(isOmokDoubleThree(straight,112),false);
  const nearEdge=position([[1,7],[2,7],[3,7],[2,6],[2,8]],[[5,7]]);assert.equal(isOmokDoubleThree(nearEdge,cell(2,7)),false);
});
test('five and overline take priority; white double-three and black double-four are legal',()=>{
  for(const n of [5,6]){
    const points=Array.from({length:n},(_,i)=>[i+4,7]);points.push([7,6],[7,8],[6,6],[8,8]);
    const b=position(points);assert.equal(isOmokDoubleThree(b,112),false);assert(omokLine(b,112).length>=5);
  }
  const white=position([],[[7,7],[6,7],[8,7],[7,6],[7,8]]);assert.equal(isOmokDoubleThree(white,112),false);
  const four=position([[7,7],[5,7],[6,7],[8,7],[7,5],[7,6],[7,8]]);assert.equal(isOmokDoubleThree(four,112),false);
});
test('server rejects black 3-3 without revision, turn or board changes; plays five to completion',()=>{
  const f=fixture();f.start('omok');
  for(const [i,p] of [[6,7],[8,7],[7,6],[7,8]].entries()){f.move(cell(...p));f.move(cell(i*2,0));}
  const before=structuredClone(f.view().game);assert.throws(()=>f.move(112),/3·3 자리에는 놓을 수 없어요/);assert.deepEqual(f.view().game,before);
  const w=fixture(),g=w.start('omok'),first=g.turnId;
  for(let i=0;i<5;i++){w.move(cell(i+3,7));if(i<4)w.move(cell(i*2,0));}
  assert.equal(w.view().game.winnerId,first);assert.equal(w.view().game.winningLine.length,5);
});

test('two different machines run independently in one room',()=>{
  const f=fixture();f.start();const room=f.rooms.get('one');
  for(const id of ['d','e'])room.players.set(id,{...room.players.get('c'),id,nickname:id,x:1380});
  const pending=f.duel.invite(f.session('d'),{objectId:'duel-omok',targetId:'e'}).state.game;
  f.duel.respond(f.session('e'),{inviteId:pending.id,accept:true});const old=f.view('d').game;
  f.move(0);assert.deepEqual(f.view('d').game,old);
});

test('a full 15x15 board with no line ends in a draw',()=>{
  const f=fixture();f.start('omok');const black=[],white=[];
  for(let y=0;y<15;y++)for(let x=0;x<15;x++)((Math.floor(x/2)+y)%2===0?black:white).push(cell(x,y));
  for(let i=0;i<black.length;i++){f.move(black[i]);if(i<white.length)f.move(white[i]);}
  assert.equal(f.view().game.phase,'finished');assert.equal(f.view().game.reason,'draw');assert.equal(f.view().game.winnerId,null);
});
