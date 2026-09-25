import {LV2_ITEMS} from './lv2-items.js';
import {LV3_ITEMS} from './lv3-items.js';
import {GOLD_CARD_ITEMS} from './star-cards.js';
// 화면과 서버가 공유하는 수치. 서버는 클라이언트가 보낸 설정을 신뢰하지 않습니다.
// speed: 초당 이동 픽셀. 2026-09-15 큰 맵에 맞춰 310 → 620(2배).
// 한 tick(50ms)에 31px로 아바타 충돌 간격 34px보다 작습니다.
export const RULES = Object.freeze({ maxPlayers: 30, maxRooms: 10, tickMs: 50, broadcastMs: 100,
  speed: 620, radius: 16, reconnectMs: 60_000, inputExpiryMs: 300 });
// 상호작용: 행성·문 가장자리에서 이 거리 안에 있으면 살펴보기/나가기를 할 수 있습니다. 서버도 같은 값으로 검사합니다.
export const INTERACT = Object.freeze({ radius: 40 });
// 행성 규칙 편집 한도(소속 친구와 선생님이 내부 규칙판 근처에서 수정).
export const DEPARTMENT_RULES = Object.freeze({ maxLines: 8, maxLineLength: 40 });
export const WARNING_RULES = Object.freeze({defaultThreshold:3,minThreshold:1,maxThreshold:10,maxReasonLength:120,maxEntries:3000});
// 행성(부서)은 아이들이 직접 만듭니다. 학생이 지도에서 자리를 고르고 이름·소개·색을 정해 신청하면 선생님이 승인합니다.
// 선생님은 바로 만들 수도, 없앨 수도 있습니다. 이름은 소속 학생들의 과반 투표로 바꿀 수 있습니다.
// reserved: 행성을 만들 수 없는 자리. 화면 왼쪽 아래 터치 이동 버튼이 지도를 덮는 곳이라 행성이 가려지지 않게 비워 둡니다.
export const PLANET = Object.freeze({ radius: 60, minGap: 80, maxPerRoom: 48, maxPending: 12,
  nameMin: 2, nameMax: 10, descriptionMax: 40, defaultRules: ['서로 존중하고 친절하게 말해요'],
  reserved: [{ x: 0, y: 640, width: 240, height: 120, label: '쉼터 자리' },
    {x:630,y:300,width:900,height:700,label:'별들의 신전'}] });
// 행성 색 팔레트. 뒤의 8색은 행성 종류(PLANET_TEMPLATES)의 기본색으로, 종류를 고르면 자동 선택됩니다. 목록에 없는 색은 서버가 거부합니다.
export const PLANET_COLORS = Object.freeze(['#98dfd2', '#f5bace', '#b5c6f6', '#f5d798', '#c9e7a8', '#f7c8a8', '#d9c6f2', '#a8dff2',
  '#c5c9f7', '#ffd2a8', '#ffe0b5', '#cfd8e6', '#f7e39b', '#f9c6e0', '#ffcfa3', '#bfe3d6']);
// 광장의 고정 오브젝트는 가운데 별과 오른쪽의 '오색별빛 쉼터로 가는 문'입니다. 행성은 방마다 다르게 생기므로 mapOf(mapId, planets)로 합쳐서 씁니다.
// gate: 통과 가능한 문. 가까이에서 이동하면 target 맵의 arrival 좌표 근처에 도착합니다.
export const MAP = Object.freeze({ id: 'space-plaza', name: '별의 기원', width: 2160, height: 1440, spawn:{x:1080,y:800},templeCenter:{x:1080,y:700},
  objects: [
    {id:'pillar-notice',name:'오늘의 알림장',x:760,y:594,radius:30,kind:'pillar',service:'notice',color:'#f4d9ea'},
    {id:'pillar-effects',name:'사용 중인 아이템',x:1400,y:594,radius:30,kind:'pillar',service:'effects',color:'#dacff6'},
    {id:'pillar-timetable',name:'오늘의 시간표',x:790,y:804,radius:30,kind:'pillar',service:'timetable',color:'#c9e8e0'},
    {id:'pillar-weekly',name:'이번 주 받은 별',x:1370,y:804,radius:30,kind:'pillar',service:'weekly',color:'#ffedbb'},
    { id: 'gate-street', name: '오색별빛 쉼터로 가는 문', x: 2080, y: 720, radius: 38, kind: 'gate', target: 'star-street',
      arrival: { x: 170, y: 380 }, color: '#d9c6f2', passable: true },
    { id: 'gate-garden', name: '← 낙원의 갈림길', x: 80, y: 720, radius: 38, kind: 'gate', target:'moon-garden',
      arrival:{x:1030,y:380},color:'#bdeade',passable:true },
    {id:'gate-valley',name:'은하수계곡',x:1080,y:1360,radius:38,kind:'gate',target:'milky-valley',arrival:{x:600,y:180},color:'#c5cff8',passable:true},
    {id:'gate-origin',name:'별의 시작점 1',x:1080,y:80,radius:38,kind:'gate',target:'star-origin-1',arrival:{x:600,y:740},color:'#d2d3ef',passable:true},
    {id:'assignment-andromeda',name:'과제안드로메다',x:260,y:260,radius:240,kind:'andromeda',passable:true},
    {id:'black-hole-portal',name:'블랙홀',x:1900,y:260,radius:240,kind:'black-hole',target:'black-hole',arrival:{x:600,y:390},passable:true}
  ] });
