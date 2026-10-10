// 우주에너지 전용 장비. 별상점 아이템과 가격/사용 방식이 섞이지 않도록 별도 목록입니다.
// 수치는 보유가 아닌 장착 시에만 적용하며, 같은 장비를 여러 칸에 중복 장착하지 않습니다.
export const EQUIPMENT_ITEMS=Object.freeze([
  {id:'comet-compass',name:'혜성 나침반',description:'가벼운 별바람이 걸음을 이끌어요.',level:1,price:4,bonus:{speed:.04}},
  {id:'starlight-flask',name:'별빛 물병',description:'맑은 빛이 마음에 머물러요.',level:1,price:6,bonus:{mp:3}},
  {id:'crescent-charm',name:'초승달 부적',description:'작은 달빛이 몸을 감싸요.',level:1,price:6,bonus:{hp:3}},
  {id:'dawn-ribbon',name:'새벽의 리본',description:'새벽빛을 따라 가벼운 발걸음이 이어져요.',level:1,price:7,bonus:{speed:.02,mp:2}},
  {id:'stardew-ring',name:'별이슬 반지',description:'별이슬이 지친 마음에 작은 쉼을 줘요.',level:1,price:8,bonus:{regen:.01}},
  {id:'asteroid-badge',name:'소행성 배지',description:'작은 행성의 온기가 곁을 지켜요.',level:1,price:8,bonus:{hp:2,mp:2}},
  {id:'azure-starblade',name:'푸른 별칼',description:'푸른 별의 힘이 날을 비춰요.',level:2,price:10,bonus:{attack:1}},
  {id:'silver-shield',name:'은빛 별방패',description:'반짝이는 방패가 충격을 덜어줘요.',level:2,price:12,bonus:{defense:1}},
  {id:'healing-crystal',name:'회복의 수정',description:'천천히 빛나며 힘을 채워줘요.',level:2,price:16,bonus:{regen:.02}},
  {id:'star-pattern-gloves',name:'별무늬 장갑',description:'손끝에 맺힌 별무늬가 용기를 줘요.',level:2,price:18,bonus:{attack:1,mp:4}},
  {id:'lake-brooch',name:'호수의 브로치',description:'고요한 물결이 몸을 감싸요.',level:2,price:19,bonus:{defense:1,hp:4}},
  {id:'breeze-anklet',name:'산들바람 발찌',description:'은은한 바람이 발끝을 밀어줘요.',level:2,price:17,bonus:{speed:.06,hp:3}},
  {id:'galaxy-pendant',name:'은하수 목걸이',description:'깊은 우주의 기운을 담았어요.',level:3,price:20,bonus:{mp:6}},
  {id:'star-heart',name:'별하트',description:'따뜻한 별빛이 오래 머물러요.',level:3,price:22,bonus:{hp:6}},
  {id:'meteor-boots',name:'유성 장화',description:'발끝에 작은 유성이 따라와요.',level:3,price:28,bonus:{speed:.08}},
  {id:'galaxy-compass',name:'은하수 나침반',description:'은하수의 길이 조용히 열려요.',level:3,price:34,bonus:{speed:.10,mp:6}},
  {id:'dream-guardian-cloak',name:'꿈의 파수꾼 망토',description:'꿈결 같은 빛이 등을 지켜줘요.',level:3,price:38,bonus:{defense:1,hp:10,regen:.01}},
  {id:'celestial-crown',name:'천공의 왕관',description:'은은한 별빛이 몸과 마음을 지켜요.',level:4,price:40,bonus:{attack:1,defense:1,hp:4,mp:4}},
  {id:'aurora-scabbard',name:'오로라 검집',description:'오로라의 선명한 빛이 힘을 깨워요.',level:4,price:52,bonus:{attack:2,mp:10}},
  {id:'starlight-guardian-stone',name:'별빛 수호석',description:'단단한 별빛이 하루를 지켜줘요.',level:4,price:55,bonus:{defense:2,hp:16}},
  {id:'sun-ring',name:'태양의 반지',description:'따뜻한 태양빛이 힘을 깨워요.',level:4,price:null,craftOnly:true,bonus:{attack:2,hp:5}},
  {id:'moon-earring',name:'달의 귀걸이',description:'차분한 달빛이 충격을 감싸요.',level:4,price:null,craftOnly:true,bonus:{defense:2,mp:5}},
  {id:'burning-ice-necklace',name:'불타는 얼음 목걸이',description:'해와 달의 빛이 하나로 흐릅니다.',level:4,price:null,craftOnly:true,bonus:{attack:1,defense:1,hp:10,mp:10,regen:.01}},
  {id:'spirit-king-cloak',name:'성령왕의 망토',description:'성령의 왕이 남긴 빛이 어깨를 감싸요.',level:5,price:null,craftOnly:true,bonus:{attack:3,defense:2,hp:30,mp:20,speed:.08,regen:.02}}
].map(item=>Object.freeze({...item,art:'/assets/equipment/'+item.id+'.png',icon:'✦',type:'equipment',mode:'equipment',currency:'cosmicEnergy',forSale:false,usable:false,targets:'self',secret:false,effect:{label:'장비 능력',icon:'✦',durationMs:0}})));

export const equipmentOf=id=>EQUIPMENT_ITEMS.find(item=>item.id===id)||null;
export function equipmentBonus(player){
  const total={attack:0,defense:0,hp:0,mp:0,speed:0,regen:0};
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
