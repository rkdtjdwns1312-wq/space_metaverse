import {mapOf,planetIdOfMap} from '/shared/config.js';
import {STUDENT_QUESTIONS,POPULAR_QUESTIONS} from './student-help-data.js';
import {searchHelp} from './help-search.js';
import {PATCH_QUESTIONS} from './patch-help-data.js';

export const HELP_TOPICS=[
  {id:'cozy',title:'돌보기와 꾸미기',entries:[['아기별 돌보기','쉼터의 아기별 돌봄집에서 시작하기를 누르고 아기별 종류·이름·장식을 골라요. 마을 위 성장 이야기를 읽고 확인을 누른 뒤, 원하는 시설을 눌러 두 방법 중 하나를 선택해요. 12번의 교육·놀이와 이야기 선택으로 아기별을 키우면 16가지 성향과 48가지 직업 결말 중 하나를 만나요. 약 5~10분이며 닫았다 다시 이어갈 수 있어요. 결말을 모으고 장식을 열어보세요. 실제 나의 성격 검사나 진로 추천은 아니에요.'],['별방 꾸미기','달빛·구름·책 읽는 방의 그림을 고른 뒤, 30가지 가구를 누르면 방 가운데 놓여요. 끌어서 원하는 곳에 놓을 수도 있어요. 가구 위 단추로 색·방향을 바꾸고 모서리를 끌어 크기를 조절해요. 저장 버튼을 누르면 다음에도 이어 꾸며요. 서로 다른 가구 3개 이상을 저장하면 하루 한 번 보상을 받아요.'],['우주 식물 가꾸기','씨앗 3개를 표시된 자리에 간격을 맞춰 심고, 화살표 8번으로 햇빛을 주세요. 물 주기를 꾹 눌렀다가 3.5초 표시선에서 손을 떼세요. 세 과정의 점수로 아주 좋음·좋음·보통·나쁨·아주 나쁨 등급이 정해져요. 하루 첫 세 수확은 등급·레벨에 따른 우주에너지를 주고, 등급별 꽃은 계속 모을 수 있어요.'],['각자 즐기는 세 가지 활동','세 활동은 서로 연결된 재료나 진행 조건이 없어요. 원하는 것만 해도 돼요. 레벨에 따라 각 활동의 하루 최대 보상은 Lv1 30, Lv2 90, Lv3 300, Lv4 750, Lv5 1200이에요. 한국시간 자정에 보상 기회가 다시 열려요. 선생님·마스터 계정은 보상 없는 체험이에요.']]},

  {id:'start',title:'이동과 조작',entries:[['우주 교실 시작하기','키보드 WASD·방향키 또는 화면 조이스틱으로 움직여요. 물체 가까이 가서 화면에 표시된 상호작용 키나 조사하기 버튼을 누르면 이용할 수 있어요.'],['지도와 빠른 이동','오른쪽 위 지도에서 전체 우주 지도를 열어요. 가고 싶은 맵을 빠르게 두 번 누른 뒤 이동 확인에서 예를 선택해요. 레벨·상태에 따라 갈 수 없는 곳도 있어요.'],['첫 여행 미션','메뉴의 첫 여행 안내 다시 보기에서 사용 방법을 차례로 연습할 수 있어요. 안내만 닫아도 진행 내용은 유지돼요.']]},
  {id:'class',title:'알림장·시간표·과제',entries:[['오늘의 알림장','별의 기원에서 알림장 기둥을 조사해요. 선생님이 과제로 표시한 항목의 과제로 가져오기를 누르면 내 과제에 추가돼요.'],['과제 완료하기','아래 과제 버튼에서 할 일을 확인해요. 과제별서고에서 해당 주와 과제를 골라 제출을 눌러요. 선생님이 확인하면 완료돼요. 과제별서고에서는 최근 3주의 과제와 완료한 친구들을 볼 수 있어요.'],['오늘의 시간표','시간표 기둥에는 월요일부터 금요일, 1~6교시가 있어요. 과목은 선생님이 적어요.']]},
  {id:'mission',title:'미션과 보상',entries:[['미션 받기','별의 기원의 별 미션 게시판에서 미션을 받아요. 선생님이 모두에게 나누어 준 미션도 있어요.'],['달성과 완료','소통 → 미션 확인하기에서 조건과 진행 상황을 봐요. 자동미션은 게임 행동으로 달성하고 일반 미션은 선생님이 확인해요. 조건을 달성한 뒤 완료 버튼을 눌러 보상을 받아요.'],['마감 확인','미션에는 선착순·유효기간·매일 반복 조건이 있을 수 있어요. 완료하기 전에 보상과 마감 안내를 확인해요.']]},
  {id:'avatar',title:'성장과 별자리',entries:[['경험치 구매와 진화','은하수계곡의 성장의 별에서 별 파편으로 경험치를 사요. 경험치가 가득 차면 진화의 별로 가서 다음 단계로 진화해요. 경험치 구매만으로 자동 진화하지 않아요.'],['내 정보','내정보에서 레벨, 경험치, 체력·마나와 장비, 현재 상태를 볼 수 있어요. LV2부터 별자리 캐릭터를 만나고 계열에 따라 특징이 달라요.'],['별자리 능력과 전투 스킬','내정보의 별자리 능력은 교실 활동과 연결돼요. 사용 조건과 남은 횟수는 각 능력 설명을 확인해요. 기본공격·전투 스킬과 주간 능력은 서로 달라요.']]},
  {id:'items',title:'가방과 아이템',entries:[['아이템 사용','가방에서 아이템을 고른 뒤 설명과 대상을 확인하고 사용해요. 사용 중인 아이템 기둥에서 누구에게 효과가 적용되는지 볼 수 있어요.'],['현실 교실 활동','많은 아이템은 게임 안의 숫자 대신 현실 교실에서 선생님이 진행해요. 사용 내역을 확인한 선생님이 처리 완료해요. 일부 카드는 실제 게임 상태를 바꿔요.'],['상태 확인','머리 위나 하단 상태 아이콘을 눌러 효과와 남은 시간을 확인해요. 자외선·마비 등으로 아이템 사용이 제한될 수 있어요.']]},
  {id:'shop',title:'상점과 자원',entries:[['별 상점','오색별빛 쉼터의 별 상점에서 별 파편으로 아이템을 사거나 보유한 물건을 팔아요. 구매 가능한 레벨과 아이템은 상점에서 확인해요.'],['우주에너지 상점','몬스터를 물리치고 모은 우주에너지로 장비를 사요. 가방에서 장비 → 장착하기 → 칸을 골라요. 내정보에서는 장비를 확인하거나 해제해요. 조합 전용 장비도 있어요.'],['하루 한 번 능력치 구매','Lv2부터 우주에너지 상점에서 계정당 하루 한 번 영구 능력치를 구매해요. 비용은 Lv2 20개, Lv3 60개, Lv4 140개, Lv5 300개예요. 현재 레벨의 능력치별 증가량과 확률은 상점에서 확인해요. 누적 능력치는 보존되고, 진화해도 당일에는 다시 구매할 수 없어요. 한국시간 자정에 다시 열려요.']]},
  {id:'craft',title:'조합과 조합법',entries:[['재료로 조합하기','오색별빛 쉼터의 별빛 조합기에서 재료와 수량을 골라요. 조합법을 미리 배워야만 성공하는 것은 아니에요. 올바른 재료와 필요한 비용을 준비해요.'],['나만의 조합법 모으기','조합에 성공하면 그 조합법이 내 조합레시피에 자동 등록돼요. 조합법 아이템을 가방에서 사용해도 등록할 수 있어요. 이미 알고 있는 조합법은 중복 사용 안내를 확인해요.'],['조합법 확인','가방의 조합레시피 버튼에서 배운 재료 조합을 볼 수 있어요. 조합 결과와 재료 소비 안내를 꼭 확인하고 시도해요.']]},
  {id:'department',title:'부서행성',entries:[['우리 반 역할','별의 기원의 부서행성은 친구들과 함께 맡는 학급 역할이에요. 행성 정보에서 소개·규칙·멤버를 보고 가입을 신청할 수 있어요.'],['실적과 내부 꾸미기','부서 내부에서 게시판 옆 실적 기능과 꾸미기 장치를 조사해요. 물체의 모양·색을 바꿀 수 있으며 학생은 필요한 해금 조건을 확인해요.'],['경고와 검은별','경고 제어돌에서 해당 부서의 경고를 기록해요. 정한 수치에 도달하면 검은별 상태로 블랙홀로 이동해요. 친구에게 장난으로 경고를 주지 말고 선생님과 정한 규칙을 지켜요.']]},
  {id:'learning',title:'별 발전소',entries:[['사냥터 시간 충전','발전소는 서로 다른 최대 3곳에서 각 20분, 놀이터는 서로 다른 최대 2곳에서 각 10분을 충전해요. 합계 하루 최대 80분이에요. 놀이터는 게임 완료 시 충전하며, 테트리스·별 피하기는 경기 종료, 우주 신호는 단계 완료, 경쟁 게임은 정상 완료한 두 친구 모두 받아요. 수학·영어는 10문제 중 9개 이상 정답, 교양·역사·과학은 읽음 보상, 예술은 직접 그린 작품 저장으로 충전해요. 시계 아래 시간을 눌러 충전 현황을 봐요. 사냥터에서만 줄며 밤 10시에 남은 시간은 0이 돼요. 시간 만료 시 쉼터로 돌아와요.'],['여섯 가지 배움','쉼터 북쪽에는 수학·영어·역사·과학·교양·예술 발전소가 있어요. 건물에 다가가 조사한 뒤 단계나 주제를 선택해요.'],['문제와 이야기','문제를 풀고 설명을 읽거나 교양 이야기를 감상해요. 학습 보상과 하루 제한은 화면 안내를 확인해요. 학습 활동은 자동미션과 연결될 수 있어요.']]},
  {id:'play',title:'놀이터와 미니게임',entries:[['혼자 도전하기','쉼터 남쪽 놀이터에서 별그림 짝맞추기, 별 찾기, 테트리스, 스도쿠 등 게임기를 조사해요. 각 게임의 시작 화면에서 조작법을 볼 수 있어요.'],['친구와 함께하기','대결형 게임은 상대를 초대하고 수락하면 시작해요. 제한 시간과 차례를 지키며 놀아요. 순위와 보상은 게임별 안내를 확인해요.']]},
  {id:'battle',title:'몬스터와 전투',entries:[['공격과 조준','LV2부터 기본공격과 스킬을 사용할 수 있어요. 기본 키는 Q(공격)·E(스킬)·F(상호작용)이며, 조사하기 오른쪽 톱니바퀴에서 바꿀 수 있어요. 현재 키는 각 버튼에 표시돼요. 데스크탑에서는 게임 화면을 마우스 왼쪽 클릭하면 기본공격, 오른쪽 클릭하면 스킬을 사용해요. 마우스가 가리키는 쪽으로 공격해요. 모바일에서는 캐릭터가 보는 방향을 확인하고 공격 버튼을 눌러요. 학생끼리는 기본공격으로 피해를 주지 않아요.'],['탐험과 보스','낙원과 별의 시작점에는 다양한 몬스터가 있어요. 처치한 보스는 다음 날 오전 7시(한국 시간)에 돌아와요. 세레나는 이 시각에 여신 석상이 돌아오면 다시 소환해요. 공격 예고를 피하고 체력·마나와 스킬 대기시간을 확인해요.'],['잠드는 곳의 석상','별들이 잠드는 곳은 Lv4부터 입장할 수 있어요. 별들이 잠드는 곳 2의 석상에서는 별 기록의 근원(체력 15,000)을, 3의 석상에서는 별자리의 기원(체력 20,000·마나 100)을 소환해요. 석상 가까이에서 조사한 뒤 소환을 선택하세요. 별자리의 기원은 5초마다 조용한 별빛 별탄을 발사해요. 일반공격의 노란별은 최대 세 번 방향을 바꾸니 옆으로 피하세요. 4번 스킬이 켜진 30초 동안은 2.5초마다 색이 무작위로 정해져요. 노란별은 피하고, 파란별은 몸으로 받으면 피해 없이 사라져요. 놓친 파란별 하나마다 같은 맵의 전투 참여자 모두가 보스 공격력의 200% 피해를 받아요. 검은 점이 있는 연노란 구체별을 띄우면 점이 1개인 별부터 5개인 별까지 순서대로 가까이 가서 조사해요. 같은 맵의 친구들과 15초 안에 연결하세요. 패턴 ‘별의 힘을 모아’가 시작되면 20초 동안 작은 흰 별을 F 또는 모바일 상호작용으로 주워요. 흰 별은 나타난 뒤 5초 안에 주워야 해요. 놓친 별 하나마다 같은 맵의 전투 참여자 모두가 보스 공격력의 100% 피해를 받아요. 별을 주울 때마다 내 체력이 100% 회복돼요.'],['회복과 전리품','체력이 다하면 회복 안내를 기다려요. 떨어진 우주에너지나 재료는 가까이 가서 조사해요. 파티에서는 분배 규칙을 확인해요.']]},
  {id:'friends',title:'친구·채팅·파티',entries:[['소통 메뉴','소통에서 친구 보기와 채팅을 열 수 있어요. 전체·부서·귓속말 중 누구에게 보내는지 확인하고 대화해요.'],['함께 모험하기','친구 목록에서 초대·부르기·파티 기능을 이용해요. 상대가 동의해야 진행되는 활동도 있어요. 친구에게 불편한 말을 하거나 반복해서 요청하지 않아요.']]},
  {id:'special',title:'특별한 공간',entries:[['블랙홀 내부','검은별 상태에서는 블랙홀 밖으로 나갈 수 없어요. 선생님에게 어떤 부서의 경고인지 확인하고 해결해요.'],['고래자리의 배 속','고래자리의 제안을 수락하면 들어갈 수 있는 특별한 공간이에요. 안에서는 함께 있는 친구와 대화할 수 있어요. 혼자 탈출 버튼으로 나갈 수 있지만 안내된 고래자리 효과는 받지 못해요.'],['우주 탐사와 시장','별의 기원의 우주 탐사 장치와 교환 기능에서는 화면 안내에 따라 활동해요. 필요한 탐사권·재료·상대의 동의를 먼저 확인해요.']]},
  {id:'safety',title:'연결·도움 요청',entries:[['연결이 끊겼을 때','가운데 재접속 안내가 나오면 잠시 기다려요. 계속 연결되지 않으면 인터넷을 확인하고 선생님께 알려 주세요. 복구에 실패하면 자신의 교실 코드와 계정으로 다시 입장해요.'],['느릴 때','톱니바퀴 → 화면 품질에서 저사양을 선택하고 저장해요. 자동은 느릴 때 품질을 낮춰요. 중사양은 이동을 부드럽게 유지하며 장식을 줄이고, 고사양은 가장 선명하게 보여요. 친구들이 많이 모였을 때는 같은 창에서 친구 걷기 모션 줄이기를 켜고 저장해 보세요. 이동·공격 속도와 위험 표시는 같아요. 사용하지 않는 브라우저 탭이나 앱을 닫고 연결 상태를 확인해요. 특정 맵·기기에서 반복되면 맵 이름과 당시 활동을 선생님께 알려 주세요.'],['계정 보호','친구의 계정으로 들어가지 말고 비밀번호를 다른 사람에게 알려 주지 않아요. 비밀번호를 잊었다면 선생님에게 재설정을 부탁해요.']]}
];
HELP_TOPICS.find(topic=>topic.id==='battle').entries.push(['별의 힘을 모아','별자리의 기원 보스가 20초 동안 작은 흰 별 15개를 차례로 띄워요. 첫 별은 바로 나타나고, 이후에는 1~2초 간격으로 나타나요. 별은 나타난 뒤 5초 동안 모을 수 있고, F 또는 모바일 상호작용으로 주워요. 주울 때마다 내 체력이 100% 회복돼요. 5초 안에 줍지 못한 별 하나마다 같은 맵의 전투 참여자 모두가 보스 공격력의 100% 피해를 받아요.']);

