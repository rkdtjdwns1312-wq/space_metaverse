import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {bossItemEvidence,BOSS_ITEM_CREDITS} from '../shared/boss-item-evidence.js';
import {truthCreatorEligible} from '../shared/truth-creator.js';
import {PersistentRoomStore,fromRecord} from '../server/persistent-rooms.js';
import {captureBossItemHistory,commitBossItemHistory} from '../server/boss-item-history.js';

const expected={leoon:['leoon-claw','sun-ring'],noksera:['noksera-horn','moon-earring'],
 'spirit-king':['spirit-king-soul','spirit-king-cloak'],serena:['radiant-star-origin','primordial-star-gem'],
 'dark-star':['black-gem','primordial-star-sigil'],'star-record':['origin-star-record','truth-record'],
 'truth-creator':['truth-gem','truth-convergence']};
test('all seven boss materials and crafted equipment map precisely; fused gear proves both and recipes never qualify',()=>{
 for(const [boss,items] of Object.entries(expected))for(const id of items){
  assert.deepEqual(bossItemEvidence({inventory:[{id,quantity:1}]}),[boss]);
  if(id===items[1])assert.deepEqual(bossItemEvidence({equipmentSlots:[id]}),[boss]);
 }
 assert.equal(Object.keys(BOSS_ITEM_CREDITS).length,15);
 assert.deepEqual(bossItemEvidence({equipmentSlots:['burning-ice-necklace']}),['leoon','noksera']);
 assert.deepEqual(bossItemEvidence({constellationAbilityState:{coronaTrial:{savedEquipmentSlots:['burning-ice-necklace',null,null]}}}),['leoon','noksera']);
 assert.deepEqual(bossItemEvidence({inventory:[{id:'black-gem',quantity:0},{id:'leoon-claw',quantity:-1},{id:'truth-gem',quantity:Infinity},{id:'recipe-truth-record',quantity:1},{id:'gold-big-bang-card',quantity:1}],learnedRecipeIds:Object.values(expected).flat()}),[]);
 const player={role:'student',inventory:Object.values(expected).map(items=>({id:items[0],quantity:1}))};
 assert(truthCreatorEligible(player));assert.equal(player.serenaProgress,undefined,'pure eligibility does not mutate');
 assert(!truthCreatorEligible({role:'student',learnedRecipeIds:Object.values(expected).flat()}));
});

function fixture(t){
 const dir=mkdtempSync(join(tmpdir(),'boss-history-'));let store=new PersistentRoomStore(dir);
 t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
 const make=()=>{const {room}=store.transact(()=>store.create({title:'검사',allowedNames:['1','2']},'teacher'));
  const {player}=store.transact(()=>store.join({code:room.code,nickname:'1',pin:'1234'},'one'));
  const {player:other}=store.transact(()=>store.join({code:room.code,nickname:'2',pin:'1234'},'two'));
  return {code:room.code,id:player.id,otherId:other.id};};
 return {dir,make,get store(){return store;},read:code=>JSON.parse(readFileSync(join(dir,code+'.json'),'utf8')),
  restart(){store.close();store=new PersistentRoomStore(dir);}};
}
test('offline migration uses current ownership and completed trades by immutable id, not failed offers, recipes or matching nicknames',t=>{
 const f=fixture(t),a=f.make(),r=f.read(a.code),p=r.students.find(p=>p.id===a.id),q=r.students.find(p=>p.id===a.otherId);
 p.inventory=[{id:'black-gem',quantity:1}];p.avatar.level=5;p.equipmentSlots=['spirit-king-cloak',null,null];
 p.learnedRecipeIds=['truth-record'];q.learnedRecipeIds=['primordial-star-gem'];
 r.tradeLog=[{fromId:p.id,toId:q.id,result:'completed',give:{items:[{id:'leoon-claw',quantity:1}]},want:{items:[{id:'noksera-horn',quantity:1}]}},
  {fromId:p.id,toId:q.id,result:'failed',give:{items:[{id:'radiant-star-origin',quantity:1}]}},
  {fromId:'deleted',toId:'unknown',fromNickname:p.nickname,result:'completed',give:{items:[{id:'origin-star-record',quantity:1}]}}];
 const room=fromRecord(r),first=room.players.get(p.id),second=room.players.get(q.id);
 assert.deepEqual(new Set(first.serenaProgress.bossKills),new Set(['dark-star','spirit-king','leoon','noksera']));
 assert.deepEqual(new Set(second.serenaProgress.bossKills),new Set(['leoon','noksera']));
 assert(!first.connected&&!second.connected);assert(!truthCreatorEligible(first));
 assert.deepEqual(p.serenaProgress.bossKills,[],'source record is not mutated');
});

test('two legacy classrooms normalize independently; first save never dirties the other and failed acquisition restores both item and credit',t=>{
 const f=fixture(t),a=f.make(),b=f.make();f.store.close();
 for(const target of [a,b]){const r=f.read(target.code);r.students.find(p=>p.id===target.id).inventory=[{id:'black-gem',quantity:1}];writeFileSync(join(f.dir,target.code+'.json'),JSON.stringify(r));}
 f.restart();const untouched=readFileSync(join(f.dir,b.code+'.json'),'utf8');
 f.store.transact(()=>f.store.open({code:a.code},'new-teacher-a'));
 assert.equal(readFileSync(join(f.dir,b.code+'.json'),'utf8'),untouched);
 f.store.transact(()=>f.store.open({code:b.code},'new-teacher-b'));
 const get=()=>f.store.rooms.get(a.code).players.get(a.id),other=()=>f.store.rooms.get(b.code).players.get(b.id);
 assert(get().serenaProgress.bossKills.includes('dark-star'));assert(other().serenaProgress.bossKills.includes('dark-star'));
 const save=f.store.files.save.bind(f.store.files);f.store.files.save=()=>{throw Error('history write failure');};
 assert.throws(()=>f.store.transact(()=>get().inventory.push({id:'origin-star-record',quantity:1})),/history write failure/);
 assert(!get().inventory.some(i=>i.id==='origin-star-record'));assert(!get().serenaProgress.bossKills.includes('star-record'));
 f.store.files.save=save;f.store.transact(()=>get().inventory.push({id:'origin-star-record',quantity:1}));
 f.store.transact(()=>{get().inventory=[];});assert.deepEqual(new Set(get().serenaProgress.bossKills),new Set(['dark-star','star-record']));
 f.restart();const p=f.store.records.get(a.code).students.find(p=>p.id===a.id);
 assert.deepEqual(p.inventory,[]);assert.deepEqual(new Set(p.serenaProgress.bossKills),new Set(['dark-star','star-record']));
});

test('common history hook retains consumed proof for temporary classrooms and never credits deleted or untouched accounts',()=>{
 const p={id:'one',role:'student',avatar:{level:5},inventory:[{id:'black-gem',quantity:1}],equipmentSlots:[]};
 const q={id:'two',role:'student',avatar:{level:5},inventory:[{id:'origin-star-record',quantity:1}]};
 const rooms=new Map([['a',{players:new Map([[p.id,p]])}],['b',{players:new Map([[q.id,q]])}]]),before=captureBossItemHistory(rooms);
 p.inventory=[];commitBossItemHistory(rooms,before);assert.deepEqual(p.serenaProgress.bossKills,['dark-star']);assert.equal(q.serenaProgress,undefined);
});
