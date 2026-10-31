export const STAR_RECORD=Object.freeze({mapId:'sleeping-stars-2',typeId:'star-record',monsterId:'star-record-boss',statueId:'star-record-statue'});
export const dormantStarRecord=()=>({state:'dormant',respawnAt:null,monsterId:null});
export function starRecordMap(map,state){
  return map.id===STAR_RECORD.mapId&&state?.state!=='dormant'
    ?{...map,objects:map.objects.filter(object=>object.id!==STAR_RECORD.statueId)}:map;
}
