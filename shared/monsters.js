// 기존 원화 대비 화면 면적 배율입니다. 다른 맵 몬스터와 전투 판정은 바꾸지 않습니다.
export const MONSTER_VISUAL_AREA=Object.freeze({'star-origin-1':1.5,'star-origin-3':2});
// 대기 원화의 불투명 몸체 외곽(따뜻한별 485×462, 서늘한별 400×412)을 기준으로
// 투명 여백이 다른 두 LV2 몬스터의 화면 점유 면적을 맞춥니다. 전투 반경은 유지합니다.
export const WARM_STAR_VISUAL_SCALE=Math.sqrt((400*412)/(485*462));
export const monsterVisualScale=(mapId,typeId)=>Math.sqrt(MONSTER_VISUAL_AREA[mapId]||1)*(typeId==='warm-star'?WARM_STAR_VISUAL_SCALE:1);
// 별의 시작점에서 만나는 귀여운 동물별자리 상상 디자인 목록입니다.
export const MONSTER_HP=Object.freeze({'star-origin-1':20,'star-origin-2':40,'star-origin-3':100,'sun-paradise':40,'sun-paradise-2':100,'moon-paradise-1':40,'moon-paradise-2':100});
export const MONSTER_COMBAT=Object.freeze({
  'star-origin-1':Object.freeze({power:2,speedFactor:1}),
  'star-origin-2':Object.freeze({power:3,speedFactor:1.3}),
  'star-origin-3':Object.freeze({power:5,speedFactor:1.3*1.3}),
  'sun-paradise':Object.freeze({power:3,speedFactor:1.3}),
  'sun-paradise-2':Object.freeze({power:5,speedFactor:1.3*1.3}),
  'moon-paradise-1':Object.freeze({power:3,speedFactor:1.3}),
  'moon-paradise-2':Object.freeze({power:5,speedFactor:1.3*1.3})
});
export const MONSTER_TYPES = Object.freeze([
  { id:'warm-star', name:'Lv2 따뜻한별', description:'작은 햇살을 나누는 따뜻한별. 공격받으면 금빛으로 몸을 부딪쳐 반격해요.', mapId:'sun-paradise', shape:'warm-star', color:'#ffd16a', level:2 },
  { id:'grown-warm-star', name:'Lv3 성장한따뜻한별', description:'별의 궤도를 품고 성장한 따뜻한별. 황금빛을 모아 몸통으로 반격해요.', mapId:'sun-paradise-2', shape:'grown-warm-star', color:'#ffba4f', level:3 },
  { id:'cool-star', name:'Lv2 서늘한별', description:'달빛을 머금은 서늘한별. 차분한 빛으로 가까운 모험가를 밀어내요.', mapId:'moon-paradise-1', shape:'cool-star', color:'#9bd8ff', level:2 },
  { id:'grown-cool-star', name:'Lv3 성장한서늘한별', description:'달의 궤도에서 자라난 서늘한별. 푸른 달빛을 모아 힘차게 반격해요.', mapId:'moon-paradise-2', shape:'grown-cool-star', color:'#879dff', level:3 },
  { id: 'star-crab', name: 'Lv1 별게', description: '달과 별을 품은 파란 등껍질, 집게에서 작은 물결을 일으키는 별게', mapId: 'star-origin-1', shape: 'star-crab', color: '#96cfff', level: 1 },
  { id: 'water-star', name: 'Lv1 물별이', description: '별무늬 물병을 메고 물보라를 뿌리는 작은 물별이', mapId: 'star-origin-1', shape: 'water-star', color: '#b6ecff', level: 1 },
  { id: 'star-scorpion', name: 'Lv2 별전갈', description: '보랏빛 별가루를 품은 별전갈', mapId: 'star-origin-2', shape: 'star-scorpion', color: '#a875d8', level: 2 },
  { id: 'chameleon-star', name: 'Lv2 카멜레별', description: '파스텔 초록빛으로 반짝이는 카멜레별', mapId: 'star-origin-2', shape: 'chameleon-star', color: '#b8e6a1', level: 2 },
  { id: 'star-dragon', name: 'Lv3 별용이', description: '별빛 비늘을 두른 용이', mapId: 'star-origin-3', shape: 'star-dragon', color: '#67c8ff', level: 3 },
  { id: 'star-phoenix', name: 'Lv3 별사조', description: '별의 불꽃을 품은 사조', mapId: 'star-origin-3', shape: 'star-phoenix', color: '#ff9f45', level: 3 }
]);

export function monsterType(id) {
  return MONSTER_TYPES.find(monster => monster.id === id) || null;
}

// 종류와 개체를 분리합니다. 첫째·둘째 맵은 각각 두 종류로 다섯 마리 규모를 유지합니다.
export const MONSTER_SPAWNS=Object.freeze([
  {id:'star-crab',typeId:'star-crab'}, {id:'water-star',typeId:'water-star'},
  {id:'star-crab-2',typeId:'star-crab'}, {id:'water-star-2',typeId:'water-star'},
  {id:'star-crab-3',typeId:'star-crab'},
  {id:'star-scorpion-1',typeId:'star-scorpion'}, {id:'star-scorpion-2',typeId:'star-scorpion'},
  {id:'star-scorpion-3',typeId:'star-scorpion'}, {id:'chameleon-star-1',typeId:'chameleon-star'},
  {id:'chameleon-star-2',typeId:'chameleon-star'},
  ...Array.from({length:3},(_,i)=>({id:`star-dragon-${i+1}`,typeId:'star-dragon'})),
  ...Array.from({length:2},(_,i)=>({id:`star-phoenix-${i+1}`,typeId:'star-phoenix'})),
  ...['warm-star','grown-warm-star','cool-star','grown-cool-star'].flatMap(typeId=>Array.from({length:5},(_,i)=>({id:`${typeId}-${i+1}`,typeId})))
]);
