// 우주에너지 전용 장비. 별상점 아이템과 가격/사용 방식이 섞이지 않도록 별도 목록입니다.
// 수치는 보유가 아닌 장착 시에만 적용하며, 같은 장비를 여러 칸에 중복 장착하지 않습니다.
export const EQUIPMENT_ITEMS=Object.freeze([
  {id:'comet-compass',name:'혜성 나침반',description:'혜성의 빛이 공격을 도와줘요.',level:1,price:100,bonus:{attack:1}},
  {id:'starlight-flask',name:'별빛 물병',description:'맑은 빛이 마음에 머물러요.',level:1,price:120,bonus:{mp:5}},
  {id:'crescent-charm',name:'초승달 부적',description:'작은 달빛이 몸을 감싸요.',level:1,price:120,bonus:{hp:5}},
  {id:'dawn-ribbon',name:'새벽의 리본',description:'새벽빛이 10초마다 체력을 1 회복시켜 줘요.',level:1,price:100,bonus:{hpRegen:1}},
  {id:'stardew-ring',name:'별이슬 반지',description:'별이슬이 지친 마음에 작은 쉼을 줘요.',level:1,price:100,bonus:{mpRegen:1}},
  {id:'asteroid-badge',name:'소행성 배지',description:'작은 행성의 온기가 곁을 지켜요.',level:1,price:100,bonus:{durationMs:1000}},
  {id:'azure-starblade',name:'푸른 별칼',description:'공격은 강해지고 방어는 조금 약해져요.',level:2,price:400,bonus:{attack:2,defense:-1}},
  {id:'silver-shield',name:'은빛 별방패',description:'반짝이는 방패가 충격을 덜어줘요.',level:2,price:400,bonus:{defense:2}},
  {id:'healing-crystal',name:'회복의 수정',description:'맑은 수정빛이 체력과 마나를 채워줘요.',level:2,price:500,bonus:{hpRegen:1,mpRegen:1},effectText:'10초마다 체력·마나 회복 +1'},
  {id:'star-pattern-gloves',name:'별무늬 장갑',description:'별무늬가 스킬의 힘을 키워줘요.',level:2,price:500,bonus:{skillDamage:.20}},
  {id:'lake-brooch',name:'호수의 브로치',description:'고요한 물결이 체력을 늘리고 회복시켜 줘요.',level:2,price:500,bonus:{hp:10,hpRegen:1}},
  {id:'breeze-anklet',name:'산들바람 발찌',description:'산들바람이 마나와 이동속도를 높여줘요.',level:2,price:800,bonus:{mp:10,speed:.10}},
  {id:'galaxy-pendant',name:'은하수 목걸이',description:'은하수의 빛이 최대 마나와 마나 회복을 높여줘요.',level:3,price:1000,bonus:{mp:20,mpRegen:1}},
  {id:'star-heart',name:'별하트',description:'따뜻한 별빛이 최대 체력과 체력 회복을 높여줘요.',level:3,price:1000,bonus:{hp:10,hpRegen:2}},
  {id:'meteor-boots',name:'유성 장화',description:'유성의 속도가 이동을 돕고 스킬 재사용 시간을 줄여줘요.',level:3,price:1200,bonus:{speed:.20,cooldownReduction:.10}},
  {id:'galaxy-compass',name:'은하수 나침반',description:'은하수의 길이 공격력과 스킬 피해를 높여줘요.',level:3,price:1500,bonus:{attack:1,skillDamage:.20}},
  {id:'dream-guardian-cloak',name:'꿈의 파수꾼 망토',description:'꿈결 같은 수호가 위험한 타격을 막아줘요.',level:3,price:1500,bonus:{},effectText:'30초마다 즉사 외 피해 1회 막기 · 수호 상태'},
  {id:'celestial-crown',name:'천공의 왕관',description:'은은한 별빛이 몸과 마음을 지켜요.',level:4,price:5000,bonus:{attack:1,hp:20}},
  {id:'aurora-scabbard',name:'오로라 검집',description:'오로라의 선명한 빛이 힘을 깨워요.',level:4,price:5000,bonus:{attack:2,mp:10}},
  {id:'starlight-guardian-stone',name:'별빛 수호석',description:'단단한 별빛이 몸을 지키고 체력을 회복시켜 줘요.',level:4,price:5000,bonus:{defense:1,hp:20,hpRegen:1}},
  {id:'sun-ring',name:'따뜻한 해의 반지',description:'따뜻한 태양빛이 힘을 깨워요.',level:4,price:null,craftOnly:true,bonus:{attack:3}},
  {id:'moon-earring',name:'차가운 달의 귀걸이',description:'차분한 달빛이 마나와 스킬의 흐름을 도와요.',level:4,price:null,craftOnly:true,bonus:{mp:10,cooldownReduction:.30}},
  {id:'burning-ice-necklace',name:'불타는 얼음 목걸이',description:'해와 달의 빛이 하나로 흐릅니다.',level:4,price:null,craftOnly:true,bonus:{attack:2,skillDamage:.20}},
  {id:'spirit-king-cloak',name:'성령왕의 망토',description:'성령의 왕이 남긴 푸른 기운이 몸을 감싸요.',level:5,price:null,craftOnly:true,bonus:{attack:3,defense:2,hp:20,mp:20}},
  {id:'primordial-star-gem',name:'시초의 별의 보석',description:'태초의 별빛이 회복과 스킬 피해를 높이지만 스킬 마나도 두 배로 소모해요.',level:5,price:null,craftOnly:true,bonus:{hpRegen:5,mpRegen:3,manaCostIncrease:1,skillDamage:.5}},
  {id:'infinite-star-bracelet',name:'무한의 별기운의 팔찌',description:'무한한 별의 파편 1개와 우주에너지 20,000개로 만드는 팔찌입니다.',art:'/assets/equipment/infinite-star-bracelet.webp',level:5,price:null,craftOnly:true,bonus:{attack:5},infiniteMaxStacks:3,infiniteDurationMs:5000,effectText:'공격력 +5 · 몬스터 명중 시 무한의기운 1중첩(공격력 +1). 최대 3중첩이며 명중할 때마다 지속시간이 5초로 갱신됩니다.'},
  {id:'truth-record',name:'진리의 기록',description:'장착하면 다음 피해를 즉사까지 한 번 막는 보호막이 준비돼요. 막은 뒤 180초 후 다시 준비되며, 여러 개 쌓이지 않아요.',level:5,price:null,craftOnly:true,bonus:{attack:3},cooldownResetChance:.4,effectText:'공격력 +3 · 스킬 사용 시 40% 확률로 재사용 대기시간 초기화 · 180초마다 모든 피해 1회 완전 차단'},
  {id:'truth-convergence',name:'진리의 결집체',description:'진리를 담은 보석의 별빛이 모인 목걸이입니다. 진리를 담은 보석 1개와 우주에너지 30,000개로 조합할 수 있어요.',level:5,price:null,craftOnly:true,bonus:{hp:10,mp:10,cooldownReduction:.5,skillDamage:.5}},
  {id:'primordial-star-sigil',name:'검은별의 인장',description:'검은 보석에 깃든 고요한 별빛이 몸을 지키고 5초마다 검은별을 발사해요.',art:'/assets/equipment/primordial-star-sigil.webp',level:5,price:null,craftOnly:true,bonus:{defense:2,hp:40},sigilDamageFactor:2.5,effectText:'방어력 +2 · 최대 체력 +40 · 5초마다 공격력 250% 검은별 발사'}
].map(item=>Object.freeze({...item,art:item.art||'/assets/equipment/'+item.id+'.png',icon:'✦',type:'equipment',mode:'equipment',currency:'cosmicEnergy',forSale:false,usable:false,targets:'self',secret:false,effect:{label:'장비 능력',icon:'✦',durationMs:0}})));

