import test from 'node:test';
import assert from 'node:assert/strict';
import {FORGOTTEN_CONSTELLATION as spec} from '../shared/forgotten-constellation.js';
import {tickHomingStar,homingStarView,HOMING_STAR} from '../server/forgotten-homing-star.js';
import {monstersOf,monsterViews,damageMonster,moveMonsters} from '../server/monsters.js';
import {chargeHuntingStation} from '../server/hunting-time.js';
import {ensureVitals} from '../server/vitals.js';
import {readingFixture} from './helpers/reading-fixture.js';

const start=100000;
const actor=(id,role='student')=>({id,role,connected:true,mapId:spec.mapId,avatar:{level:4},x:900,y:0});
function fixture(){
 const p=actor('target'),boss={id:spec.monsterId,typeId:spec.typeId,mapId:spec.mapId,x:0,y:0,radius:150,hp:20000,facingX:1},room={players:new Map([[p.id,p]])};
 const tick=t=>tickHomingStar(room,boss,p,start+t);tick(0);return {p,boss,room,tick};
}
test('one shot every 5s, straight legs and three server turn boundaries with no fourth retarget',()=>{
 const {tick,p,boss}=fixture();tick(4999);assert.equal(homingStarView(boss),null);tick(5000);const shot=boss.homing.shots[0];assert.equal(shot.dx,1);
 p.x=0;p.y=900;tick(5749);assert.equal(shot.turns,0);assert.equal(shot.y,0);tick(5750);assert.equal(shot.x,162);assert.equal(shot.turns,1);assert(shot.dx<0&&shot.dy>0);
 const dir=[shot.dx,shot.dy];p.x=-900;p.y=0;tick(6499);assert.deepEqual([shot.dx,shot.dy],dir);tick(6500);assert.equal(shot.turns,2);assert(shot.dx<0&&shot.dy<0);
 p.x=1000;p.y=500;tick(7250);assert.equal(shot.turns,3);const last=[shot.dx,shot.dy];p.y=-900;tick(7999);assert.deepEqual([shot.dx,shot.dy],last);tick(8000);
 assert.equal(shot.turns,3);assert.equal(shot.lastAt,start+8000);assert.equal(boss.homing.shots.length,0);tick(10000);assert.equal(boss.homing.shots[0].startsAt,start+10000);assert.equal(boss.homing.shots[0].turns,0);
});
test('swept hit stops at first eligible body, respects teacher combat and cannot hit twice',()=>{
 const {tick,p,boss,room}=fixture();const preview=actor('preview','teacher'),teacher=actor('teacher','teacher'),ghost=actor('ghost'),other=actor('other'),near=actor('near'),far=actor('far');
 preview.avatar.teacherPreview=true;ghost.avatar.blackStar=true;other.mapId='space-plaza';
 for(const [i,a] of [preview,teacher,ghost,other,far,near].entries()){a.x=i<4?60+i*10:a.id==='near'?120:180;room.players.set(a.id,a);}
 tick(5000);const hp=ensureVitals(near).hp;const hits=tick(5700);assert.equal(hits.length,1);assert.equal(hits[0].targetId,near.id);assert(hits[0].damage>0);assert.equal(ensureVitals(near).hp,hp-hits[0].damage);assert.equal(boss.homing.shots.length,0);
 assert.deepEqual(tick(5800),[]);tick(10000);boss.teacherRetaliation=new Set([teacher.id]);assert.equal(tick(10700)[0].targetId,teacher.id);
 tick(15000);p.mapId='space-plaza';assert.deepEqual(tick(15200),[]);assert.equal(homingStarView(boss),null);
 p.mapId=spec.mapId;tick(15300);tick(18300);boss.hp=0;tick(18500);assert.equal(boss.homing,null);
});
test('delayed tick sweeps each leg, skips empty chord between legs and expires on leaving boss map',()=>{
 const {tick,boss,p,room}=fixture();tick(5000);p.x=270;p.y=900;const across=actor('across');across.x=140;across.y=140;room.players.set(across.id,across);
 const hp=ensureVitals(across).hp;tick(6500);assert.equal(ensureVitals(across).hp,hp);assert.equal(boss.homing.shots[0].turns,2);assert(boss.homing.shots[0].x>160&&boss.homing.shots[0].x<200);assert(boss.homing.shots[0].y>160&&boss.homing.shots[0].y<200);
 boss.mapId='space-plaza';tick(7000);assert.equal(boss.homing,null);
});
test('real socket broadcast delivers moving star during a shared puzzle, then removes it after one hit',async t=>{
 const f=await readingFixture(t),room=f.room,p=f.p;
 room.forgottenConstellation={state:'active',monsterId:spec.monsterId,respawnAt:null};
 const boss=monstersOf(room,f.now).get(spec.monsterId);chargeHuntingStation(p,'math',f.now);Object.assign(p,{mapId:spec.mapId,x:boss.x+450,y:boss.y});
 damageMonster(room,boss,p,1,f.now);moveMonsters(room,f.now,()=>0);assert(boss.links);assert.equal(boss.homing.shots.length,0);
 const waitForPacket=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{f.student.off('world:positions',listen);reject(Error('missing projectile in map packet'));},3500);function listen(data){const m=data.monsters?.find(m=>m.id===boss.id&&m.homingStar);if(!m)return;clearTimeout(timer);f.student.off('world:positions',listen);resolve(m);}f.student.on('world:positions',listen);});
 const received=waitForPacket();f.advance(HOMING_STAR.fireMs);moveMonsters(room,f.now,()=>0);const view=await received;assert(view.constellationLinks);assert.equal(view.homingStar.turns,0);assert.equal(view.homingStar.endsAt-view.homingStar.startsAt,3000);
 f.advance(2600);const hits=moveMonsters(room,f.now,()=>0);assert(hits.some(h=>h.targetId===p.id&&h.skillKind==='forgotten-homing-star'));assert.equal(boss.homing.shots.length,0);
 assert(!monsterViews(room,f.now).find(m=>m.id===boss.id).homingStar);assert(!boss.pendingAttack);
});
