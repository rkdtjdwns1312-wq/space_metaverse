import {equipmentOf,equipmentStatText} from '/shared/equipment.js';

export const PATCH_QUESTIONS=[
  {id:'enhance-start',topic:'craft',title:'장비 강화는 어떻게 하나요?',keywords:['강화','보스','강화하기','반지','귀걸이','목걸이','망토','보석','인장','팔찌'],text:'별빛 조합기에서 위쪽 강화하기를 눌러요. 보스 재료로 만든 장비를 더 강하게 만들 수 있어요.',steps:['강화할 장비를 가방에 넣어요. 장착 중이면 먼저 내정보에서 해제해요.','장비와 그 장비에 맞는 보스 재료 1개를 선택해요. 불타는 얼음목걸이는 레오온의 갈퀴 또는 노크세라의 뿔 중 하나를 골라요.','다음 단계의 효과와 성공 확률을 확인하고 강화하기를 눌러요. 성공한 장비는 다시 장착해요.'],note:'같은 장비가 여러 개 있어도 선택한 단계의 장비 1개만 강화돼요. 장착하고 있는 다른 장비는 바뀌지 않아요.'},
  {id:'enhance-failure',topic:'craft',title:'강화에 실패하면 장비가 사라지나요?',keywords:['강화','실패','확률','재료','단계','파괴'],text:'장비는 사라지지 않고 강화 단계도 내려가지 않아요. 성공하거나 실패할 때마다 보스 재료 1개만 사용해요. 강화에는 별 파편이나 우주에너지 비용이 없어요.',steps:['+1은 100%, +2는 90%, +3은 80%예요.','그다음부터 10%씩 줄어 +4는 70%, +5는 60%, +6은 50%, +7은 40%, +8은 30%, +9는 20%예요.','최고 단계는 +9예요. 강화를 하는 중 연결이 끊겼다면 다시 확인을 눌러 가방과 결과를 확인해요.']},
  {id:'shop-fixed-heading',topic:'shop',title:'상점 제목과 닫기 버튼은 어디에 있나요?',keywords:['상점','닫기','스크롤','이용방법'],text:'별상점과 우주에너지 상점은 위에 제목·이용 방법·닫기가 있어요. 아래 내용만 스크롤되므로 언제든 오른쪽 위 닫기를 누를 수 있어요. 우주에너지 상점은 장비 효과를 간단히 보여 주고, 자세한 정보는 가방의 정보보기에서 확인해요.'},
  {id:'report-edit',topic:'department',title:'제출한 부서실적을 고칠 수 있나요?',keywords:['실적','수정','제출','보고서','새로보기'],text:'선생님이 보상을 지급하기 전인 제출 상태의 실적은 고칠 수 있어요. 부서실적 작성하기에서 새로 보기 오른쪽 수정하기를 누르고, 내용을 고친 뒤 수정 제출하기를 눌러요. 부원은 부서 안 실적 작성표 가까이에서 사용할 수 있고 선생님도 수정할 수 있어요. 이미 보상을 지급한 실적은 이 버튼으로 고치지 않아요.'},
  {id:'teacher-ability-release',topic:'items',title:'사용 중인 별 능력을 선생님이 해제할 수 있나요?',keywords:['선생님','해제','별능력','칭찬','마비','수면'],text:'선생님은 별 능력 기둥의 사용 중인 별 능력 목록에서 해당 효과의 해제를 누르고 확인할 수 있어요. 효과만 끝나며 이미 쓴 주간 능력 횟수나 받은 보상이 되돌아오지는 않아요.'},
  {id:'card-end-confirm',topic:'items',title:'선생님 확인 후 별카드 종료는 어떻게 하나요?',keywords:['별카드','종료','선생님확인','예','아니오'],text:'선생님 확인 후 종료를 누르면 별도 확인 창이 열려요. 예를 누르면 카드를 종료하고, 아니오를 누르면 카드를 그대로 둬요.'},
  {id:'chat-new-mark',topic:'friends',title:'채팅창 열기의 NEW는 무엇인가요?',keywords:['new','새채팅','새메시지','채팅창'],text:'읽지 않은 새 채팅이 오면 왼쪽 위 채팅창 열기에도 작은 new가 떠요. 채팅창을 열어서 확인하면 표시가 사라져요.'},
  {id:'audio-volume',topic:'safety',title:'소리를 조금만 줄이고 싶어요',keywords:['음량','소리','음소거','볼륨'],text:'소리 설정에서 막대를 움직이고 옆의 %를 확인해요. 맨 왼쪽 0%는 소리가 나지 않고 1%부터 조금씩 커져요. 음소거 버튼으로 잠깐 끄거나 다시 켤 수도 있어요.'},
  ...['sun-ring','moon-earring','burning-ice-necklace','spirit-king-cloak','primordial-star-gem','primordial-star-sigil','truth-record','infinite-star-bracelet','truth-convergence'].map(id=>{
    const item=equipmentOf(id);
    return {id:'enhance-'+id,topic:'craft',title:item.name+'의 효과와 강화',keywords:['강화','장비','효과',item.name],text:'기본 효과: '+equipmentStatText(item),steps:[3,6,9].map(stage=>'+'+stage+'의 전체 효과: '+equipmentStatText(equipmentOf(id+'+'+stage))),note:'각 단계의 표시는 기본 효과에 강화 보너스를 합친 수치예요. 강화 창에서는 바로 다음 단계의 효과도 확인할 수 있어요.'};
  })
];
