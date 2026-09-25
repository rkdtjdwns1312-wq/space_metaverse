// 서버에서는 요청 데이터가 아니라 인증된 세션의 player만 전달합니다.
// Infinity를 저장하면 JSON에서 null이 되므로 잔액은 기존 정수를 유지합니다.
export const hasUnlimitedShards = player => player?.role === 'teacher';
export const shardCost = (player, amount) => hasUnlimitedShards(player) ? 0 : amount;
export const CURRENCIES = Object.freeze({
  cosmicEnergy: Object.freeze({name:'우주에너지',initial:0}),
  starShards: Object.freeze({name:'별 파편',initial:0})
});
export const formatCurrency = (player, key) => hasUnlimitedShards(player)
  ? '∞ (무제한)' : (player?.[key] || 0).toLocaleString('ko-KR');
export const formatShards = player => formatCurrency(player, 'starShards');
