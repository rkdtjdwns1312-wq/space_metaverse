import test from 'node:test';
import assert from 'node:assert/strict';
import {VALLEY,VALLEY_ID} from '../shared/config.js';
import {selectTeacherEvolution} from '../server/evolution.js';
import {monstersOf,damageMonster} from '../server/monsters.js';
import {castHercules,advanceHerculesSlams} from '../server/hercules-skills.js';
import {avatarSizeOf} from '../shared/avatar-size.js';
import {tickDarkStarSkills} from '../server/dark-star-skills.js';
import {ensureVitals} from '../server/vitals.js';
import {tryStarRecordChallenge,tickStarRecordChallenge} from '../server/star-record-challenge.js';
import {tryTruthCreatorBlue,openTruthCreatorBlue,inputTruthCreatorBlue,truthCreatorBlueProtected} from '../server/truth-creator-blue.js';
import {tryConstellationLinks,linkConstellationStar} from '../server/forgotten-constellation-links.js';
import {beginSerenaSkill,tickSerenaSkills} from '../server/serena-skills.js';
const now=100000;
function fixture(type,role='teacher'){
 const star=VALLEY.objects.find(o=>o.id==='evolution-star');
 const p={id:'diagnostic',role:'teacher',connected:true,away:false,mapId:VALLEY_ID,x:star.x,y:star.y,avatar:{level:6},inventory:[],equipmentSlots:[],facing:{x:1,y:0}};
 const room={players:new Map([[p.id,p]]),planets:new Map()};
 for(const key of ['serena','darkStar','starRecord','forgottenConstellation','truthCreator'])room[key]={state:'active'};
 selectTeacherEvolution(room,p,{level:5,constellationId:'hercules'});
 assert.equal(p.avatar.teacherPreview,true);
 if(role==='student'){p.role='student';delete p.avatar.teacherPreview;}
 const boss=[...monstersOf(room,now).values()].find(b=>b.typeId===type);assert(boss,type);
 room.monsters=new Map([[boss.id,boss]]);p.mapId=boss.mapId;p.x=boss.x-250;p.y=boss.y;
 return {p,room,boss};
}

for(const type of ['leoon','noksera','spirit-king','serena','dark-star','star-record','forgotten-constellation','truth-creator']){
 for(const role of ['teacher','student'])for(const kind of ['basic','slam'])test(`${type}: ${role} Hercules ${kind} damages boss and registers retaliation`,()=>{
  const {room,p,boss}=fixture(type,role);const hp=boss.hp;
  if(kind==='basic'){
   boss.x=p.x+avatarSizeOf(p)*.75;boss.y=p.y;
   assert(castHercules(room,p,now,{basic:true}).targets.some(t=>t.monsterId===boss.id));
  }else{
   p.herculesNextStance='attack';const {hit}=castHercules(room,p,now);
   boss.x=hit.x+hit.dx*hit.reach;boss.y=hit.y+hit.dy*hit.reach;
   assert(advanceHerculesSlams(room,now+450)[0].targets.some(t=>t.monsterId===boss.id));
  }
  assert(boss.hp<hp);assert.equal(boss.targetId,p.id);
 });
}
for(const role of ['teacher','student'])test(`detached satellite damages ${role} on entry without opt-in`,()=>{
 const {room,p,boss}=fixture('dark-star','student');
 damageMonster(room,boss,p,2000,now);tickDarkStarSkills(room,boss,now,()=>.5);
 const satellite=boss.darkStarSkills.satellites[0];assert(satellite);boss.darkStarSkills.absorption=null;
 p.role=role;if(role==='teacher'){p.avatar.teacherPreview=true;boss.teacherRetaliation=new Set();}
 p.x=satellite.x;p.y=satellite.y;const hp=ensureVitals(p).hp;
 const hits=tickDarkStarSkills(room,boss,now+1,()=>.5).filter(h=>h.targetId===p.id);
 assert.equal(hits.length,1);assert(ensureVitals(p).hp<hp);
});
test('record challenge failure still defeats a preview teacher',()=>{
 const {room,p,boss}=fixture('star-record');
 assert(tryStarRecordChallenge(room,boss,now+4000,()=>0));
 assert(boss.recordChallenge.participants.has(p.id));
 const hits=tickStarRecordChallenge(room,boss,now+14000).hits;
 assert(hits.some(h=>h.targetId===p.id&&h.defeated));
});

test('teacher preview can open, solve blue puzzle and receives six-second protection without refreshing it',()=>{
 const {room,p,boss}=fixture('truth-creator');p.socketId='teacher-socket';
 assert(tryTruthCreatorBlue(room,boss,p,now,()=>.25));const orb=boss.truthCreatorBlue.orbs[0];
 p.x=orb.x;p.y=orb.y;
 let opened=openTruthCreatorBlue(room,p,orb.id,orb.landsAt);
 assert(truthCreatorBlueProtected(boss,p,orb.landsAt+5999));
 assert(!truthCreatorBlueProtected(boss,p,orb.landsAt+6000));
 opened=openTruthCreatorBlue(room,p,orb.id,orb.landsAt+1000);
 assert(!truthCreatorBlueProtected(boss,p,orb.landsAt+6000));
 for(let i=0;i<8;i++){
  const result=inputTruthCreatorBlue(room,p,{orbId:orb.id,interactionToken:opened.interactionToken,revision:orb.revision,action:orb.sequence[orb.progress]},orb.landsAt+1100+i);
  assert.equal(result.disarmed,i===7);
 }
 assert(!boss.truthCreatorBlue.orbs.includes(orb));
});

test('teacher preview can link all five stars and resolve the pattern',()=>{
 const {room,p,boss}=fixture('forgotten-constellation');
 assert(tryConstellationLinks(room,boss,now,()=>0));const cast=boss.links;
 for(const star of cast.stars){p.x=star.x;p.y=star.y;linkConstellationStar(room,p,{castId:cast.id,number:star.number},now+star.number);}
 assert.equal(boss.links,null);assert(ensureVitals(p).hp>0);
});

test('teacher preview counts as a nearby ally to resolve Serena red star',()=>{
 const {room,p,boss}=fixture('serena');
 const student={...p,id:'student',role:'student',avatar:{level:5,constellationId:'hercules'},battleVitals:undefined,x:p.x+800};
 room.players.set(student.id,student);assert(beginSerenaSkill(room,boss,'red',now,()=>0));
 boss.serenaSkills.marks=boss.serenaSkills.marks.filter(m=>m.playerId===student.id);
 assert.equal(boss.serenaSkills.marks.length,1);boss.serenaSkills.marks[0].requiredFriends=1;
 p.x=student.x;p.y=student.y;tickSerenaSkills(room,boss,now+1);
 assert.equal(boss.serenaSkills.marks.length,0);assert(ensureVitals(student).hp>0);
});
