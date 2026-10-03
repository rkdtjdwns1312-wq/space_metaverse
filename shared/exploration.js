// 10장의 결과 카드: 0점 2장, 1점 6장, 2점 2장입니다.
// 카드는 교실 상태에 ID만 저장하므로 나중에 문구와 그림을 교체하기 쉽습니다.
export const EXPLORATION_GOAL = 15;
export const EXPLORATION_CARDS = Object.freeze([
  {id:'quiet-nebula',title:'고요한 성운',story:'구름 사이로 별빛이 숨었어요. 오늘은 길을 찾으며 쉬어 가요.',energy:0},
  {id:'sleeping-comet',title:'잠든 혜성',story:'작은 혜성이 아직 잠들어 있어요. 다음 탐사를 기다려요.',energy:0},
  {id:'silver-trail',title:'은빛 발자국',story:'발끝에 닿은 별가루가 한 걸음의 길을 밝혀 주었어요.',energy:1},
  {id:'whisper-star',title:'속삭이는 별',story:'멀리서 들려온 별의 인사가 실험실을 환하게 만들어요.',energy:1},
  {id:'moon-bridge',title:'달빛 다리',story:'달빛이 얇은 다리를 놓아 새로운 풍경을 보여 주었어요.',energy:1},
  {id:'warm-spark',title:'따뜻한 불씨',story:'손바닥 위의 작은 빛이 친구들에게 온기를 나눠요.',energy:1},
  {id:'rainbow-dust',title:'무지개 별가루',story:'일곱 빛깔 별가루가 나란히 춤추며 지나갔어요.',energy:1},
  {id:'little-lighthouse',title:'작은 등대별',story:'길을 잃지 않도록 등대별이 조용히 반짝여요.',energy:1},
  {id:'radiant-garden',title:'찬란한 별밭',story:'우주 한편에 빛나는 별밭이 펼쳐졌어요.',energy:2},
  {id:'festival-signal',title:'축제의 전조',story:'멀리서 온 커다란 빛이 모두의 축제를 예고해요.',energy:2}
]);
