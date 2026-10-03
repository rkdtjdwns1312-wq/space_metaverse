import {RULES} from '../shared/config.js';
import {ensureVitals,damagePlayer} from './vitals.js';
import {monstersOf,damageMonster} from './monsters.js';
import {monsterType,MONSTER_LEVEL_STATS} from '../shared/monsters.js';

// 공격/향후 스킬에서 공유하는 서버 원형 판정. 클라이언트 대상 목록은 사용하지 않습니다.
export function playersInArea(room,{mapId,x,y,radius,sourceId=null,excludeTeachers=false}){
  return [...room.players.values()].filter(p=>p.id!==sourceId&&p.connected&&!p.away&&
    !(excludeTeachers&&p.role==='teacher')&&!p.avatar?.blackStar&&p.mapId===mapId&&ensureVitals(p)?.hp>0&&
    Math.hypot(p.x-x,p.y-y)<=radius+RULES.radius);
}
export function damagePlayersInArea(room,area,power,now){
  return playersInArea(room,area).map(p=>{
    const hit=damagePlayer(p,power,now);
    if(hit?.reflectedDamage)reflectLibraDamage(room,p,area,hit.reflectedDamage,now);
    return {targetId:p.id,...hit};
  });
}
export function reflectLibraDamage(room,libra,source,amount,now){
  if(source.sourceMonsterId){
    const monster=monstersOf(room,now).get(source.sourceMonsterId);
    if(monster?.hp>0&&monster.mapId===libra.mapId){
      const type=monsterType(monster.typeId),defense=type?.defense??MONSTER_LEVEL_STATS[type?.level]?.defense??0;
      const hit=damageMonster(room,monster,libra,amount+defense,now,{ignoreSleep:true});
      if(hit?.defeated)room.reflectedDrops=true;
    }
  }else if(source.sourceId){
    const attacker=room.players.get(source.sourceId);
    if(attacker?.connected&&attacker.mapId===libra.mapId&&attacker.id!==libra.id){
      const hit=damagePlayer(attacker,amount,now,{skipLibra:true});
      if(hit)(room.reflectedVitals??=[]).push({playerId:attacker.id,vitals:hit.vitals});
    }
  }
}