export function mapGuide(mapId,planets=[]){
  const map=mapOf(mapId,planets);
  let text='주변의 물체 가까이 가서 조사하기로 이곳의 활동을 살펴보세요.';
  if(planetIdOfMap(mapId))text='우리 부서의 규칙·실적을 확인하고 경고 제어돌과 꾸미기 장치를 이용해요.';
  else if(['space-plaza','assignment-archive','star-market','department-plaza'].includes(mapId))text='알림장·시간표·과제·미션을 확인하고 부서행성과 우주 탐사를 이용해요.';
  else if(mapId==='star-station')text='수학·영어·역사·과학·교양·예술 발전소에서 배우고 사냥 시간을 충전해요. 천사 석상에서 회복 버프를 받아요. 북쪽은 별들이 잠드는 곳, 남쪽은 쉼터예요.';
  else if(mapId==='star-playground')text='일곱 오락기와 짝 맞추기·오목 경쟁 게임을 즐겨요. 명예의 전당에서 1등을 확인하고 북쪽 문으로 쉼터에 돌아가요.';
  else if(mapId==='star-street')text='쇼핑·조합·아기별 돌보기·별방 꾸미기·꽃 키우기를 해요. 북쪽 문은 별 발전소, 남쪽 문은 별 놀이터로 이어져요. 공원 분수대에서 5분간 최대 체력과 최대 마나가 10% 늘어나는 별의 수호를 받을 수 있어요.';
  else if(mapId==='milky-valley')text='성장의 별에서 경험치를 사고, 경험치를 채우면 진화의 별에서 진화해요.';
  else if(mapId==='black-hole')text='검은별을 받은 친구들이 머무는 곳이에요. 상태가 해제되어야 나갈 수 있어요.';
  else if(mapId==='whale-stomach')text='함께 들어온 친구와 대화해요. 탈출하면 고래자리의 혜택은 받지 못해요.';
  else if(mapId==='sleeping-stars-4')text='진리의 별 석상을 조사하면 진리의 창조자에게 도전해요. 남겨진 빛의 선과 붉은 추적 구체를 피하고, 노란 구체는 공격해 없애세요.';
  else if(mapId==='sleeping-stars-3')text='위쪽 문으로 별들이 잠드는 곳 4에 갈 수 있어요. 기존 보스 여섯 종류를 직접 전투에 참여해 처치한 기록이 필요해요. 4번 맵은 지도에서 바로 이동할 수 없어요.';
  else if(mapId.startsWith('sleeping-stars-'))text='오색별빛 쉼터 북쪽에서 이어지는 조용한 여행길이에요. 위쪽 문을 지날수록 작은 별빛이 줄어들어요. 아래쪽 문으로 돌아갈 수 있어요.';
  else if(mapId==='star-origin-4')text='별의 여신 석상을 조사하고 조건을 갖추어 세레나에게 도전해요.';
  else if(mapId.startsWith('star-origin-'))text='별자리 몬스터를 만나 전투하고 우주에너지·아이템 재료를 모아 보세요.';
  else if(mapId==='moon-garden')text='귀여운 몬스터를 만나고 태양의 낙원과 달의 낙원으로 탐험을 떠나요.';
  else if(mapId==='star-paradise')text='강력한 별의 몬스터에 도전해요. 동료와 힘을 모으고 공격 예고를 살펴요.';
  else if(mapId.includes('paradise'))text='몬스터의 공격을 피하며 우주에너지와 재료를 모아요. 다음 지역의 문도 찾아보세요.';
  return {name:map.name,text};
}

