import test from 'node:test';
import assert from 'node:assert/strict';
import {monstersOf,monsterViews} from '../server/monsters.js';
import {beginDarkStarSkill} from '../server/dark-star-skills.js';
import {advanceProjectiles} from '../server/projectiles.js';
import {attackSagittarius,combatEnemies,damageTargets} from '../server/sagittarius-skills.js';
import {castOphiuchus} from '../server/ophiuchus-skills.js';
import {castAquarius} from '../server/aquarius-skills.js';
import {castWater,resolveWaterHit} from '../server/water-skills.js';
import {castSwan} from '../server/swan-skills.js';
import {castCorvus} from '../server/corvus-skills.js';
import {ensureVitals} from '../server/vitals.js';
import {DARK_STAR} from '../shared/dark-star.js';
const attacks={sagittarius:(r,p,n)=>attackSagittarius(r,p,n),ophiuchus:castOphiuchus,aquarius:castAquarius,
  cancer:castWater,cetus:castWater,pisces:castWater,cygnus:castSwan,corvus:castCorvus};
for(const [constellation,attack] of Object.entries(attacks))test(`${constellation} ranged Q ignores interaction-only cards and preserves friendly basic protection`,()=>{
  const now=Date.now(),p={id:'p',role:'student',connected:true,mapId:DARK_STAR.mapId,x:1000,y:1000,
    avatar:{level:4,constellationId:constellation},inventory:[],facing:{x:1,y:0}};
  const friend={...p,id:'friend',avatar:{level:4,constellationId:'hercules'},x:1050};
  const room={players:new Map([[p.id,p],[friend.id,friend]]),planets:new Map(),darkStar:{state:'active',respawnAt:null,monsterId:DARK_STAR.monsterId}};
  const boss=monstersOf(room,now).get(DARK_STAR.monsterId);room.monsters=new Map([[boss.id,boss]]);
  assert(beginDarkStarSkill(room,boss,'puzzle',now,()=>.5));
  const card=boss.darkStarSkills.cards.find(c=>c.correct);Object.assign(card,{x:1150,y:1000});
  for(const other of boss.darkStarSkills.cards.filter(c=>c!==card))Object.assign(other,{x:2000,y:2000});
  assert.equal(card.hp,1);const hp=ensureVitals(friend).hp;
  let hits=[];
  for(let shot=0;shot<25&&card.hp>0;shot++){
    const at=now+shot*1000;attack(room,p,at,{basic:true});
    hits.push(...advanceProjectiles(room,at+900,combatEnemies,(r,p,list,power,n,cast)=>['cancer','cetus','pisces'].includes(constellation)?resolveWaterHit(r,p,list,power,n,cast):damageTargets(r,p,list,power,n)));
  }
  assert.equal(card.hp,1);assert.equal(ensureVitals(friend).hp,hp);
  assert.equal(boss.darkStarSkills.cards.length,5);assert.equal(boss.darkStarSkills.puzzleEndsAt,now+30000);
  assert(monsterViews(room,now+25000).some(m=>m.typeId==='dark-star-card'));
  const cardHits=hits.flatMap(h=>h.targets).filter(h=>h.monsterId===card.id);assert.equal(cardHits.length,0);
  for(const hit of cardHits)for(const key of ['hp','maxHp','correct','color'])assert.equal(Object.hasOwn(hit,key),false);
});
