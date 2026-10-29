export const DARK_STAR=Object.freeze({mapId:'sleeping-stars-1',typeId:'dark-star',monsterId:'dark-star-boss',statueId:'dark-star-statue'});
export const dormantDarkStar=()=>({state:'dormant',respawnAt:null,monsterId:null});
export function darkStarMap(map,state){
  return map.id===DARK_STAR.mapId&&state&&state.state!=='dormant'
    ?{...map,objects:map.objects.filter(o=>o.id!==DARK_STAR.statueId)}:map;
}
