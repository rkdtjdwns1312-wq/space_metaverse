// 우주에너지 전용 장비. 별상점 아이템과 가격/사용 방식이 섞이지 않도록 별도 목록입니다.
// 수치는 보유가 아닌 장착 시에만 적용하며, 같은 장비를 여러 칸에 중복 장착하지 않습니다.
export const EQUIPMENT_ITEMS=Object.freeze([
  {id:'comet-compass',name:'혜성 나침반',description:'가벼운 별바람이 걸음을 이끌어요.',level:1,price:100,bonus:{speed:.10}},
  {id:'starlight-flask',name:'별빛 물병',description:'맑은 빛이 마음에 머물러요.',level:1,price:120,bonus:{mp:5}},
  {id:'crescent-charm',name:'초승달 부적',description:'작은 달빛이 몸을 감싸요.',level:1,price:120,bonus:{hp:5}},
  {id:'dawn-ribbon',name:'새벽의 리본',description:'새벽빛이 10초마다 체력을 1 회복시켜 줘요.',level:1,price:100,bonus:{hpRegen:1}},
  {id:'stardew-ring',name:'별이슬 반지',description:'별이슬이 지친 마음에 작은 쉼을 줘요.',level:1,price:100,bonus:{mpRegen:1}},
  {id:'asteroid-badge',name:'소행성 배지',description:'작은 행성의 온기가 곁을 지켜요.',level:1,price:100,bonus:{durationMs:1000}},
  {id:'azure-starblade',name:'푸른 별칼',description:'푸른 별의 힘이 날을 비춰요.',level:2,price:400,bonus:{attack:1}},
  {id:'silver-shield',name:'은빛 별방패',description:'반짝이는 방패가 충격을 덜어줘요.',level:2,price:400,bonus:{defense:1}},
  {id:'healing-crystal',name:'회복의 수정',description:'맑은 수정빛이 10초마다 체력과 마나를 1씩 채워줘요.',level:2,price:500,bonus:{hpRegen:1,mpRegen:1}},
  {id:'star-pattern-gloves',name:'별무늬 장갑',description:'별무늬가 스킬의 힘을 키워줘요.',level:2,price:500,bonus:{skillDamage:.20}},
  {id:'lake-brooch',name:'호수의 브로치',description:'고요한 물결이 체력을 10 높여줘요.',level:2,price:500,bonus:{hp:10}},
  {id:'breeze-anklet',name:'산들바람 발찌',description:'산들바람이 마나와 이동속도를 높여줘요.',level:2,price:800,bonus:{mp:10,speed:.10}},
  {id:'galaxy-pendant',name:'은하수 목걸이',description:'은하수의 빛이 최대 마나와 마나 회복을 높여줘요.',level:3,price:1000,bonus:{mp:10,mpRegen:2}},
  {id:'star-heart',name:'별하트',description:'따뜻한 별빛이 최대 체력과 체력 회복을 높여줘요.',level:3,price:1000,bonus:{hp:10,hpRegen:2}},
  {id:'meteor-boots',name:'유성 장화',description:'유성의 속도가 이동을 돕고 스킬 재사용을 줄여줘요.',level:3,price:1200,bonus:{speed:.20,cooldownReduction:.10}},
  {id:'galaxy-compass',name:'은하수 나침반',description:'은하수의 길이 공격력과 스킬 피해를 높여줘요.',level:3,price:1500,bonus:{attack:1,skillDamage:.20}},
  {id:'dream-guardian-cloak',name:'꿈의 파수꾼 망토',description:'꿈결 같은 빛이 방어력과 체력을 높여줘요.',level:3,price:1500,bonus:{defense:1,hp:10}},
  {id:'celestial-crown',name:'천공의 왕관',description:'은은한 별빛이 몸과 마음을 지켜요.',level:4,price:5000,bonus:{attack:1,hp:20}},
  {id:'aurora-scabbard',name:'오로라 검집',description:'오로라의 선명한 빛이 힘을 깨워요.',level:4,price:5000,bonus:{attack:2,mp:10}},
  {id:'starlight-guardian-stone',name:'별빛 수호석',description:'단단한 별빛이 하루를 지켜줘요.',level:4,price:5000,bonus:{defense:1,hp:20}},
  {id:'sun-ring',name:'따뜻한 반지',description:'따뜻한 태양빛이 힘을 깨워요.',level:4,price:null,craftOnly:true,bonus:{attack:3}},
  {id:'moon-earring',name:'달의 귀걸이',description:'차분한 달빛이 마나와 스킬의 흐름을 도와요.',level:4,price:null,craftOnly:true,bonus:{mp:10,cooldownReduction:.30}},
  {id:'burning-ice-necklace',name:'불타는 얼음 목걸이',description:'해와 달의 빛이 하나로 흐릅니다.',level:4,price:null,craftOnly:true,bonus:{attack:1,durationMs:2000,skillDamage:.30}},
  {id:'spirit-king-cloak',name:'성령왕의 망토',description:'성령의 왕이 남긴 푸른 기운이 몸을 감싸요.',level:5,price:null,craftOnly:true,bonus:{attack:5,defense:3,hp:30,mp:30}},
  {id:'primordial-star-gem',name:'시초의 별의 보석',description:'태초의 별빛이 생명과 마나를 채우고 주황빛 기운으로 몸을 감싸요.',level:5,price:null,craftOnly:true,bonus:{hpRegen:10,mpRegen:5,allCooldownReduction:.5}}
].map(item=>Object.freeze({...item,art:'/assets/equipment/'+item.id+'.png',icon:'✦',type:'equipment',mode:'equipment',currency:'cosmicEnergy',forSale:false,usable:false,targets:'self',secret:false,effect:{label:'장비 능력',icon:'✦',durationMs:0}})));

export const equipmentOf=id=>EQUIPMENT_ITEMS.find(item=>item.id===id)||null;
export function equipmentAuraOf(player){
  const slots=player?.equipmentSlots||[],blue=slots.includes('spirit-king-cloak'),orange=slots.includes('primordial-star-gem');
  return blue&&orange?'rainbow':blue?'blue':orange?'orange':null;
}
export function equipmentBonus(player){
  const total={attack:0,defense:0,hp:0,mp:0,speed:0,regen:0,hpRegen:0,mpRegen:0,durationMs:0,skillDamage:0,cooldownReduction:0,allCooldownReduction:0};
  for(const id of player?.equipmentSlots||[]){
    const item=equipmentOf(id);if(!item)continue;
    for(const key of Object.keys(total))total[key]+=item.bonus[key]||0;
  }
  return total;
}
export function validateEquipmentSlots(slots){
  if(slots===undefined)return [null,null,null]; // 오래된 교실 저장 파일
  if(!Array.isArray(slots)||slots.length!==3||slots.some(id=>id!==null&&!equipmentOf(id))||
    new Set(slots.filter(Boolean)).size!==slots.filter(Boolean).length)throw new Error('장착 장비 저장 데이터가 올바르지 않습니다.');
  return [...slots];
}
