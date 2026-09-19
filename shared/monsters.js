// 별의 시작점에서 만나는 귀여운 동물별자리 상상 디자인 목록입니다.
export const MONSTER_HP=Object.freeze({'star-origin-1':20,'star-origin-2':40,'star-origin-3':100});
export const MONSTER_TYPES = Object.freeze([
  { id: 'rabbit', name: '토끼자리', description: '긴 귀와 동그란 꼬리를 가진 달토끼 별자리', mapId: 'star-origin-1', shape: 'rabbit', color: '#ffd6e7', level: 1 },
  { id: 'squirrel', name: '다람쥐자리', description: '복슬복슬한 꼬리로 별가루를 모으는 다람쥐', mapId: 'star-origin-1', shape: 'squirrel', color: '#f6c995', level: 1 },
  { id: 'turtle', name: '거북이자리', description: '별무늬 등껍질을 멘 느긋한 거북이', mapId: 'star-origin-1', shape: 'turtle', color: '#b9e6c3', level: 1 },
  { id: 'hedgehog', name: '고슴도치자리', description: '가시마다 작은 별이 반짝이는 고슴도치', mapId: 'star-origin-1', shape: 'hedgehog', color: '#e5c6a8', level: 1 },
  { id: 'butterfly', name: '나비자리', description: '네 장의 날개에 별빛을 담은 나비', mapId: 'star-origin-1', shape: 'butterfly', color: '#cdbbff', level: 1 },
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
