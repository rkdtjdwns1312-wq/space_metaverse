import test from 'node:test';
import assert from 'node:assert/strict';
import {DARK_STAR} from '../shared/dark-star.js';
import {monstersOf} from '../server/monsters.js';
import {beginDarkStarSkill,tickDarkStarSkills,darkStarSkillViews} from '../server/dark-star-skills.js';
import {ensureVitals} from '../server/vitals.js';
const NOW=100000;
function fixture(){
 const p={id:'p',role:'student',accountKind:'master',connected:true,socketId:'first',mapId:DARK_STAR.mapId,avatar:{level:5,constellationId:'leo'},x:1000,y:1000};
 const room={players:new Map([[p.id,p]]),planets:new Map(),darkStar:{state:'active',monsterId:DARK_STAR.monsterId,respawnAt:null}};
 const boss=monstersOf(room,NOW).get(DARK_STAR.monsterId);room.monsters=new Map([[boss.id,boss]]);
 assert(beginDarkStarSkill(room,boss,'rainbow',NOW,()=>.5));const path=boss.darkStarSkills.paths[0];
 const enter=()=>{p.x=(path.x1+path.x2)/2;p.y=(path.y1+path.y2)/2;};
 const leave=()=>{p.x=path.x1+1000;p.y=path.y1+1000;};enter();
 return {p,room,boss,path,enter,leave,tick:offset=>tickDarkStarSkills(room,boss,NOW+offset).filter(h=>h.skillKind==='dark-star-rainbow')};
}
test('rainbow hits on entry, at exact 1s sustained contact and immediately on reentry',()=>{
 const f=fixture(),hp=ensureVitals(f.p).hp;
 const first=f.tick(1);assert.equal(first.length,1);assert(first[0].damage>0);
 assert.equal(f.tick(1000).length,0);assert.equal(f.tick(1001).length,1);
 f.leave();assert.equal(f.tick(1010).length,0);f.enter();assert.equal(f.tick(1020).length,1);
 assert.equal(f.tick(2019).length,0);assert.equal(f.tick(2020).length,1);
 assert.equal(ensureVitals(f.p).hp,hp-first[0].damage*4);
 assert.equal(f.tick(10000).length,1,'lag produces one hit, not accumulated catch-up hits');
 assert.equal(f.tick(10001).length,0);
 assert.equal(Object.hasOwn(darkStarSkillViews(f.room,f.boss,NOW+10001).paths[0],'contacts'),false);
 assert.equal(f.tick(30000).length,0);assert.equal(f.boss.darkStarSkills.paths.length,0);
});
test('rainbow contact resets on disconnect, map exit, death and away; boss death clears it',()=>{
 for(const mode of ['connected','map','death','away']){
  const f=fixture();assert.equal(f.tick(1).length,1);
  if(mode==='connected')f.p.connected=false;
  if(mode==='map')f.p.mapId='space-plaza';
  if(mode==='death')ensureVitals(f.p).hp=0;
  if(mode==='away')f.p.away=true;
  assert.equal(f.tick(50).length,0);assert.equal(f.path.contacts.size,0);
  Object.assign(f.p,{connected:true,mapId:DARK_STAR.mapId,away:false,socketId:'second'});ensureVitals(f.p).hp=500;
  assert.equal(f.tick(100).length,1,mode);
  f.boss.hp=0;assert.equal(f.tick(110).length,0);assert.equal(f.boss.darkStarSkills,null);
 }
});
