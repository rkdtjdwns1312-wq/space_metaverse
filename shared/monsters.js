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
  { id: 'lion', name: '사자자리', description: '갈기처럼 별이 둥글게 모인 용감한 사자', mapId: 'star-origin-2', shape: 'lion', color: '#ffe39a', level: 2 },
  { id: 'tiger', name: '호랑이자리', description: '파스텔 줄무늬를 두른 씩씩한 호랑이', mapId: 'star-origin-2', shape: 'tiger', color: '#ffc49b', level: 2 },
  { id: 'wolf', name: '늑대자리', description: '푸른 별빛 털을 가진 다정한 늑대', mapId: 'star-origin-2', shape: 'wolf', color: '#b9d7f2', level: 2 },
  { id: 'fox', name: '여우자리', description: '커다란 꼬리가 별꼬리처럼 빛나는 여우', mapId: 'star-origin-2', shape: 'fox', color: '#ffb99f', level: 2 },
  { id: 'leopard', name: '표범자리', description: '점박이 별무늬를 가진 날쌘 표범', mapId: 'star-origin-2', shape: 'leopard', color: '#f5d39a', level: 2 },
  { id: 'star-keeper', name: '별지기자리', description: '두 손에 별을 안은 사람 모양 별지기', mapId: 'star-origin-3', shape: 'star-keeper', color: '#f4c7e8', level: 3 },
  { id: 'bear', name: '곰자리', description: '포근한 발바닥으로 별을 지키는 곰', mapId: 'star-origin-3', shape: 'bear', color: '#c9b3a5', level: 3 },
  { id: 'elephant', name: '코끼리자리', description: '긴 코로 별가루를 뿜는 코끼리', mapId: 'star-origin-3', shape: 'elephant', color: '#c8c7e8', level: 3 },
  { id: 'whale', name: '고래자리', description: '은하 바다를 헤엄치는 큰 고래', mapId: 'star-origin-3', shape: 'whale', color: '#9fd8e8', level: 3 },
  { id: 'giraffe', name: '기린자리', description: '목 끝까지 별이 이어진 키 큰 기린', mapId: 'star-origin-3', shape: 'giraffe', color: '#ffe09b', level: 3 }
]);

export function monsterType(id) {
  return MONSTER_TYPES.find(monster => monster.id === id) || null;
}

// 종류와 개체를 분리합니다. 첫 맵은 두 종류로 기존 다섯 마리 규모를 유지합니다.
export const MONSTER_SPAWNS=Object.freeze([
  {id:'star-crab',typeId:'star-crab'}, {id:'water-star',typeId:'water-star'},
  {id:'star-crab-2',typeId:'star-crab'}, {id:'water-star-2',typeId:'water-star'},
  {id:'star-crab-3',typeId:'star-crab'},
  ...MONSTER_TYPES.filter(t=>t.level>1).map(t=>({id:t.id,typeId:t.id}))
]);
