import {STATIC_MAPS} from '../shared/config.js';
import {ensure} from './rooms.js';
// 목적지의 입장 권한을 서버 상태로 판정합니다. 친구 호출 수락 시에도 다시 검사합니다.
// 선생님은 수업 관리와 학생 지원을 위해 모든 맵을 방문할 수 있습니다.
export function requireMapLevel(player,mapId){
  const map=STATIC_MAPS[mapId],minimum=map?.minLevel||1;
  ensure(player.role==='teacher'||player.avatar.level>=minimum,
    (map?.name||'이 맵')+'은 LV'+minimum+'부터 입장할 수 있어요. 현재 LV'+player.avatar.level+'이에요.');
}
