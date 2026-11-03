import {MONSTER_TYPES} from './monsters.js';
import {bossItemEvidence} from './boss-item-evidence.js';

export const TRUTH_CREATOR=Object.freeze({mapId:'sleeping-stars-4',typeId:'truth-creator',monsterId:'truth-creator-boss',statueId:'truth-creator-statue'});
export const TRUTH_CREATOR_REQUIRED_BOSSES=Object.freeze(MONSTER_TYPES.filter(type=>type.boss&&type.id!==TRUTH_CREATOR.typeId).map(type=>type.id));
export const TRUTH_CREATOR_ENTRY_MESSAGE='모든 보스 처치 기록이 있어야 입장 가능합니다.';
export const TRUTH_CREATOR_GATE_MESSAGE='별들이 잠드는 곳 3의 문을 통해서만 입장할 수 있어요.';
export const truthCreatorEligible=player=>{
  const evidence=bossItemEvidence(player);
  return player?.role==='teacher'||TRUTH_CREATOR_REQUIRED_BOSSES.every(id=>player?.serenaProgress?.bossKills?.includes(id)||evidence.includes(id));
};
export const dormantTruthCreator=()=>({state:'dormant',respawnAt:null,monsterId:null});
export function truthCreatorMap(map,state){
  return map.id===TRUTH_CREATOR.mapId&&state&&state.state!=='dormant'
    ?{...map,objects:map.objects.filter(object=>object.id!==TRUTH_CREATOR.statueId)}:map;
}