export function createClassroomHelp({getRoom,getSelfId,stop}){
  const dialog=document.createElement('dialog');dialog.id='classroom-help-dialog';dialog.setAttribute('aria-labelledby','classroom-help-title');
  dialog.innerHTML='<header><h2 id="classroom-help-title" tabindex="-1">별빛 도우미</h2><button type="button" class="secondary" id="classroom-help-find">검색</button></header><div id="help-search-panel" hidden><label for="classroom-help-search">궁금한 내용을 입력해요</label><div class="help-search-row"><input id="classroom-help-search" type="search" maxlength="160" placeholder="예: 숙제는 어떻게 내요?" autocomplete="off"><button id="classroom-help-clear" class="secondary" type="button" hidden>지우기</button></div></div><p id="help-result-status" role="status" aria-live="polite" hidden></p><div id="help-page-body"><nav id="classroom-help-tabs" aria-label="가나다순 도움말 주제"></nav><section id="classroom-help-content" aria-label="도움말" hidden></section></div><footer class="help-page-actions"><button type="button" class="secondary" id="classroom-help-back">돌아가기</button><button type="button" class="secondary" id="classroom-help-close">닫기</button></footer>';
  document.body.append(dialog);
  const tabs=dialog.querySelector('#classroom-help-tabs'),content=dialog.querySelector('#classroom-help-content'),search=dialog.querySelector('input'),body=dialog.querySelector('#help-page-body');
  const heading=dialog.querySelector('h2'),searchPanel=dialog.querySelector('#help-search-panel'),find=dialog.querySelector('#classroom-help-find');
  const answers=[...STUDENT_QUESTIONS,...PATCH_QUESTIONS,...HELP_TOPICS.flatMap(t=>t.entries.map(([title,text],i)=>({id:`guide-${t.id}-${i}`,topic:t.id,title,text})))];
  const categories=[{id:'popular',title:'자주 묻는 질문'},...HELP_TOPICS].sort((a,b)=>a.title.localeCompare(b.title,'ko'));
  const icons={items:'🎒',play:'🎮',cozy:'🌱',battle:'⚔️',mission:'⭐',learning:'📚',department:'🪐',shop:'🛍️',avatar:'🌟',class:'📝',safety:'🛟',start:'🧭',popular:'💬',craft:'🔮',friends:'🤝',special:'🌌'};
  const status=dialog.querySelector('#help-result-status'),clear=dialog.querySelector('#classroom-help-clear');
  let page={kind:'topics'},history=[],returnFocus=null;
  function navigate(next){history.push({...page,scroll:body.scrollTop,focus:document.activeElement?.id});page=next;render();body.scrollTop=0;heading.focus({preventScroll:true});}
  function goBack(){const previous=history.pop();if(!previous){dialog.close();return;}page=previous;render();body.scrollTop=page.scroll||0;const target=document.getElementById(page.focus);(target&&dialog.contains(target)?target:heading).focus({preventScroll:true});}
  function showAnswer(answer){
    const article=document.createElement('article');article.className='help-answer-body';article.dataset.answerId=answer.id;
    const title=document.createElement('h3');title.textContent=answer.title;
    const intro=document.createElement('p');intro.textContent=answer.text;article.append(title,intro);
    if(answer.steps){const steps=document.createElement('ol');for(const step of answer.steps){const li=document.createElement('li');li.textContent=step;steps.append(li);}article.append(steps);}
    if(answer.note){const note=document.createElement('p');note.className='help-note';note.textContent=answer.note;article.append(note);}
    content.append(article);
  }
  function render(){
    dialog.dataset.page=page.kind;
    const home=page.kind==='topics',searching=page.kind==='search',answering=page.kind==='answer';
    tabs.hidden=!home;content.hidden=home;searchPanel.hidden=!searching;status.hidden=!searching;find.hidden=searching||answering;
    tabs.replaceChildren();content.replaceChildren();
    if(home){heading.textContent='별빛 도우미';for(const topic of categories){
      const button=document.createElement('button');button.id='help-tab-'+topic.id;button.type='button';button.className='secondary help-topic';button.setAttribute('aria-label',topic.title);
      const icon=document.createElement('span');icon.className='help-topic-icon';icon.setAttribute('aria-hidden','true');icon.textContent=icons[topic.id]||'✦';
      const title=document.createElement('span');title.textContent=topic.title;button.append(icon,title);button.onclick=()=>navigate({kind:'questions',topic:topic.id});tabs.append(button);
    }return;}
    if(answering){heading.textContent='질문과 답변';showAnswer(answers.find(a=>a.id===page.answerId));return;}
    heading.textContent=searching?'도움말 검색':categories.find(t=>t.id===page.topic)?.title||'질문 목록';
    if(searching){search.value=page.query||'';clear.hidden=!search.value;}
    const results=searching?searchHelp(answers,page.query||''):page.topic==='popular'?POPULAR_QUESTIONS.map(id=>answers.find(a=>a.id===id)).filter(Boolean):answers.filter(a=>a.topic===page.topic);
    status.textContent=searching?(page.query?.trim()?`관련 질문 ${results.length}개`:'단어나 짧은 질문으로 찾아보세요.'):'';
    if(!results.length){const message=document.createElement('p');message.className='help-empty';message.textContent=searching&&!page.query?.trim()?'예: 레벨업, 숙제, 장비 끼기': '맞는 질문을 찾지 못했어요. 다른 단어로 검색해 보세요.';content.append(message);return;}
    const list=document.createElement('div');list.className='help-question-list';
    for(const answer of results){const button=document.createElement('button');button.type='button';button.className='secondary help-question';button.id='help-question-'+answer.id;button.dataset.answerId=answer.id;button.textContent=answer.title;button.onclick=()=>navigate({kind:'answer',answerId:answer.id});list.append(button);}content.append(list);
  }
  search.oninput=()=>{page.query=search.value;render();body.scrollTop=0;};clear.onclick=()=>{page.query='';render();body.scrollTop=0;search.focus();};
  find.onclick=()=>{navigate({kind:'search',query:''});search.focus();};
  dialog.querySelector('#classroom-help-back').onclick=goBack;
  dialog.querySelector('#classroom-help-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{const target=returnFocus?.isConnected?returnFocus:document.getElementById('world');target?.focus();});
  function open(topic=null,opener=document.activeElement){if(!getSelfId())return;stop();returnFocus=opener;page={kind:'topics'};history=[];if(categories.some(t=>t.id===topic)){history.push({kind:'topics',focus:'help-tab-'+topic});page={kind:'questions',topic};}search.value='';render();body.scrollTop=0;if(!dialog.open)dialog.showModal();heading.focus({preventScroll:true});}
  // Help opens above the source dialog; close returns to the same screen without losing its inputs.
  const contextTopics={'inventory-dialog':'items','tasks-dialog':'class','student-missions-dialog':'mission','crafting-dialog':'craft','energy-shop-dialog':'shop','shop-dialog':'shop','assignment-dialog':'class','evolution-dialog':'avatar'};
  document.addEventListener('click',event=>{const button=event.target.closest('[data-student-help]');if(button)open(button.dataset.studentHelp,button);});
  function installContextHelp(){for(const [id,topic] of Object.entries(contextTopics)){
    const host=document.getElementById(id);if(!host||host.querySelector('[data-student-help]'))continue;
    const heading=host.querySelector('h2');if(!heading)continue;
    const row=document.createElement('div');row.className='student-help-row';
    const button=document.createElement('button');button.type='button';button.className='secondary student-help-link';
    button.dataset.studentHelp=topic;button.textContent='이용 방법';button.setAttribute('aria-label',`${heading.textContent} 이용 방법`);
    row.append(button);
    const group=document.createElement('div');group.className='student-help-heading';heading.before(group);
    group.append(heading,row);
  }}
  const mapTopics=mapId=>planetIdOfMap(mapId)?['department']:['space-plaza','assignment-archive','star-market','department-plaza'].includes(mapId)?['class','mission','department']:mapId==='star-station'?['learning']:mapId==='star-playground'?['play']:mapId==='star-street'?['cozy','shop','craft']:mapId==='milky-valley'?['avatar']:mapId==='black-hole'?['department']:mapId==='whale-stomach'?['special']:['battle','start'];
  let mapReturnFocus=null;
  function openMapGuide(mapId,opener){stop();const r=getRoom(),p=r?.players.find(p=>p.id===getSelfId());if(!p)return;mapReturnFocus=opener||document.activeElement;const guide=mapGuide(mapId,r.planets);detail.querySelector('h2').textContent=guide.name;detail.querySelector('p').textContent=guide.text;const links=detail.querySelector('.map-help-links');links.replaceChildren();for(const id of mapTopics(mapId)){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=HELP_TOPICS.find(t=>t.id===id).title;button.onclick=()=>{detail.close();open(id,mapReturnFocus);};links.append(button);}if(!detail.open)detail.showModal();}
  const detail=document.createElement('dialog');detail.id='map-guide-dialog';detail.innerHTML='<h2></h2><p></p><div class="dialog-actions"><button class="secondary" type="button">확인</button></div>';detail.querySelector('button').onclick=()=>detail.close();document.body.append(detail);
  detail.querySelector('.dialog-actions').insertAdjacentHTML('beforebegin','<h3>이곳 이용 방법</h3><div class="map-help-links"></div>');detail.addEventListener('close',()=>{if(mapReturnFocus?.isConnected)mapReturnFocus.focus();});
  return {open,openMapGuide,update(){installContextHelp();},reset(){returnFocus=null;mapReturnFocus=null;if(dialog.open)dialog.close();if(detail.open)detail.close();}};
}
