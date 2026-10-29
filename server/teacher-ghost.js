import {GameError} from './pin-auth.js';

// Visibility is independent of collision, targeting, and all combat permissions.
export const playerVisibleTo=(player,viewer)=>!!player&&!(player.role==='teacher'&&player.teacherGhost===true&&viewer?.role!=='teacher'&&viewer?.id!==player.id);
export const visiblePositions=(room,positions,viewer)=>positions.filter(([id])=>playerVisibleTo(room.players.get(id),viewer));
export function setTeacherGhost(player,enabled){
  if(player?.role!=='teacher')throw new GameError('선생님만 유령 모드를 바꿀 수 있어요.');
  if(typeof enabled!=='boolean')throw new GameError('유령 모드 설정을 확인해주세요.');
  player.teacherGhost=enabled;
  return {teacherGhost:enabled};
}
