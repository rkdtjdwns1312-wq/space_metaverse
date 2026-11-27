// Constellation preview changes the teacher's combat avatar, not their permissions.
// It participates in monster combat like a student; ordinary teachers opt in per monster.
export const canReceiveMonsterDamage=(player,teacherTargetIds)=>
  player?.role!=='teacher'||player.avatar?.teacherPreview===true||!!teacherTargetIds?.has(player.id);
