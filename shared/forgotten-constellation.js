export const FORGOTTEN_CONSTELLATION=Object.freeze({
 mapId:'sleeping-stars-3',typeId:'forgotten-constellation',monsterId:'forgotten-constellation-boss',statueId:'forgotten-constellation-statue',
 name:'별자리의 기원',statueName:'별자리의 기원 석상'
});
export const dormantForgottenConstellation=()=>({state:'dormant',respawnAt:null,monsterId:null});
export function forgottenConstellationMap(map,state){
 if(map.id!==FORGOTTEN_CONSTELLATION.mapId||!state||state.state==='dormant')return map;
 return {...map,objects:map.objects.filter(object=>object.id!==FORGOTTEN_CONSTELLATION.statueId)};
}
