import test from 'node:test';
import assert from 'node:assert/strict';
import {interactionDistance,interactionReach,mapOf} from '../shared/config.js';
import {avatarMonsterDistance,avatarPositionIsClear} from '../shared/avatar-boundary.js';
import {DARK_STAR} from '../shared/dark-star.js';
import {monstersOf} from '../server/monsters.js';
import {beginDarkStarSkill,revealDarkStarCard,darkStarSkillViews} from '../server/dark-star-skills.js';
const NOW=100000;
function fixture(){
  const p={id:'p',role:'student',connected:true,mapId:DARK_STAR.mapId,x:1500,y:1000,avatar:{level:4,constellationId:'leo'},inventory:[]};
  const room={players:new Map([[p.id,p]]),planets:new Map(),darkStar:{state:'active',respawnAt:null,monsterId:DARK_STAR.monsterId}};
  const boss=monstersOf(room,NOW).get(DARK_STAR.monsterId);room.monsters=new Map([[boss.id,boss]]);
  assert(beginDarkStarSkill(room,boss,'puzzle',NOW,()=>.5));return {room,p,boss,card:boss.darkStarSkills.cards[0]};
}
test('LV2–5 and transformed LV5 can approach cards from all four sides within shared interaction reach',()=>{
  const {room,p,boss,card}=fixture(),map=mapOf(boss.mapId);
  for(const [level,active] of [[2,false],[3,false],[4,false],[5,false],[5,true]]){
    p.avatar.level=level;p.transformation={active};
    for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
      const x=card.x+dx*65,y=card.y+dy*65;Object.assign(p,{x,y});
      assert.ok(avatarMonsterDistance(p,x,y,card)>=1,`LV${level} transformed=${active} side=${dx},${dy}`);
      assert.ok(avatarPositionIsClear(map,x,y,p,[...room.monsters.values()]));
      const clientCard={...darkStarSkillViews(room,boss,NOW).cards[0],kind:'dark-star-card'};
      assert.equal(interactionReach(clientCard),interactionReach(card));
      assert.ok(interactionDistance(p,clientCard)<=interactionReach(clientCard));
      assert.equal(revealDarkStarCard(room,p,card.id,NOW).revealUntil,NOW+3000);
    }
  }
});
test('reveal remains three seconds, puzzle remains thirty seconds and unrevealed color stays private',()=>{
  const {room,p,boss,card}=fixture();Object.assign(p,{x:card.x,y:card.y+65});
  assert.equal(card.endsAt,NOW+30000);assert.equal(darkStarSkillViews(room,boss,NOW).cards[0].color,undefined);
  revealDarkStarCard(room,p,card.id,NOW+1000);
  assert.equal(darkStarSkillViews(room,boss,NOW+3999).cards[0].color,card.color);
  assert.equal(darkStarSkillViews(room,boss,NOW+4000).cards[0].color,undefined);
  assert.equal(card.endsAt,NOW+30000);assert.throws(()=>revealDarkStarCard(room,p,card.id,NOW+30000));
});
test('out-of-reach, wrong-map, offline, away and defeated-boss reveal requests remain rejected',()=>{
  for(const change of [({p,card})=>p.x=card.x+1000,({p})=>p.mapId='star-street',({p})=>p.connected=false,
    ({p})=>p.away=true,({boss})=>boss.hp=0]){
    const f=fixture();Object.assign(f.p,{x:f.card.x,y:f.card.y+65});change(f);
    assert.throws(()=>revealDarkStarCard(f.room,f.p,f.card.id,NOW+1));assert.equal(f.card.revealUntil,0);
  }
});
test('confirmation is personal, expires in three seconds, and duplicate/rapid requests cannot remove a card',()=>{
  const {room,p,boss,card}=fixture();Object.assign(p,{x:card.x,y:card.y});
  const other={...p,id:'other',avatar:{...p.avatar}};room.players.set(other.id,other);
  const first=revealDarkStarCard(room,p,card.id,NOW),duplicate=revealDarkStarCard(room,p,card.id,NOW);
  assert.equal(card.hp,1);assert.notEqual(first.removeToken,duplicate.removeToken);
  assert.throws(()=>revealDarkStarCard(room,p,card.id,NOW+299,duplicate.removeToken));
  const stolen=revealDarkStarCard(room,other,card.id,NOW+300,duplicate.removeToken);
  assert.equal(stolen.canRemove,true);assert.equal(card.hp,1);
  const expired=revealDarkStarCard(room,p,card.id,NOW+3000,duplicate.removeToken);
  assert.equal(expired.canRemove,true);assert.equal(card.hp,1);assert.equal(boss.darkStarSkills.cards.length,5);
  assert.notEqual(expired.removeToken,duplicate.removeToken);
});
test('wrong choice respects live Libra immunity while still removing card, but ordinary teacher dies too',()=>{
  for(const immune of [true,false]){
    const {room,p,boss}=fixture(),card=boss.darkStarSkills.cards.find(c=>!c.correct);
    Object.assign(p,{x:card.x,y:card.y});
    if(immune){p.avatar.constellationId='libra';p.libraAura={endsAt:NOW+10000,mapId:p.mapId,size:0,radius:100};}
    else p.role='teacher';
    const first=revealDarkStarCard(room,p,card.id,NOW),second=revealDarkStarCard(room,p,card.id,NOW+300,first.removeToken);
    assert.equal(second.removed,true);assert.equal(second.correct,false);assert.equal(second.hit.defeated,!immune);
    assert.equal(boss.darkStarSkills.cards.length,4);assert.equal(room.monsters.has(card.id),false);
    assert.throws(()=>revealDarkStarCard(room,p,card.id,NOW+301,first.removeToken));
  }
});
test('new cards keep satellite radius plus card radius plus 32px clearance',()=>{
  const {room,p,boss}=fixture();
  const old=boss.darkStarSkills.cards.map(c=>({x:c.x,y:c.y}));
  for(const card of boss.darkStarSkills.cards)room.monsters.delete(card.id);
  boss.darkStarSkills.cards=[];boss.darkStarSkills.puzzleEndsAt=null;boss.darkStarSkills.ready.puzzle=0;
  boss.darkStarSkills.satellites=old.slice(0,4).map((point,i)=>({...point,id:'sat'+i,radius:96,contacts:new Map()}));
  assert(beginDarkStarSkill(room,boss,'puzzle',NOW+1,()=>.5));
  for(const c of boss.darkStarSkills.cards)for(const s of boss.darkStarSkills.satellites)
    assert.ok(Math.hypot(c.x-s.x,c.y-s.y)>96+22+32);
});