export const PLAZA_ID = MAP.id;
// 두 번째 맵 '오색별빛 쉼터': 별상점이 있는 거리. 왼쪽 문으로 광장에 돌아갑니다. 행성은 만들 수 없습니다.
export const STREET = Object.freeze({ id: 'star-street', name: '오색별빛 쉼터', width: 1200, height: 760, spawn: { x: 170, y: 380 },
  objects: [
    { id: 'gate-plaza', name: '별의 기원으로 가는 문', x: 80, y: 380, radius: 38, kind: 'gate', target: 'space-plaza',
      arrival: { x: 1990, y: 720 }, color: '#d9c6f2', passable: true },
    { id: 'shop', name: '별 상점', x: 400, y: 225, radius: 72, kind: 'shop', color: '#ffe59b' },
    { id: 'energy-shop', name: '우주에너지 상점', x: 800, y: 225, radius: 84, kind: 'energy-shop', color: '#8fd5ff' },
    ...[
      ['memory','별 그림 짝 맞추기','#f2badb'],['baseball','숫자야구','#b8d6fa'],
      ['stars','반짝별 찾기','#ffdf9c'],['sudoku','별빛 스도쿠','#bce8cd'],['dodge','별 피하기','#cfbcf1']
    ].map(([gameId,name,color],i)=>({id:'arcade-'+gameId,gameId,name,color,x:240+i*180,y:510,radius:32,kind:'arcade'})),
    {id:'crafting-machine',name:'별빛 조합기',x:1080,y:380,radius:62,kind:'crafting',color:'#cdb8ef'},
    { id: 'lamp-left', name: '별빛 가로등', x: 220, y: 290, radius: 22, kind: 'lamp', color: '#fff2c9', passable: true },
    { id: 'lamp-right', name: '별빛 가로등', x: 980, y: 290, radius: 22, kind: 'lamp', color: '#d8f5ff', passable: true }
  ] });
