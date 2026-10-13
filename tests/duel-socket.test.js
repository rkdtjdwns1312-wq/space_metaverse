import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import {io as connect} from 'socket.io-client';
import {createDuelArcade,registerDuelArcade} from '../server/duel-arcade.js';
import {duelMachine} from '../shared/duel-arcade.js';

test('real mini-server socket actions: private invites, race, room isolation, 3-3 and reconnect',async t=>{
  let now=1000;
  const http=createServer(),io=new Server(http),rooms=new Map();
  for(const code of ['one','two'])rooms.set(code,{code,players:new Map(['a','b','c','t'].map(id=>[id,{id,nickname:id,
    role:id==='t'?'teacher':'student',connected:false,mapId:'star-street',x:duelMachine('duel-memory').x,y:duelMachine('duel-memory').y}]))});
  const emissions=[],clients=[];
  const duel=createDuelArcade({getRoom:code=>rooms.get(code),clock:()=>now,random:n=>n-1,
    emitPrivate:(code,id,event,payload)=>{
      const p=rooms.get(code)?.players.get(id),s=io.sockets.sockets.get(p?.socketId);
      if(s?.data.session?.room.code===code&&s.data.session.player.id===id){emissions.push({code,id,event,payload:structuredClone(payload)});s.emit(event,payload);}
    }});
  io.on('connection',socket=>{
    // Harness identities only; production registration uses app-authenticated session.
    const room=rooms.get(socket.handshake.auth.code),player=room.players.get(socket.handshake.auth.id);
    player.socketId=socket.id;player.connected=true;socket.data.session={room,player};
    const action=(event,handler,save=true)=>{
      assert.equal(save,false,'duel actions must not enter disk transactions');
      socket.on(event,(data,ack)=>{try{ack({ok:true,...handler(data)});}catch(error){ack({ok:false,error:error.message});}});
    };
    registerDuelArcade({socket,action,duel});
    socket.on('disconnect',()=>{if(player.socketId===socket.id){player.connected=false;duel.onTick();}});
  });
  await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{for(const c of clients)c.disconnect();duel.dispose();await new Promise(resolve=>io.close(resolve));});
  const url='http://127.0.0.1:'+http.address().port;
  async function client(id,code='one'){
    const socket=connect(url,{auth:{id,code},transports:['websocket'],reconnection:false,forceNew:true});clients.push(socket);
    await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;
  }
  const [a,b,c,other,teacher]=await Promise.all([client('a'),client('b'),client('c'),client('a','two'),client('t')]);
  const ask=(socket,event,data={})=>socket.timeout(2000).emitWithAck('duel:'+event,data);
  const open=(socket,id='duel-memory')=>ask(socket,'open',{objectId:id});
  const latest=id=>emissions.findLast(e=>e.code==='one'&&e.id===id&&e.event==='duel:state').payload;
  const invitation=await ask(a,'invite',{objectId:'duel-memory',targetId:'b',sizeId:'4x5'});
  assert(invitation.ok);assert.equal(invitation.state.game.cards,undefined);
  assert.deepEqual(emissions.filter(e=>e.event==='duel:invite').map(e=>[e.code,e.id]),[['one','b']]);
  assert.equal((await ask(other,'respond',{inviteId:invitation.state.game.id,accept:true})).ok,false);
  assert.equal((await ask(a,'respond',{inviteId:invitation.state.game.id,accept:true})).ok,false);
  assert((await ask(b,'respond',{inviteId:invitation.state.game.id,accept:true})).ok);
  let g=latest('a').game;assert.equal(g.cards.length,20);assert(g.cards.every(card=>card.value===null));
  const data={sessionId:g.id,revision:g.revision,index:0};
  assert.equal((await ask(c,'move',data)).ok,false);assert.equal((await ask(other,'move',data)).ok,false);
  const race=await Promise.all([ask(b,'move',data),ask(b,'move',{...data,index:1})]);assert.equal(race.filter(r=>r.ok).length,1);
  assert.equal(latest('a').game.cards.filter(card=>card.value!==null).length,1);
  assert.equal((await open(teacher)).state.game.cards.filter(card=>card.value!==null).length,1);
  b.disconnect();await new Promise(resolve=>setTimeout(resolve,30));
  now+=29999;duel.onTick();assert.equal(latest('a').game.paused,true);
  const b2=await client('b');duel.onTick();g=(await open(b2)).state.game;assert.equal(g.paused,false);assert.equal(g.cards.filter(card=>card.value!==null).length,1);
  assert.equal((await ask(b2,'resign',{sessionId:g.id,revision:g.revision})).ok,true);
  for(const p of rooms.get('one').players.values()){p.x=duelMachine('duel-omok').x;p.y=duelMachine('duel-omok').y;}
  const invitation2=await ask(a,'invite',{objectId:'duel-omok',targetId:'b'});assert(invitation2.ok);
  assert((await ask(b2,'respond',{inviteId:invitation2.state.game.id,accept:true})).ok);
  async function move(socket,index){const game=latest('a').game;return ask(socket,'move',{sessionId:game.id,revision:game.revision,index});}
  for(const [i,index] of [111,113,97,127].entries()){assert((await move(b2,index)).ok);assert((await move(a,i*2)).ok);}
  const before=structuredClone(latest('a').game),denied=await move(b2,112);
  assert.equal(denied.ok,false);assert.equal(denied.error,'3·3 자리에는 놓을 수 없어요.');assert.deepEqual(latest('a').game,before);
  assert.equal(emissions.some(e=>e.code==='two'),false,'no unrelated-room emissions');
  rooms.get('one').players.get('b').mapId='space-plaza';duel.onTick();assert.equal(latest('a').game,null);
});
