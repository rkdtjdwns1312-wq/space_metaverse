// 별의 시작점에서 만나는 귀여운 동물별자리 상상 디자인 목록입니다.
export const MONSTER_HP=Object.freeze({'star-origin-1':20,'star-origin-2':40,'star-origin-3':100});
export const MONSTER_COMBAT=Object.freeze({
  'star-origin-1':Object.freeze({power:2,speedFactor:1}),
  'star-origin-2':Object.freeze({power:3,speedFactor:1.3}),
  'star-origin-3':Object.freeze({power:5,speedFactor:1.3*1.3})
});
export const MONSTER_TYPES = Object.freeze([
  { id: 'star-crab', name: 'Lv1 별게', description: '달과 별을 품은 파란 등껍질, 집게에서 작은 물결을 일으키는 별게', mapId: 'star-origin-1', shape: 'star-crab', color: '#96cfff', level: 1 },
  { id: 'water-star', name: 'Lv1 물별이', description: '별무늬 물병을 메고 물보라를 뿌리는 작은 물별이', mapId: 'star-origin-1', shape: 'water-star', color: '#b6ecff', level: 1 },
  { id: 'star-scorpion', name: 'Lv2 별전갈', description: '보랏빛 별가루를 품은 별전갈', mapId: 'star-origin-2', shape: 'star-scorpion', color: '#a875d8', level: 2 },
  { id: 'chameleon-star', name: 'Lv2 카멜레별', description: '파스텔 초록빛으로 반짝이는 카멜레별', mapId: 'star-origin-2', shape: 'chameleon-star', color: '#b8e6a1', level: 2 },
  { id: 'star-keeper', name: '별지기자리', description: '두 손에 별을 안은 사람 모양 별지기', mapId: 'star-origin-3', shape: 'star-keeper', color: '#f4c7e8', level: 3 },
  { id: 'bear', name: '곰자리', description: '포근한 발바닥으로 별을 지키는 곰', mapId: 'star-origin-3', shape: 'bear', color: '#c9b3a5', level: 3 },
  { id: 'elephant', name: '코끼리자리', description: '긴 코로 별가루를 뿜는 코끼리', mapId: 'star-origin-3', shape: 'elephant', color: '#c8c7e8', level: 3 },
  { id: 'whale', name: '고래자리', description: '은하 바다를 헤엄치는 큰 고래', mapId: 'star-origin-3', shape: 'whale', color: '#9fd8e8', level: 3 },
  { id: 'giraffe', name: '기린자리', description: '목 끝까지 별이 이어진 키 큰 기린', mapId: 'star-origin-3', shape: 'giraffe', color: '#ffe09b', level: 3 }
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
  ...MONSTER_TYPES.filter(t=>t.level===3).map(t=>({id:t.id,typeId:t.id}))
]);
