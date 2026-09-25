// 서버에서는 요청 데이터가 아니라 인증된 세션의 player만 전달합니다.
// Infinity를 저장하면 JSON에서 null이 되므로 잔액은 기존 정수를 유지합니다.
export const hasUnlimitedShards = player => player?.role === 'teacher';
export const shardCost = (player, amount) => hasUnlimitedShards(player) ? 0 : amount;
export const formatShards = player => hasUnlimitedShards(player)
  ? '∞ (무제한)' : (player?.starShards || 0).toLocaleString('ko-KR');
