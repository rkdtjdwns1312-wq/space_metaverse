// Original slide text is retained, including line breaks, in sourceText.
// No config import: config.js may register GOLD_CARD_ITEMS without a cycle.
export const STAR_CARD_ART = Object.freeze({back:'/assets/cards/star-card-back.webp',face:'/assets/cards/star-card-face.webp'});
export const STAR_CARD_LAYOUT = Object.freeze({maxCards:30,columns:8,rows:5,spacingX:100,spacingY:120,width:66,height:90,minPillarDistance:80});
export const MAX_STAR_CARDS = STAR_CARD_LAYOUT.maxCards;
export const STAR_CARD_CATALOG = Object.freeze([
  {
    "id": "new-life",
    "name": "새로운 삶의 터전",
    "description": "생명체가 살아갈 수 있는 \n행성을 발견했습니다",
    "effect": "자리 영구로 지정하고 \n우주식량 아이템을 \n2개 획득합니다",
    "durationDays": null,
    "sourceSlide": 2,
    "sourceIndex": 1,
    "sourceText": "\n새로운 삶의 터전\n\n생명체가 살아갈 수 있는 \n행성을 발견했습니다\n\n\n\n자리 영구로 지정하고 \n우주식량 아이템을 \n2개 획득합니다\n\n",
    "automatic": [
      "우주 식량 2개 지급"
    ],
    "manual": [
      "영구 자리 지정은 선생님이 확인해요."
    ]
  },
  {
    "id": "comet",
    "name": "혜성의 기운",
    "description": "눈 깜짝할 사이에 빠르게 \n날아가는 혜성의 기운을 \n받습니다",
    "effect": "하루동안 급식줄 1등, 종례 \n마치기 1등, 순위가 정해진 \n모든 것에 우선순위를 \n가집니다",
    "durationDays": 1,
    "sourceSlide": 2,
    "sourceIndex": 2,
    "sourceText": "\n혜성의 기운\n\n눈 깜짝할 사이에 빠르게 \n날아가는 혜성의 기운을 \n받습니다\n\n\n하루동안 급식줄 1등, 종례 \n마치기 1등, 순위가 정해진 \n모든 것에 우선순위를 \n가집니다\n\n",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "rest",
    "name": "별의 휴식",
    "description": "모든 자신의 일을 마치고 \n잠시 쉬어가는 시간을 \n가집니다",
    "effect": "아침 자습시간, 쉬는 시간, \n점심 시간, 종례시간 등에 \n간섭 없이 휴식을 취할 수 \n있습니다\n또한 모든 과제는 하루 \n미뤄집니다",
    "durationDays": null,
    "sourceSlide": 2,
    "sourceIndex": 3,
    "sourceText": "\n별의 휴식\n\n모든 자신의 일을 마치고 \n잠시 쉬어가는 시간을 \n가집니다\n\n\n아침 자습시간, 쉬는 시간, \n점심 시간, 종례시간 등에 \n간섭 없이 휴식을 취할 수 \n있습니다\n또한 모든 과제는 하루 \n미뤄집니다\n",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "alien-encounter",
    "name": "외계인과의 만남",
    "description": "새로운 언어를 사용하는 \n외계인을 만나 미지의 언\n어로 일기를 대신 씁니다",
    "effect": "일기 1회 면제하고 외계인 카드를 추가로 획득합니다",
    "durationDays": null,
    "sourceSlide": 2,
    "sourceIndex": 4,
    "sourceText": "\n외계인과의 만남\n\n새로운 언어를 사용하는 \n외계인을 만나 미지의 언\n어로 일기를 대신 씁니다\n\n\n일기 1회 면제하고 외계인 카드를 추가로 획득합니다\n\n",
    "automatic": [
      "외계인 카드 1개 지급"
    ],
    "manual": [
      "일기 1회 면제는 선생님이 확인해요."
    ]
  },
  {
    "id": "space-food",
    "name": "우주 전용 식량",
    "description": "우주에서 소비할 수 있도록 모든 식량은 유통기한을 늘려 놓았습니다",
    "effect": "급식자리 영구 지정 및 \n우주식량 2개 획득",
    "durationDays": null,
    "sourceSlide": 2,
    "sourceIndex": 5,
    "sourceText": "\n우주 전용 식량\n\n우주에서 소비할 수 있도록 모든 식량은 유통기한을 늘려 놓았습니다\n\n\n급식자리 영구 지정 및 \n우주식량 2개 획득\n\n",
    "automatic": [
      "우주 식량 2개 지급"
    ],
    "manual": [
      "급식 자리 영구 지정은 선생님이 확인해요."
    ]
  },
  {
    "id": "polaris",
    "name": "북극성",
    "description": "북극성은 항상 일정한 위치, 머리 위에서 밝게 \n빛나고 있는 별입니다",
    "effect": "일주일동안 매일 별 1개를 \n받고 일주일동안 경고를 \n하나도 받지 않는다면 \n마지막 날에 별을 추가로 \n1개 더 받습니다",
    "durationDays": 7,
    "sourceSlide": 2,
    "sourceIndex": 6,
    "sourceText": "\n북극성\n\n북극성은 항상 일정한 위치, 머리 위에서 밝게 \n빛나고 있는 별입니다\n\n\n일주일동안 매일 별 1개를 \n받고 일주일동안 경고를 \n하나도 받지 않는다면 \n마지막 날에 별을 추가로 \n1개 더 받습니다 \n",
    "automatic": [],
    "manual": [
      "매일 별 1개 및 무경고 추가 보상은 자동 지급하지 않아요. 선생님이 7일간 확인하여 지급해요."
    ]
  },
  {
    "id": "black-hole",
    "name": "블랙홀",
    "description": "모든 것을 흡수하는 \n빛조차도 빠져나올 수 없는 미지의 공간입니다",
    "effect": "모든 부서의 경고와 검은 별을 흡수하여 삭제합니다",
    "durationDays": null,
    "sourceSlide": 3,
    "sourceIndex": 1,
    "sourceText": "\n블랙홀\n\n모든 것을 흡수하는 \n빛조차도 빠져나올 수 없는 미지의 공간입니다 \n\n\n모든 부서의 경고와 검은 별을 흡수하여 삭제합니다 \n",
    "automatic": [
      "모든 부서 경고와 모든 학생 검은별 해제"
    ],
    "manual": []
  },
  {
    "id": "sunlight",
    "name": "따스한 햇살",
    "description": "태양의 따사로운 햇살이 \n모두를 비추고 있습니다",
    "effect": "세명의 친구를 선정하여 \n이름을 적습니다. 첫날 \n모두에게 별을 하나씩 \n주고 3일 동안 랜덤한 한  \n명에게 별을 줍니다",
    "durationDays": null,
    "sourceSlide": 3,
    "sourceIndex": 2,
    "sourceText": "\n따스한 햇살\n\n태양의 따사로운 햇살이 \n모두를 비추고 있습니다\n\n\n세명의 친구를 선정하여 \n이름을 적습니다. 첫날 \n모두에게 별을 하나씩 \n주고 3일 동안 랜덤한 한  \n명에게 별을 줍니다 \n\n",
    "automatic": [],
    "manual": [
      "세 친구 선정과 첫날·3일간 보상은 선생님이 확인하여 지급해요. 자동 대상 선정이나 예약 지급은 하지 않아요."
    ]
  },
  {
    "id": "big-bang",
    "name": "빅뱅",
    "description": "우주의 시작은 빅뱅이라는 \n폭발에서 시작합니다",
    "effect": "원하는 수업 시간 하나를 \n의논하여 자신이 원하는 \n수업을 교체합니다",
    "durationDays": null,
    "sourceSlide": 3,
    "sourceIndex": 3,
    "sourceText": "\n빅뱅\n\n우주의 시작은 빅뱅이라는 \n폭발에서 시작합니다\n\n\n원하는 수업 시간 하나를 \n의논하여 자신이 원하는 \n수업을 교체합니다",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "launch",
    "name": "우주선 발사",
    "description": "새로운 행성들을 탐사하기 위해 세계에서는 우주선을 보내고 있습니다",
    "effect": "앞 친구와 뒤 친구를 \n지정한 상태로 1주일 동안\n고정된 급식자리를 \n선정합니다",
    "durationDays": 7,
    "sourceSlide": 3,
    "sourceIndex": 4,
    "sourceText": "\n우주선 발사\n\n새로운 행성들을 탐사하기 위해 세계에서는 우주선을 보내고 있습니다\n\n\n앞 친구와 뒤 친구를 \n지정한 상태로 1주일 동안\n고정된 급식자리를 \n선정합니다\n",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "event-horizon",
    "name": "사건의 지평선",
    "description": "외부와 내부과 완전히 \n단절되는 블랙홀의 \n경계선입니다",
    "effect": "사용중인 아이템들을 최대 5개까지 흡수합니다. \n아이템은 모두 삭제되며 \n그 가치만큼 나와 주인이 \n별을 나눠 가집니다",
    "durationDays": null,
    "sourceSlide": 3,
    "sourceIndex": 5,
    "sourceText": "\n사건의 지평선\n\n외부와 내부과 완전히 \n단절되는 블랙홀의 \n경계선입니다\n\n\n사용중인 아이템들을 최대 5개까지 흡수합니다. \n아이템은 모두 삭제되며 \n그 가치만큼 나와 주인이 \n별을 나눠 가집니다\n\n",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "moon-life",
    "name": "달에 사는 생명체",
    "description": "우리가 볼 수 없는 달의 \n뒷면에는 생명체가 살고 \n있다는 소문이 있습니다",
    "effect": "달 카드, 달토끼 카드, \n꼬마 달 카드, 외계인 카드, \n우주인 카드를 뒷면으로 \n2개를 골라 가집니다",
    "durationDays": null,
    "sourceSlide": 3,
    "sourceIndex": 6,
    "sourceText": "\n달에 사는 생명체\n\n우리가 볼 수 없는 달의 \n뒷면에는 생명체가 살고 \n있다는 소문이 있습니다\n\n\n달 카드, 달토끼 카드, \n꼬마 달 카드, 외계인 카드, \n우주인 카드를 뒷면으로 \n2개를 골라 가집니다\n",
    "automatic": [
      "5종 중 서로 다른 카드 2개 무작위 지급"
    ],
    "manual": []
  },
  {
    "id": "sun-and-moon",
    "name": "해와 달",
    "description": "한 때는 해와 달을 하나 \n세트로 낮과 밤의 지배로 \n보았습니다",
    "effect": "남과 여를 선택하여 급식 \n및 종례 우선 순서를 \n부여합니다",
    "durationDays": null,
    "sourceSlide": 4,
    "sourceIndex": 1,
    "sourceText": "\n해와 달\n\n한 때는 해와 달을 하나 \n세트로 낮과 밤의 지배로 \n보았습니다\n\n\n남과 여를 선택하여 급식 \n및 종례 우선 순서를 \n부여합니다 \n",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "wormhole",
    "name": "웜홀",
    "description": "우주에서 공간끼리 \n연결되어 순식간에 이동할 수 곳이 있다고 합니다",
    "effect": "1주일 동안 매일 원하는 \n자리로 자유롭게 위치를 \n이동할 수 있습니다 \n위치 이동에 대한 도움\n\n은 직접 주어야 합니다",
    "durationDays": 7,
    "sourceSlide": 4,
    "sourceIndex": 2,
    "sourceText": "\n웜홀\n\n우주에서 공간끼리 \n연결되어 순식간에 이동할 수 곳이 있다고 합니다\n\n\n1주일 동안 매일 원하는 \n자리로 자유롭게 위치를 \n이동할 수 있습니다 \n위치 이동에 대한 도움\n\n은 직접 주어야 합니다\n",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "asteroid-collision",
    "name": "소행성 충돌",
    "description": "우주 공간 속에서 떠돌아 다니는 소행성 파편은 \n꽤나 위험할 수 있으므로 \n조심해야 합니다",
    "effect": "소행성 카드를 1장 받고 왼쪽 오른쪽 고개 피하기를 진행합니다\n피한 횟수만큼 운석 \n파편 카드를 받습니다",
    "durationDays": null,
    "sourceSlide": 4,
    "sourceIndex": 3,
    "sourceText": "\n소행성 충돌\n\n우주 공간 속에서 떠돌아 다니는 소행성 파편은 \n꽤나 위험할 수 있으므로 \n조심해야 합니다\n\n\n소행성 카드를 1장 받고 왼쪽 오른쪽 고개 피하기를 진행합니다\n피한 횟수만큼 운석 \n파편 카드를 받습니다 ",
    "automatic": [
      "소행성 카드 1개 지급"
    ],
    "manual": [
      "고개 피하기 진행과 피한 횟수만큼 운석 파편 지급은 선생님이 확인해요."
    ]
  },
  {
    "id": "our-galaxy",
    "name": "우리 은하",
    "description": "태양계 행성들을 모두 \n포함한 나선형 모양의 \n은하입니다",
    "effect": "은하수 하나를 분해하고 지정한만큼의 친구들에게 별을 1개씩 나누어 줍니다\n나누어 준 만큼의 날 뒤에 은하단을 받습니다",
    "durationDays": null,
    "sourceSlide": 4,
    "sourceIndex": 4,
    "sourceText": "\n우리 은하\n\n태양계 행성들을 모두 \n포함한 나선형 모양의 \n은하입니다 \n\n\n은하수 하나를 분해하고 지정한만큼의 친구들에게 별을 1개씩 나누어 줍니다\n나누어 준 만큼의 날 뒤에 은하단을 받습니다\n\n\n\n\n",
    "automatic": [],
    "manual": [
      "은하수 분해, 친구별 별 지급, 은하단 보상은 선생님이 확인해요. 미등록 상위 아이템은 자동 생성하지 않아요."
    ]
  },
  {
    "id": "zodiac",
    "name": "황도 12궁",
    "description": "수많은 별자리 중 \n대표적인 별자리 12개를 \n모아 황도 12궁이라고 \n부릅니다",
    "effect": "별자리를 최대 제한을 \n무시하고 별자리를 \n교체하거나 주사위*3\n(최대10) 만큼의 경험치를 \n획득합니다",
    "durationDays": null,
    "sourceSlide": 4,
    "sourceIndex": 5,
    "sourceText": "\n황도 12궁\n\n수많은 별자리 중 \n대표적인 별자리 12개를 \n모아 황도 12궁이라고 \n부릅니다 \n\n\n별자리를 최대 제한을 \n무시하고 별자리를 \n교체하거나 주사위*3\n(최대10) 만큼의 경험치를 \n획득합니다",
    "automatic": [],
    "manual": [
      "별자리 교체 또는 주사위 × 3(최대 10) 경험치 중 원하는 효과를 선택하고 선생님이 확인해요. 선택 전에는 별자리·경험치·별 파편을 자동 변경하지 않아요."
    ]
  },
  {
    "id": "light-speed",
    "name": "빛의 속도",
    "description": "가장 빠른 속도로 알려져 \n있습니다 또한 빛의 \n속도로 움직인다면 시간이 \n정지된 것처럼 보인다고 합니다",
    "effect": "현재 모든 과제들의 마감 \n기한이 다음주로 연장되며 \n이번주에 낼 경우 과제당 \n별 1개를 받습니다",
    "durationDays": null,
    "sourceSlide": 4,
    "sourceIndex": 6,
    "sourceText": "\n빛의 속도\n\n가장 빠른 속도로 알려져 \n있습니다 또한 빛의 \n속도로 움직인다면 시간이 \n정지된 것처럼 보인다고 합니다\n\n현재 모든 과제들의 마감 \n기한이 다음주로 연장되며 \n이번주에 낼 경우 과제당 \n별 1개를 받습니다\n",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "mercury",
    "name": "수성",
    "description": "태양계 행성 중 가장 \n작으며 대기가 없어 \n고요한 행성입니다",
    "effect": "하루동안 모든 과제를 \n면제 받습니다 다만 면제 \n받은 과제를 내는 것은  \n자율입니다",
    "durationDays": 1,
    "sourceSlide": 5,
    "sourceIndex": 1,
    "sourceText": "\n수성\n\n태양계 행성 중 가장 \n작으며 대기가 없어 \n고요한 행성입니다\n\n\n하루동안 모든 과제를 \n면제 받습니다 다만 면제 \n받은 과제를 내는 것은  \n자율입니다\n",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "venus",
    "name": "금성",
    "description": "가장 두꺼운 대기를 \n가지고 있으며 그로 인해 \n높은 온도를 지닌 금빛 \n행성입니다",
    "effect": "친구를 도와주거나 교실을 \n이롭게 하는 행동을 할 \n때마다 별 1개씩\n(최대 8)를 받습니다.",
    "durationDays": null,
    "sourceSlide": 5,
    "sourceIndex": 2,
    "sourceText": "\n금성\n\n가장 두꺼운 대기를 \n가지고 있으며 그로 인해 \n높은 온도를 지닌 금빛 \n행성입니다\n\n\n친구를 도와주거나 교실을 \n이롭게 하는 행동을 할 \n때마다 별 1개씩\n(최대 8)를 받습니다.",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "earth",
    "name": "지구",
    "description": "태양계 행성 중 생명체가 살고 있는 유일한 \n행성입니다",
    "effect": "우주복 카드 1개, 우주식량 \n카드 1개, 인공 위성 카드 \n1개, 우주선 카드 1개중 \n뒷면으로 3개를 선택하여 \n받습니다",
    "durationDays": null,
    "sourceSlide": 5,
    "sourceIndex": 3,
    "sourceText": "\n지구\n\n태양계 행성 중 생명체가 살고 있는 유일한 \n행성입니다\n\n\n우주복 카드 1개, 우주식량 \n카드 1개, 인공 위성 카드 \n1개, 우주선 카드 1개중 \n뒷면으로 3개를 선택하여 \n받습니다",
    "automatic": [
      "4종 중 서로 다른 카드 3개 무작위 지급"
    ],
    "manual": []
  },
  {
    "id": "mars",
    "name": "화성",
    "description": "과거에 생명체가 \n살았을 것이라 예상되며 \n지구인들이 거주할 새 \n행성으로 논의되고 \n있습니다",
    "effect": "3명의 친구와 \n가위바위보를 하여 내가 \n이길 경우 외계인 카드를 \n받고 질 경우 상대방에게 \n외계인 카드를 줍니다",
    "durationDays": null,
    "sourceSlide": 5,
    "sourceIndex": 4,
    "sourceText": "\n화성\n\n과거에 생명체가 \n살았을 것이라 예상되며 \n지구인들이 거주할 새 \n행성으로 논의되고 \n있습니다\n\n3명의 친구와 \n가위바위보를 하여 내가 \n이길 경우 외계인 카드를 \n받고 질 경우 상대방에게 \n외계인 카드를 줍니다 \n\n",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "jupiter",
    "name": "목성",
    "description": "태양계에서 가장 큰 \n크기를 가지고 있는 \n행성입니다",
    "effect": "사용한 날에 별을 받는 \n모든 효과가 두배가 \n됩니다\n즉시 효과를 받는 카드는 \n대상에서 제외됩니다",
    "durationDays": 1,
    "sourceSlide": 5,
    "sourceIndex": 5,
    "sourceText": "\n목성\n\n태양계에서 가장 큰 \n크기를 가지고 있는 \n행성입니다\n\n\n사용한 날에 별을 받는 \n모든 효과가 두배가 \n됩니다\n즉시 효과를 받는 카드는 \n대상에서 제외됩니다\n",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "saturn",
    "name": "토성",
    "description": "고리를 가지고 있으며 \n크기는 작지 않지만 \n가볍다고 알려져 있습니다",
    "effect": "아이템 당 한번씩의 반값 \n할인 기회를 생성합니다\n소수점은 내림처리",
    "durationDays": null,
    "sourceSlide": 5,
    "sourceIndex": 6,
    "sourceText": "\n토성\n\n고리를 가지고 있으며 \n크기는 작지 않지만 \n가볍다고 알려져 있습니다\n\n\n아이템 당 한번씩의 반값 \n할인 기회를 생성합니다\n소수점은 내림처리 \n",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "uranus",
    "name": "천왕성",
    "description": "다른 행성과는 다르게 누워서 태양을 돌고 있는 행성입니다",
    "effect": "급식 순서를 하루동안 \n역순으로 변경하며 자신의 \n경고는 실적으로 검은 별은 \n일반별로 교체하여 \n얻습니다",
    "durationDays": 1,
    "sourceSlide": 6,
    "sourceIndex": 1,
    "sourceText": "\n천왕성\n\n다른 행성과는 다르게 누워서 태양을 돌고 있는 행성입니다\n\n\n급식 순서를 하루동안 \n역순으로 변경하며 자신의 \n경고는 실적으로 검은 별은 \n일반별로 교체하여 \n얻습니다 \n",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "neptune",
    "name": "해왕성",
    "description": "푸른 바다와 같은 색깔을 \n가지며 큰 크기를 가지고 \n있는 행성입니다",
    "effect": "사용중인 아이템(즉시 \n효과를 가진)들의 효과를 \n복사하여 저장합니다\n복사한 효과는 하루에 1개 \n이상 사용하여야 합니다",
    "durationDays": null,
    "sourceSlide": 6,
    "sourceIndex": 2,
    "sourceText": "\n해왕성\n\n푸른 바다와 같은 색깔을 \n가지며 큰 크기를 가지고 \n있는 행성입니다\n\n\n사용중인 아이템(즉시 \n효과를 가진)들의 효과를 \n복사하여 저장합니다\n복사한 효과는 하루에 1개 \n이상 사용하여야 합니다",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "pluto",
    "name": "명왕성",
    "description": "태양계 행성에서 \n탈락되어 지금은 쓸쓸히 \n존재하는 작은 행성입니다",
    "effect": "독립된 자리를 구성하여\n앉을 수 있습니다\n또한 사용한 날 자신만 \n아이템을 사용할 수 \n있습니다",
    "durationDays": 1,
    "sourceSlide": 6,
    "sourceIndex": 3,
    "sourceText": "\n명왕성\n\n태양계 행성에서 \n탈락되어 지금은 쓸쓸히 \n존재하는 작은 행성입니다\n\n\n독립된 자리를 구성하여\n앉을 수 있습니다\n또한 사용한 날 자신만 \n아이템을 사용할 수 \n있습니다",
    "automatic": [],
    "manual": [
      "효과 적용과 완료 여부는 선생님이 확인해요. 이 효과는 자동 처리하지 않아요."
    ]
  },
  {
    "id": "planet-exploration",
    "name": "행성 탐험",
    "description": "우리는 미래를 위해 \n새로운 행성들을 탐험해야 \n합니다.",
    "effect": "1~10까지 숫자로 \n랜덤하게 뽑아 해당하는 \n행성 카드를 받습니다 \n10을 뽑게 될 경우 은하수 \n카드를 1장 받습니다",
    "durationDays": null,
    "sourceSlide": 6,
    "sourceIndex": 4,
    "sourceText": "\n행성 탐험\n\n우리는 미래를 위해 \n새로운 행성들을 탐험해야 \n합니다. \n\n\n1~10까지 숫자로 \n랜덤하게 뽑아 해당하는 \n행성 카드를 받습니다 \n10을 뽑게 될 경우 은하수 \n카드를 1장 받습니다\n\n",
    "automatic": [
      "1~10 무작위 추첨: 행성 카드 또는 은하수 지급"
    ],
    "manual": []
  },
  {
    "id": "cosmic-evolution",
    "name": "우주의 진화",
    "description": "아무것도 없던 우주의 \n공간에서부터 수많은 \n별들이 생성되고 새로운 \n기술들이 발견되고 \n있습니다",
    "effect": "자신이 가지고 있는 \n아이템 2가지를 다음 \n단계로 업그레이드 \n시킵니다\n은하 카드는 대상에서 \n제외됩니다",
    "durationDays": null,
    "sourceSlide": 6,
    "sourceIndex": 5,
    "sourceText": "\n우주의 진화\n\n아무것도 없던 우주의 \n공간에서부터 수많은 \n별들이 생성되고 새로운 \n기술들이 발견되고 \n있습니다\n\n자신이 가지고 있는 \n아이템 2가지를 다음 \n단계로 업그레이드 \n시킵니다\n은하 카드는 대상에서 \n제외됩니다\n",
    "automatic": [],
    "manual": [
      "업그레이드 대상 2개와 상위 아이템은 선생님이 확인해요. 자동 업그레이드하지 않아요."
    ]
  },
  {
    "id": "telescope",
    "name": "천체 망원경",
    "description": "다양한 행성들과 별 \n은하를 찾기 위해 \n인간들은 천체 망원경을 \n개발하여 관측하고 \n있습니다",
    "effect": "상위 아이템의 조합법을 \n알 수 있습니다 또한 \n조합과 관련된 아이템 \n카드를 몇 개 받습니다",
    "durationDays": null,
    "sourceSlide": 6,
    "sourceIndex": 6,
    "sourceText": "\n천체 망원경\n\n다양한 행성들과 별 \n은하를 찾기 위해 \n인간들은 천체 망원경을 \n개발하여 관측하고 \n있습니다\n\n\n상위 아이템의 조합법을 \n알 수 있습니다 또한 \n조합과 관련된 아이템 \n카드를 몇 개 받습니다 ",
    "automatic": [],
    "manual": [
      "공개할 조합법과 지급할 재료 종류·수량은 선생님이 확인해요. 비밀 조합법을 자동 공개하지 않아요."
    ]
  }
].map(card=>Object.freeze({...card,automatic:Object.freeze(card.automatic),manual:Object.freeze(card.manual)})));
export const starCardOf = id => STAR_CARD_CATALOG.find(card=>card.id===id)||null;
export const goldItemIdOf = cardId => starCardOf(cardId) ? 'gold-'+cardId+'-card' : null;
export const GOLD_CARD_ITEMS = Object.freeze(STAR_CARD_CATALOG.map(card=>Object.freeze({
  id:goldItemIdOf(card.id),cardId:card.id,name:card.name,description:card.description,
  special:card.effect,art:STAR_CARD_ART.face,icon:'✦',type:'card',level:1,price:0,sellPrice:null,
  forSale:false,usable:true,targets:'self',secret:false,mode:'star-card',
  effect:Object.freeze({label:card.name,icon:'✦',durationMs:0,style:'card'})
})));
