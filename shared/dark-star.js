export const DARK_STAR=Object.freeze({mapId:'sleeping-stars-1',typeId:'dark-star',monsterId:'dark-star-boss',statueId:'dark-star-statue'});
export const DARK_STAR_SATELLITES=Object.freeze({
  red:{name:'빨강',ink:'#ff585b'},purple:{name:'보라',ink:'#bc72ff'},indigo:{name:'남색',ink:'#535cbb'},
  green:{name:'초록',ink:'#4bc983'},blue:{name:'파랑',ink:'#459cf4'}
});
export const dormantDarkStar=()=>({state:'dormant',respawnAt:null,monsterId:null});
export function darkStarMap(map,state){
  return map.id===DARK_STAR.mapId&&state&&state.state!=='dormant'
    ?{...map,objects:map.objects.filter(o=>o.id!==DARK_STAR.statueId)}:map;
}
