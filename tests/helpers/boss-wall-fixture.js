import {monstersOf} from '../../server/monsters.js';
import {mapOf} from '../../shared/config.js';
import {ensureVitals} from '../../server/vitals.js';
export const WALL_CASES={
  leoon:{player:{x:423.2,y:824.5669548647311},boss:{x:483.2,y:677.653336157074},push:32},
  'dark-star':{player:{x:434.72,y:1065.0089667456054},boss:{x:444.72,y:955.2613488213922},push:40}
};
export function bossWallFixture(type='dark-star',now=1000){
  const room={unattended:true,players:new Map(),planets:new Map(),darkStar:{state:'active',respawnAt:null,monsterId:'dark-star-boss'}};
  const boss=monstersOf(room,now,()=>0).get(type+'-boss'),place=WALL_CASES[type];
  room.monsters=new Map([[boss.id,boss]]);Object.assign(boss,place.boss,{spawnX:place.boss.x,spawnY:place.boss.y,nextManaRegenAt:Infinity});
  const player={id:'p',role:'student',connected:true,away:false,avatar:{level:5,constellationId:'taurus'},mapId:boss.mapId,
    ...place.player,input:{x:0,y:-1,at:now},equipmentSlots:[],inventory:[]};ensureVitals(player);room.players.set(player.id,player);
  const base=mapOf(boss.mapId),map={...base,objects:base.objects.filter(o=>o.kind==='gate')};
  return {room,boss,player,map,place};
}