export const STREET_ID = STREET.id;
// 기존 저장 위치를 보존하기 위해 갈림길의 ID는 moon-garden 그대로 유지합니다.
export const GARDEN = Object.freeze({id:'moon-garden',name:'낙원의 갈림길',theme:'paradise-crossroads',width:1200,height:760,spawn:{x:1030,y:380},objects:[
  {id:'gate-plaza',name:'별의 기원',x:1120,y:380,radius:38,kind:'gate',target:PLAZA_ID,arrival:{x:170,y:720},color:'#d9c6f2',passable:true},
  {id:'gate-paradise',name:'태양의 낙원 1',x:600,y:80,radius:38,kind:'gate',target:'sun-paradise',arrival:{x:600,y:590},color:'#ffe6a6',passable:true},
  {id:'gate-moon-paradise',name:'달의 낙원 1',x:600,y:680,radius:38,kind:'gate',target:'moon-paradise-1',arrival:{x:600,y:175},color:'#cccafa',passable:true}
]});
export const GARDEN_ID=GARDEN.id;
// 두 낙원은 1에서 왼쪽으로 2→3, 오른쪽으로 되돌아오는 같은 구조를 사용합니다.
// vista는 실제 배경과 미니맵이 공유하는 천체 위치/크기입니다(장식이며 충돌 없음).
function paradiseMaps(moon){
  const idOf=n=>moon?'moon-paradise-'+n:n===1?'sun-paradise':'sun-paradise-'+n;
  const title=moon?'달의 낙원':'태양의 낙원';
  return Object.freeze([1,2,3].map(n=>Object.freeze({id:idOf(n),name:title+' '+n,
    theme:moon?'moon-paradise':'sun-paradise',stage:n,minLevel:n+1,width:1200,height:760,
    vista:Object.freeze({bodyX:175,bodyY:140,bodyRadius:[72,140,235][n-1]}),
    spawn:n===1?{x:600,y:moon?175:590}:{x:1030,y:380},objects:[
      ...(n===1?[{id:'gate-garden',name:'낙원의 갈림길 '+(moon?'↑':'↓'),x:600,y:moon?80:680,radius:38,kind:'gate',
        target:GARDEN_ID,arrival:{x:600,y:moon?590:175},color:'#d8d0f3',passable:true}]:[]),
      ...(n<3?[{id:'gate-next',name:''+title+' '+(n+1),x:80,y:380,radius:38,kind:'gate',target:idOf(n+1),arrival:{x:1030,y:380},color:moon?'#c7c9fa':'#ffdfa2',passable:true}]:[]),
      ...(n>1?[{id:'gate-back',name:title+' '+(n-1)+' →',x:1120,y:380,radius:38,kind:'gate',target:idOf(n-1),arrival:{x:170,y:380},color:moon?'#c7c9fa':'#ffdfa2',passable:true}]:[]),
      ...(n===3?[{id:'gate-star-paradise',name:'별들의 낙원 '+(moon?'↑':'↓'),x:600,y:moon?80:680,radius:38,kind:'gate',target:'star-paradise',arrival:{x:600,y:moon?590:175},color:'#e9d5f5',passable:true}]:[])
    ]})));
}
export const PARADISE_MAPS=paradiseMaps(false);
export const PARADISE=PARADISE_MAPS[0],PARADISE_ID=PARADISE.id;
export const MOON_PARADISE_MAPS=paradiseMaps(true);
export const MOON_PARADISE_ID=MOON_PARADISE_MAPS[0].id;
// 두 여행길의 끝을 연결하는 공간. 지도에서도 태양3과 달3 사이에 놓습니다.
export const STAR_PARADISE=Object.freeze({id:'star-paradise',name:'별들의 낙원',theme:'star-paradise',minLevel:5,width:1200,height:760,spawn:{x:600,y:380},objects:[
  {id:'gate-sun',name:'태양의 낙원 3',x:600,y:80,radius:38,kind:'gate',target:'sun-paradise-3',arrival:{x:600,y:590},color:'#ffe3a6',passable:true},
  {id:'gate-moon',name:'달의 낙원 3',x:600,y:680,radius:38,kind:'gate',target:'moon-paradise-3',arrival:{x:600,y:175},color:'#d3d9ff',passable:true}
]});
export const VALLEY = Object.freeze({id:'milky-valley',name:'은하수계곡',width:1200,height:900,spawn:{x:600,y:180},objects:[
  {id:'evolution-star',name:'진화의 별',x:205,y:480,radius:105,kind:'evolution',color:'#ffffff'},
  {id:'growth-star',name:'성장의 별',x:1020,y:480,radius:80,kind:'growth',color:'#ffd76d'},
  {id:'gate-plaza',name:'별의 기원',x:600,y:80,radius:38,kind:'gate',target:PLAZA_ID,arrival:{x:1080,y:1270},color:'#f4deaa',passable:true}
]});
export const VALLEY_ID=VALLEY.id;
export const BLACK_HOLE = Object.freeze({id:'black-hole',name:'블랙홀 내부',theme:'black-hole',width:1200,height:760,spawn:{x:600,y:390},objects:[
  {id:'black-hole-star',name:'검은별',x:600,y:250,radius:80,kind:'black-star',passable:true},
  {id:'black-hole-exit',name:'블랙홀 밖으로 나가기',x:600,y:680,radius:42,kind:'gate',target:PLAZA_ID,arrival:{x:1560,y:560},passable:true}
]});
export const BLACK_HOLE_ID=BLACK_HOLE.id;
// 위쪽 맵은 1→2→3으로 이어지며, 단계가 오를수록 가로·세로가 기준의 1.2배씩 커집니다.
// 문과 귀환 좌표는 각 맵 크기에서 계산해 서로 다른 크기에서도 같은 상대 위치를 유지합니다.
export const STAR_ORIGIN = Object.freeze({baseWidth:1200,baseHeight:900,scale:1.2,maxStage:3});
export const ORIGIN_MAPS=Object.freeze([1,2,3].map(n=>{
  const factor=STAR_ORIGIN.scale**(n-1),width=STAR_ORIGIN.baseWidth*factor,height=STAR_ORIGIN.baseHeight*factor;
  const previousFactor=STAR_ORIGIN.scale**Math.max(0,n-2),previousWidth=STAR_ORIGIN.baseWidth*previousFactor,
    nextFactor=STAR_ORIGIN.scale**n,nextWidth=STAR_ORIGIN.baseWidth*nextFactor,nextHeight=STAR_ORIGIN.baseHeight*nextFactor;
  return Object.freeze({id:'star-origin-'+n,name:'별의 시작점 '+n,theme:'star-origin',width,height,
    spawn:{x:width/2,y:height-160*factor},objects:[
      {id:'gate-back',name:(n===1?'별의 기원':'별의 시작점 '+(n-1))+' ↓',x:width/2,y:height-80*factor,radius:38,kind:'gate',
        target:n===1?PLAZA_ID:'star-origin-'+(n-1),arrival:n===1?{x:1080,y:175}:{x:previousWidth/2,y:175*previousFactor},color:'#d2d3ef',passable:true},
      ...(n<3?[{id:'gate-next',name:'별의 시작점 '+(n+1)+' ↑',x:width/2,y:80*factor,radius:38,kind:'gate',target:'star-origin-'+(n+1),arrival:{x:nextWidth/2,y:nextHeight-160*nextFactor},color:'#e0d6ff',passable:true}]:[])
    ]});
}));
export const STATIC_MAPS = Object.freeze({ [MAP.id]: MAP, [STREET.id]: STREET,[GARDEN.id]:GARDEN,[VALLEY.id]:VALLEY,[BLACK_HOLE.id]:BLACK_HOLE,[STAR_PARADISE.id]:STAR_PARADISE,...Object.fromEntries([...ORIGIN_MAPS,...PARADISE_MAPS,...MOON_PARADISE_MAPS].map(m=>[m.id,m])) });
// 별 파편: 선생님이 나누어 주는 기본 재화(0 이상의 정수). 파밍으로는 얻지 않습니다.
export const SHARDS = Object.freeze({ max: 9999, giveMax: 999 });
// 별상점 목록. 사는 값은 price, 파는 값은 floor(price * sellRate).
// level: 아바타가 그 레벨 이상이어야 '사용'할 수 있습니다(구매는 레벨과 관계없이 됨). 지금은 모두 LV1이라 LV1 물건만 쓸 수 있습니다.
// targets: 'self'면 나에게만, 'any'면 친구에게도 쓸 수 있습니다. 낮은 레벨이 높은 레벨 친구에게는 쓸 수 없습니다(선생님은 LV5로 취급).
// secret: true면 누가 썼는지 친구들에게는 비밀('누군가')이고 선생님에게만 보입니다.
// effect: 사용하면 대상에게 붙는 표시(아이콘·이름·지속 시간). 지금은 겉모습 표시만 하고 이동 속도 등 실제 능력치는 바꾸지 않습니다.
// maxKinds 20 = 가방 격자 5×4칸(한 칸에 한 종류). BAG는 화면 격자 크기입니다.
export const BAG = Object.freeze({ columns: 5, rows: 4 });
// 기존 상품의 구매/판매 통화는 별 파편입니다. 우주에너지로 자동 대체하지 않습니다.
export const SHOP = Object.freeze({ currency: 'starShards', sellRate: 0.5, maxStack: 99, maxKinds: 40, items: [
  { id: 'star-sticker', name: '반짝 별 스티커', forSale: false, description: '친구 소행성에 붙여 주는 작은 별 스티커예요.', icon: '⭐', type: 'decoration', level: 1, price: 5,
    targets: 'any', secret: false, effect: { label: '반짝반짝', icon: '⭐', durationMs: 30 * 60_000, style: 'sparkle' } },
  { id: 'space-snack', name: '우주 간식', forSale: false, description: '달콤한 별사탕이에요. 누가 줬는지는 비밀!', icon: '🍬', type: 'consumable', level: 1, price: 3,
    targets: 'any', secret: true, effect: { label: '냠냠 행복', icon: '🍬', durationMs: 5 * 60_000, style: 'happy' } },
  { id: 'asteroid-helmet', name: '소행성 헬멧', forSale: false, description: '튼튼하고 귀여운 우주 헬멧이에요.', icon: '🪖', type: 'decoration', level: 1, price: 6,
    targets: 'any', secret: false, effect: { label: '튼튼 헬멧', icon: '🪖', durationMs: 30 * 60_000, style: 'helmet' } },
  { id: 'firefly-lamp', name: '반딧불 램프', forSale: false, description: '어두운 우주를 밝혀 주는 램프예요.', icon: '🏮', type: 'tool', level: 1, price: 8,
    targets: 'any', secret: false, effect: { label: '반딧불 빛', icon: '🏮', durationMs: 10 * 60_000, style: 'glow' } },
  { id: 'rainbow-tail', name: '무지개 꼬리', forSale: false, description: '움직일 때 무지개가 따라와요. (LV2부터)', icon: '🌈', type: 'decoration', level: 2, price: 12,
    targets: 'self', secret: false, effect: { label: '무지개 꼬리', icon: '🌈', durationMs: 30 * 60_000, style: 'trail' } },
  { id: 'mini-satellite', name: '작은 위성 친구', forSale: false, description: '내 곁을 빙글빙글 도는 귀여운 위성이에요. (LV2부터)', icon: '🛰️', type: 'pet', level: 2, price: 15,
    targets: 'self', secret: false, effect: { label: '위성 친구', icon: '🛰️', durationMs: 60 * 60_000, style: 'orbit' } },
  { id: 'starlight-cape', name: '별빛 망토', forSale: false, description: '별빛으로 짠 반짝이는 망토예요. (LV3부터)', icon: '🧣', type: 'decoration', level: 3, price: 25,
    targets: 'any', secret: false, effect: { label: '별빛 망토', icon: '🧣', durationMs: 30 * 60_000, style: 'cape' } },
  { id: 'meteor-board', name: '유성 보드', forSale: false, description: '유성을 타고 씽씽 달려요. 누가 태워 줬는지는 비밀! (LV3부터)', icon: '☄️', type: 'mount', level: 3, price: 30,
    targets: 'any', secret: true, effect: { label: '유성 질주', icon: '☄️', durationMs: 3 * 60_000, style: 'speed' } },
  {id:'space-food-card',name:'우주 식량',description:'1명의 급식 위치를 선정합니다.',special:'선생님이 사용 중인 아이템 게시판을 보고 현실 교실에서 진행해요.',art:'/assets/items/space-food-pastel.webp',icon:'🍱',type:'tool',level:1,price:2,targets:'any',secret:false,mode:'manual',effect:{label:'급식 위치 선정',icon:'🍱',durationMs:0,style:'card'}},
  {id:'space-robot-card',name:'우주 로봇',description:'모든 마감 기한을 1일 늘립니다.',special:'다음 날이 휴일이면 카드 2장이 필요해요. 선생님이 현실 교실에서 확인해요.',art:'/assets/items/space-robot-pastel.webp',icon:'🤖',type:'tool',level:1,price:2,targets:'self',secret:false,mode:'manual',effect:{label:'마감 기한 연장',icon:'🤖',durationMs:0,style:'card'}},
  {id:'alien-card',name:'외계인',description:'일기장 또는 독서록 중 1편을 면제합니다.',special:'선생님이 사용 중인 아이템 게시판을 보고 현실 교실에서 진행해요.',art:'/assets/items/alien-pastel.webp',icon:'👽',type:'tool',level:1,price:4,targets:'self',secret:false,mode:'manual',effect:{label:'일기장·독서록 면제',icon:'👽',durationMs:0,style:'card'}},
  {id:'space-suit-card',name:'우주복',description:'1일 동안 선택한 2명의 자리를 맞교환합니다.',special:'자리 이동은 직접 도와야 합니다. 선생님이 현실 교실에서 확인해요.',art:'/assets/items/space-suit-pastel.webp',icon:'🧑‍🚀',type:'tool',level:1,price:2,targets:'pair',secret:false,mode:'manual',effect:{label:'자리 맞교환',icon:'🧑‍🚀',durationMs:0,style:'card'}},
  {id:'meteor-fragment-card',name:'운석 파편',description:'선택한 부서행성이 나에게 준 활성 경고를 모두 해제합니다.',special:'다른 학생의 경고와 경고 이력은 그대로 둡니다.',art:'/assets/items/meteor-fragment-pastel.webp',icon:'☄️',type:'tool',level:1,price:3,targets:'self',secret:false,mode:'meteor',effect:{label:'부서 경고 해제',icon:'☄️',durationMs:0,style:'card'}},
  {id:'little-sun-card',name:'꼬마 해',description:'친구 1명을 자외선 상태로 만들어 오늘 자정까지 아이템 사용을 막습니다.',special:'꼬마 달로 즉시 해제할 수 있어요. 꼬마 달 보호 중인 친구에게는 사용할 수 없어요.',art:'/assets/items/little-sun-pastel.webp',icon:'☀️',type:'tool',level:1,price:1,targets:'other',secret:false,mode:'uv',effect:{label:'자외선',icon:'☀️',durationMs:0,style:'uv'}},
  {id:'little-moon-card',name:'꼬마 달',description:'마치기 전 청소를 면제받고 조금 일찍 갑니다.',special:'자외선을 즉시 해제하고 오늘 자정까지 다른 카드 효과를 받지 않아요. 검은별 상태에서는 사용할 수 없어요.',art:'/assets/items/little-moon-pastel.webp',icon:'🌙',type:'tool',level:1,price:2,targets:'self',secret:false,mode:'moon',effect:{label:'꼬마 달 보호',icon:'🌙',durationMs:0,style:'moon'}},
  {id:'moon-rabbit-card',name:'달토끼',description:'사용한 날 마칠 때 뽑기 카드 기회 1회를 받습니다.',special:'하루에 2장을 사용할 수 없어요. 뒷면 카드 54장 중 하나를 골라 아이템·별 파편·경험치 보상을 받아요. 우주 먼지는 보상이 없어요.',art:'/assets/items/moon-rabbit-pastel.webp',icon:'🐇',type:'tool',level:1,price:3,targets:'self',secret:false,mode:'draw',effect:{label:'뽑기 카드',icon:'🐇',durationMs:0,style:'card'}},
  ...LV2_ITEMS,
  ...LV3_ITEMS,
  ...GOLD_CARD_ITEMS,
  {id:'star-card',name:'별 카드',description:'사용하면 금별 카드 30종 중 한 장을 무작위로 뽑아 신전에 공개해요.',art:'/assets/cards/star-card-back.webp',icon:'✦',type:'card',level:1,price:0,sellPrice:null,forSale:false,usable:true,mode:'star-card',targets:'self',secret:false,effect:{label:'별 카드 공개',icon:'✦',durationMs:0,style:'card'}}
] });
// 아이템 사용 규칙: 연속 사용 간격, 한 사람이 동시에 가질 수 있는 효과 수(넘치면 오래된 것부터 사라짐), 선생님용 사용 기록 보관 수, 선생님의 취급 레벨.
export const ITEM_USE = Object.freeze({ cooldownMs: 2000, maxEffects: 3, logSize: 100, teacherLevel: 5, notesSize: 20 });
// 거래: 학생끼리 별 파편·아이템을 주고받을 수 있지만, 상대가 수락한 뒤 선생님이 최종 승인해야 실제로 오갑니다.
// (힘 있는 아이가 약한 아이의 것을 강제로 뺏는 일을 막기 위한 장치입니다.) 한 사람은 한 번에 하나의 거래만 진행합니다.
// declineBlockMs: 상대가 거절하면 같은 상대에게 그 시간 동안 다시 제안할 수 없습니다(계속 조르기 방지).
export const TRADE = Object.freeze({ maxPending: 10, maxItemKinds: 5, maxShards: 999, declineBlockMs: 5 * 60_000 });
export const ITEM_TYPES = Object.freeze({ decoration: '꾸미기', consumable: '간식', tool: '도구', pet: '펫', mount: '탈것' });
export const itemOf = itemId => SHOP.items.find(i => i.id === itemId) || null;
// 만들 수 있는 행성 종류(2026-09-12 사용자 지정 13종). 아이들은 이 목록에서 골라 행성을 만들고, 이름은 2~10자 안에서 바꿀 수 있습니다.
// look: 화면이 종류에 맞게 다르게 그리는 모양 스타일. icon: 행성 가운데에 그리는 그림 글자. 추후 아이들이 직접 그린 디자인(이미지)을 붙이는 기능을 붙일 자리는 image(현재 null)입니다.
export const PLANET_TEMPLATES = Object.freeze([
  { id: 'diary', name: '일기행성', icon: '📔', color: '#f5bace', look: 'ribbon', image: null,
    description: '하루를 기록하고 마음을 나누는 친구들의 행성이에요.',
    rules: ['일기는 매일 한 줄 이상 써요', '친구의 일기는 허락 없이 보지 않아요', '일기장은 정해진 자리에 제출해요'] },
  { id: 'subject', name: '교과행성', icon: '📚', color: '#f5d798', look: 'stripes', image: null,
    description: '수업을 준비하고 서로 가르쳐 주는 친구들의 행성이에요.',
    rules: ['수업 준비물을 미리 챙겨요', '모르는 것은 손을 들고 물어봐요', '친구가 물어보면 친절하게 알려줘요'] },
  { id: 'reading', name: '독서행성', icon: '📖', color: '#98dfd2', look: 'pages', image: null,
    description: '책을 아끼고 함께 읽는 친구들의 행성이에요.',
    rules: ['읽은 책은 제자리에 꽂아요', '책을 읽는 동안에는 조용히 해요', '빌린 책은 일주일 안에 돌려줘요'] },
  { id: 'rules', name: '규칙행성', icon: '📜', color: '#c5c9f7', look: 'shield', image: null,
    description: '우리 반 약속을 지키고 알려 주는 친구들의 행성이에요.',
    rules: ['약속을 어긴 친구에게는 먼저 부드럽게 알려줘요', '규칙은 모두가 함께 정해요', '경고는 누구에게나 공평하게 줘요'] },
  { id: 'pe', name: '체육행성', icon: '⚽', color: '#ffd2a8', look: 'ball', image: null,
    description: '몸을 움직이고 함께 뛰노는 친구들의 행성이에요.',
    rules: ['체육 도구는 쓴 뒤 제자리에 둬요', '준비운동을 꼭 해요', '이기고 져도 서로 박수를 쳐요'] },
  { id: 'meal', name: '급식행성', icon: '🍱', color: '#ffe0b5', look: 'plate', image: null,
    description: '맛있는 급식을 함께 준비하는 친구들의 행성이에요.',
    rules: ['차례를 지켜 줄을 서요', '음식은 먹을 만큼만 받아요', '식판은 깨끗이 정리해요'] },
  { id: 'facility', name: '시설행성', icon: '🔧', color: '#cfd8e6', look: 'bolts', image: null,
    description: '교실 물건과 시설을 돌보는 친구들의 행성이에요.',
    rules: ['고장 난 것은 바로 알려요', '물건은 소중히 다뤄요', '창문과 전등은 마지막에 확인해요'] },
  { id: 'finance', name: '재무행성', icon: '💰', color: '#f7e39b', look: 'coins', image: null,
    description: '우리 반 살림을 관리하는 친구들의 행성이에요.',
    rules: ['별 파편 기록은 정확하게 남겨요', '내 것과 반 것을 구별해요', '쓰기 전에 함께 의논해요'] },
  { id: 'counsel', name: '상담행성', icon: '💬', color: '#d9c6f2', look: 'heart', image: null,
    description: '친구의 고민을 들어 주는 친구들의 행성이에요.',
    rules: ['친구의 비밀은 지켜요', '끝까지 들어 준 다음 말해요', '힘든 친구는 선생님께 함께 가요'] },
  { id: 'cleaning', name: '청소행성', icon: '🧹', color: '#b5c6f6', look: 'sparkle', image: null,
    description: '교실을 반짝이게 만드는 친구들의 행성이에요.',
    rules: ['줄을 서지 않으면 경고를 받아요', '청소 도구는 쓴 뒤 제자리에 둬요', '내 자리는 내가 정리해요'] },
  { id: 'art', name: '예술행성', icon: '🎨', color: '#f9c6e0', look: 'splash', image: null,
    description: '그림과 만들기로 교실을 꾸미는 친구들의 행성이에요.',
    rules: ['재료는 아껴 써요', '작품은 소중히 다뤄요', '친구 작품의 좋은 점을 말해줘요'] },
  { id: 'show', name: '예능행성', icon: '🎤', color: '#ffcfa3', look: 'stars', image: null,
    description: '노래·춤·재미로 교실을 즐겁게 하는 친구들의 행성이에요.',
    rules: ['무대는 차례대로 써요', '친구를 놀리는 개그는 하지 않아요', '공연 준비는 함께 해요'] },
  { id: 'audit', name: '감찰행성', icon: '🔍', color: '#bfe3d6', look: 'eye', image: null,
    description: '교실이 공정하게 돌아가는지 살펴보는 친구들의 행성이에요.',
    rules: ['본 것만 정확하게 말해요', '친구를 몰래 지켜보지 않아요', '문제는 선생님께 먼저 알려요'] }
]);
export const templateOf = templateId => PLANET_TEMPLATES.find(t => t.id === templateId) || null;
// 선생님이 교실을 만들 때 '예시 행성으로 시작'을 켜면 아래 4개가 종류 목록의 값으로 미리 놓입니다. 이름·규칙은 나중에 바꿀 수 있습니다.
const example = (templateId, x, y) => { const t = templateOf(templateId); return { templateId, name: t.name, x, y, color: t.color, description: t.description, rules: [...t.rules] }; };
export const EXAMPLE_PLANETS = Object.freeze([
  example('reading', 650, 150), example('diary', 1450, 175), example('cleaning', 190, 565), example('subject', 1870, 565)
]);
// 행성 내부 맵 템플릿: 광장과 같은 크기의 작은 방. 위에는 규칙 게시판(충돌), 아래에는 광장으로 나가는 문(통과 가능).
export const INTERIOR = Object.freeze({ width: 1200, height: 760, spawn: { x: 600, y: 560 },
  objects: [
    { id: 'board', name: '행성 규칙 게시판', x: 600, y: 150, radius: 80, kind: 'board', color: '#fff6d6' },
    { id: 'report-board', name: '부서실적 작성하기', x: 960, y: 170, radius: 28, kind: 'report-board', color: '#fff6d6' },
    { id: 'warning-rock', name: '경고 돌덩이', x: 260, y: 590, radius: 48, kind: 'warning-rock', color: '#696477' },
    { id: 'door', name: '광장으로 나가는 문', x: 600, y: 690, radius: 34, kind: 'door', color: '#d9d3f2', passable: true }
  ] });
