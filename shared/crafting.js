// 화면에 공개해도 되는 설정만 둡니다. 비밀 조합법은 서버 전용 파일에서 읽습니다.
export const CRAFTING = Object.freeze({
  fee: 1,
  slots: 16,
  maxQuantity: 99
});

// 보스 보상으로 공개되는 확정 조합법. 일반 조합법 파일의 비밀 재료와 분리합니다.
export const SPIRIT_CLOAK_RECIPE = Object.freeze({
  ingredients: Object.freeze([{id:'spirit-king-soul',quantity:1}]),
  output: Object.freeze({id:'spirit-king-cloak',quantity:1}),
  starShards:10,
  cosmicEnergy:10000
});