export const ENHANCEMENT_MATERIALS=Object.freeze({
  'sun-ring':Object.freeze(['leoon-claw']),
  'moon-earring':Object.freeze(['noksera-horn']),
  'burning-ice-necklace':Object.freeze(['leoon-claw','noksera-horn']),
  'spirit-king-cloak':Object.freeze(['spirit-king-soul']),
  'primordial-star-gem':Object.freeze(['radiant-star-origin']),
  'infinite-star-bracelet':Object.freeze(['infinite-star-fragment']),
  'truth-record':Object.freeze(['origin-star-record']),
  'truth-convergence':Object.freeze(['truth-gem']),
  'primordial-star-sigil':Object.freeze(['black-gem'])
});
const enhancedItems=new Map();
export function equipmentOf(id){
  const base=EQUIPMENT_ITEMS.find(item=>item.id===id);if(base)return base;
  if(typeof id!=='string')return null;
  if(enhancedItems.has(id))return enhancedItems.get(id);
  const match=/^(sun-ring|moon-earring|burning-ice-necklace|spirit-king-cloak|primordial-star-gem|infinite-star-bracelet|truth-record|truth-convergence|primordial-star-sigil)\+([1-9])$/.exec(id);if(!match)return null;
  const original=equipmentOf(match[1]),stage=Number(match[2]),bonus={...original.bonus},third=Math.floor(stage/3);
  if(original.id==='sun-ring'){const late=Math.max(0,stage-6);bonus.hp=stage;bonus.attack+=third;bonus.skillDamage=late*(late+1)/2*5/100;}
  if(original.id==='moon-earring'){bonus.mp+=stage;bonus.mpRegen=third;bonus.attack=Math.max(0,stage-6);}
  if(original.id==='burning-ice-necklace'){const extra=stage>=4?stage*(stage+1)/2-6:0;bonus.hp=Math.ceil(stage/2);bonus.mp=Math.floor(stage/2);bonus.skillDamage=(20+third*5+extra)/100;}
  if(original.id==='spirit-king-cloak'){
    const vitality=Math.min(stage,3)+Math.max(0,Math.min(stage-3,3))*2+Math.max(0,stage-6)*3;
    bonus.hp+=vitality;bonus.mp+=vitality;
    bonus.attack+=(stage>=7?1:0)+(stage>=8?1:0)+(stage>=9?2:0);
    bonus.defense+=(stage>=8?1:0)+(stage>=9?1:0);
  }
  if(original.id==='primordial-star-gem'){bonus.mpRegen+=third;bonus.skillDamage=(50+Math.ceil(stage/2)*5)/100;bonus.manaCostIncrease=(100-Math.floor(stage/2)*10)/100;}
  if(original.id==='truth-convergence'){bonus.hp+=stage;bonus.mp+=stage;bonus.skillDamage=(50+third*(third+1)/2*10)/100;}
  const extra={};
  if(original.id==='primordial-star-sigil'){bonus.defense+=third;extra.sigilDamageFactor=(250+Math.min(stage,3)*50+Math.max(0,Math.min(stage-3,3))*100+Math.max(0,stage-6)*150)/100;extra.effectText=`방어력 +${bonus.defense} · 최대 체력 +40 · 5초마다 공격력 ${Math.round(extra.sigilDamageFactor*100)}% 검은별 발사`;}
  if(original.id==='infinite-star-bracelet'){extra.infiniteMaxStacks=3+Math.ceil(stage/2);extra.infiniteDurationMs=5000+Math.floor(stage/2)*1000;extra.effectText=`공격력 +5 · 몬스터 명중 시 무한의기운 1중첩(공격력 +1). 최대 ${extra.infiniteMaxStacks}중첩이며 명중할 때마다 지속시간이 ${extra.infiniteDurationMs/1000}초로 갱신됩니다.`;}
  if(original.id==='truth-record'){const n=Math.max(0,stage-6);bonus.attack+=n*(n+1)/2;extra.cooldownResetChance=(40+Math.min(stage,6)*5)/100;extra.effectText=`공격력 +${bonus.attack} · 스킬 사용 시 ${Math.round(extra.cooldownResetChance*100)}% 확률로 재사용 대기시간 초기화 · 180초마다 모든 피해 1회 완전 차단`;}
  const description=original.id==='primordial-star-gem'?'태초의 별빛이 회복과 스킬 피해를 높여요. 강화할수록 늘어나는 스킬 마나 소모량이 줄어들어요.':original.description;
  const item=Object.freeze({...original,...extra,id,baseId:original.id,enhancementStage:stage,name:original.name+' +'+stage,description,bonus:Object.freeze(bonus)});
  enhancedItems.set(id,item);return item;
}
export const equipmentBaseId=id=>equipmentOf(id)?.baseId||id;
export function enhancementInfo(id){
  const item=equipmentOf(id),baseId=equipmentBaseId(id);
  if(!item||!Object.hasOwn(ENHANCEMENT_MATERIALS,baseId))return null;
  const stage=item.enhancementStage||0,nextStage=stage<9?stage+1:null;
  return {baseId,stage,nextStage,chance:nextStage===null?0:(110-nextStage*10)/100,materialIds:[...ENHANCEMENT_MATERIALS[baseId]],nextItemId:nextStage===null?null:baseId+'+'+nextStage};
}
const STAT_ORDER=Object.freeze([
  ['attack','공격력'],['defense','방어력'],['hp','최대 체력'],['mp','최대 마나'],
  ['hpRegen','10초마다 체력 회복'],['mpRegen','10초마다 마나 회복'],['regen','10초 회복 비율'],
  ['speed','이동속도'],['skillDamage','스킬 피해량'],['manaCostIncrease','스킬 마나 소모량'],['durationMs','지속형 스킬 지속시간'],
  ['cooldownReduction','스킬 재사용 시간'],['allCooldownReduction','모든 스킬 재사용 시간']
]);
const PERCENT_STATS=new Set(['regen','speed','skillDamage','manaCostIncrease','cooldownReduction','allCooldownReduction']);
const REDUCTION_STATS=new Set(['cooldownReduction','allCooldownReduction']);
export function equipmentStatText(item){
  if(item.effectText)return item.effectText;
  const bonus=item.bonus||{};
  return STAT_ORDER.filter(([key])=>bonus[key]).map(([key,label])=>{
    const value=bonus[key],sign=REDUCTION_STATS.has(key)||value<0?'-':'+';
    const amount=PERCENT_STATS.has(key)?Math.round(Math.abs(value)*100)+'%':key==='durationMs'?Math.abs(value)/1000+'초':Math.abs(value);
    if(REDUCTION_STATS.has(key))return `${label} ${value<0?'증가':'감소'} ${amount}`;
    return `${label} ${sign}${amount}`;
  }).join(' · ');
}
export function equipmentAuraOf(player){
  const slots=(player?.equipmentSlots||[]).map(equipmentBaseId),blue=slots.includes('spirit-king-cloak'),orange=slots.includes('primordial-star-gem');
  return blue&&orange?'rainbow':blue?'blue':orange?'orange':null;
}
export function equipmentBonus(player){
  const total={attack:0,defense:0,hp:0,mp:0,speed:0,regen:0,hpRegen:0,mpRegen:0,durationMs:0,skillDamage:0,manaCostIncrease:0,cooldownReduction:0,allCooldownReduction:0};
  for(const id of player?.equipmentSlots||[]){
    const item=equipmentOf(id);if(!item)continue;
    for(const key of Object.keys(total))total[key]+=item.bonus[key]||0;
  }
  return total;
}
export function validateEquipmentSlots(slots){
  if(slots===undefined)return [null,null,null]; // 오래된 교실 저장 파일
  if(!Array.isArray(slots)||slots.length!==3||slots.some(id=>id!==null&&!equipmentOf(id))||
    new Set(slots.filter(Boolean).map(equipmentBaseId)).size!==slots.filter(Boolean).length)throw new Error('장착 장비 저장 데이터가 올바르지 않습니다.');
  return [...slots];
}