export const interiorIdOf = planetId => 'planet:' + planetId;
export const planetIdOfMap = mapId => (typeof mapId === 'string' && mapId.startsWith('planet:')) ? mapId.slice(7) : null;
// planets: 그 방의 행성 목록(배열 또는 Map의 values). 광장이면 별·문 + 행성들이 오브젝트가 되고, 오색별빛 쉼터는 고정 맵, 내부 맵이면 템플릿에 행성 정보를 얹습니다.
export function mapOf(mapId, planets = []) {
  const list = Array.isArray(planets) ? planets : [...planets];
  if (mapId !== PLAZA_ID && STATIC_MAPS[mapId]) return STATIC_MAPS[mapId];
  const planetId = planetIdOfMap(mapId);
  if (!planetId) return { ...MAP, objects: [...MAP.objects, ...list] };
  const planet = list.find(p => p.id === planetId);
  return { ...INTERIOR, id: mapId, planetId, name: (planet ? planet.name : '행성') + ' 안', color: planet ? planet.color : '#d9d3f2' };
}
// 경험치 계산은 server/progression.js에서 수행합니다. 경험치 획득 활동과 장비·그림은 후속 연결 대상입니다.
export const PROGRESSION = Object.freeze({ maxLevel: 5, nextLevelXp: Object.freeze([15, 20, 25, 30]),
  transcendentLevel: 5, transcendentName: '초월체', constellationSlots: 16 });
export function createAvatar() {
  return { form: 'asteroid', level: 1, xp: 0, constellationId: null,
    equipment: { pet: null, mount: null, decoration: null }, departmentId: null, blackStar:null };
}
// 향후 인벤토리 항목: { id, name, description, icon, quantity, type, level }.
// 향후 별 파편 잔액은 0 이상의 안전한 정수로, 지급/지출은 서버에서 검증합니다.
// 길이에 따른 읽기 시간과 도배 방지 기준은 화면·서버가 함께 참조합니다.
export const CHAT = Object.freeze({ maxLength: 100, historySize: 50, cooldownMs: 1500,
  rateWindowMs: 10_000, maxPerWindow: 5, repeatWindowMs: 10_000,
  bubbleBaseMs: 3000, bubblePerCharMs: 90, bubbleMaxMs: 12_000 });
