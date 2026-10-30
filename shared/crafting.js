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

export const PRIMORDIAL_STAR_GEM_RECIPE = Object.freeze({
  ingredients: Object.freeze([{id:'radiant-star-origin',quantity:1}]),
  output: Object.freeze({id:'primordial-star-gem',quantity:1}),
  starShards:0,
  cosmicEnergy:10000
});

export const STAR_CRUMB_RECIPE = Object.freeze({
  ingredients: Object.freeze([{id:'star-crumb',quantity:5}]),
  output: Object.freeze({id:'star-shard',quantity:1}),
  currency: 'starShards',
});

export const PRIMORDIAL_STAR_SIGIL_RECIPE = Object.freeze({
  ingredients: Object.freeze([{id:'black-gem',quantity:1}]),
  output: Object.freeze({id:'primordial-star-sigil',quantity:1}),
  starShards:0,
  cosmicEnergy:10000
});

// 보스 재료 조합은 어느 서버에서도 누락되지 않도록 공통 규칙으로 둡니다.
export const BOSS_EQUIPMENT_RECIPES=Object.freeze([
  Object.freeze({ingredients:Object.freeze([{id:'leoon-claw',quantity:2}]),output:Object.freeze({id:'sun-ring',quantity:1})}),
  Object.freeze({ingredients:Object.freeze([{id:'noksera-horn',quantity:2}]),output:Object.freeze({id:'moon-earring',quantity:1})}),
  Object.freeze({ingredients:Object.freeze([{id:'leoon-claw',quantity:1},{id:'noksera-horn',quantity:1}]),output:Object.freeze({id:'burning-ice-necklace',quantity:1})})
]);

export const PUBLIC_CRAFTING_RECIPES = Object.freeze([
  ...BOSS_EQUIPMENT_RECIPES,
  SPIRIT_CLOAK_RECIPE,
  PRIMORDIAL_STAR_GEM_RECIPE,
  PRIMORDIAL_STAR_SIGIL_RECIPE,
  STAR_CRUMB_RECIPE
]);
