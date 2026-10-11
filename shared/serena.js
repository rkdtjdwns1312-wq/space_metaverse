export const SERENA=Object.freeze({mapId:'star-origin-4',typeId:'serena',monsterId:'serena-boss',statueId:'star-goddess-statue',recoveryMs:24*60*60*1000});
export const dormantSerena=()=>({state:'dormant',respawnAt:null,monsterId:null});
// 클라이언트와 서버가 같은 동적 석상 목록을 사용합니다.
export function serenaMap(map,state){
  return map.id===SERENA.mapId&&state&&state.state!=='dormant'
    ?{...map,objects:map.objects.filter(o=>o.id!==SERENA.statueId)}:map;
}
