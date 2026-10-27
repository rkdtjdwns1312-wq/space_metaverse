import {mapOf,planetIdOfMap} from '/shared/config.js';
import {STUDENT_QUESTIONS,POPULAR_QUESTIONS} from './student-help-data.js';
import {searchHelp} from './help-search.js';

export const HELP_TOPICS=[
  {id:'start',title:'이동과 조작',entries:[['우주 교실 시작하기','키보드 WASD·방향키 또는 화면 조이스틱으로 움직여요. 물체 가까이 가서 화면에 표시된 상호작용 키나 조사하기 버튼을 누르면 이용할 수 있어요.'],['지도와 빠른 이동','오른쪽 위 지도에서 전체 우주 지도를 열어요. 가고 싶은 맵을 빠르게 두 번 누른 뒤 이동 확인에서 예를 선택해요. 레벨·상태에 따라 갈 수 없는 곳도 있어요.'],['첫 여행 미션','메뉴의 첫 여행 안내 다시 보기에서 사용 방법을 차례로 연습할 수 있어요. 안내만 닫아도 진행 내용은 유지돼요.']]},
  {id:'class',title:'알림장·시간표·과제',entries:[['오늘의 알림장','별의 기원에서 알림장 기둥을 조사해요. 선생님이 과제로 표시한 항목의 과제로 가져오기를 누르면 내 과제에 추가돼요.'],['과제 완료하기','아래 과제 버튼에서 할 일을 확인해요. 과제별서고에서 해당 주와 과제를 골라 제출을 눌러요. 선생님이 확인하면 완료돼요. 과제별서고에서는 최근 3주의 과제와 완료한 친구들을 볼 수 있어요.'],['오늘의 시간표','시간표 기둥에는 월요일부터 금요일, 1~6교시가 있어요. 과목은 선생님이 적어요.']]},
  {id:'mission',title:'미션과 보상',entries:[['미션 받기','별의 기원의 별 미션 게시판에서 미션을 받아요. 선생님이 모두에게 나누어 준 미션도 있어요.'],['달성과 완료','소통 → 미션 확인하기에서 조건과 진행 상황을 봐요. 자동미션은 게임 행동으로 달성하고 일반 미션은 선생님이 확인해요. 조건을 달성한 뒤 완료 버튼을 눌러 보상을 받아요.'],['마감 확인','미션에는 선착순·유효기간·매일 반복 조건이 있을 수 있어요. 완료하기 전에 보상과 마감 안내를 확인해요.']]},
  {id:'avatar',title:'성장과 별자리',entries:[['경험치 구매와 진화','은하수계곡의 성장의 별에서 별 파편으로 경험치를 사요. 경험치가 가득 차면 진화의 별로 가서 다음 단계로 진화해요. 경험치 구매만으로 자동 진화하지 않아요.'],['내 정보','내정보에서 레벨, 경험치, 체력·마나와 장비, 현재 상태를 볼 수 있어요. LV2부터 별자리 캐릭터를 만나고 계열에 따라 특징이 달라요.'],['별자리 능력과 전투 스킬','내정보의 별자리 능력은 교실 활동과 연결돼요. 사용 조건과 남은 횟수는 각 능력 설명을 확인해요. 기본공격·전투 스킬과 주간 능력은 서로 달라요.']]},
  {id:'items',title:'가방과 아이템',entries:[['아이템 사용','가방에서 아이템을 고른 뒤 설명과 대상을 확인하고 사용해요. 사용 중인 아이템 기둥에서 누구에게 효과가 적용되는지 볼 수 있어요.'],['현실 교실 활동','많은 아이템은 게임 안의 숫자 대신 현실 교실에서 선생님이 진행해요. 사용 내역을 확인한 선생님이 처리 완료해요. 일부 카드는 실제 게임 상태를 바꿔요.'],['상태 확인','머리 위나 하단 상태 아이콘을 눌러 효과와 남은 시간을 확인해요. 자외선·마비 등으로 아이템 사용이 제한될 수 있어요.']]},
  {id:'shop',title:'상점과 자원',entries:[['별 상점','오색별빛 쉼터의 별 상점에서 별 파편으로 아이템을 사거나 보유한 물건을 팔아요. 구매 가능한 레벨과 아이템은 상점에서 확인해요.'],['우주에너지 상점','몬스터를 물리치고 모은 우주에너지로 장비를 사요. 가방에서 장비 → 장착하기 → 칸을 골라요. 내정보에서는 장비를 확인하거나 해제해요. 조합 전용 장비도 있어요.'],['하루 한 번 능력치 구매','우주에너지 상점에서 하루 한 번 우주에너지 100으로 능력치 하나를 영구히 1 올려요. 각 능력치가 선택될 확률은 최대 체력 40%, 최대 마나 40%, 공격력 10%, 방어력 10%예요. 한국시간 자정에 다시 구매할 수 있어요.']]},
  {id:'craft',title:'조합과 조합법',entries:[['재료로 조합하기','오색별빛 쉼터의 별빛 조합기에서 재료와 수량을 골라요. 조합법을 미리 배워야만 성공하는 것은 아니에요. 올바른 재료와 필요한 비용을 준비해요.'],['나만의 조합법 모으기','조합에 성공하면 그 조합법이 내 조합레시피에 자동 등록돼요. 조합법 아이템을 가방에서 사용해도 등록할 수 있어요. 이미 알고 있는 조합법은 중복 사용 안내를 확인해요.'],['조합법 확인','가방의 조합레시피 버튼에서 배운 재료 조합을 볼 수 있어요. 조합 결과와 재료 소비 안내를 꼭 확인하고 시도해요.']]},
  {id:'department',title:'부서행성',entries:[['우리 반 역할','별의 기원의 부서행성은 친구들과 함께 맡는 학급 역할이에요. 행성 정보에서 소개·규칙·멤버를 보고 가입을 신청할 수 있어요.'],['실적과 내부 꾸미기','부서 내부에서 게시판 옆 실적 기능과 꾸미기 장치를 조사해요. 물체의 모양·색을 바꿀 수 있으며 학생은 필요한 해금 조건을 확인해요.'],['경고와 검은별','경고 제어돌에서 해당 부서의 경고를 기록해요. 정한 수치에 도달하면 검은별 상태로 블랙홀로 이동해요. 친구에게 장난으로 경고를 주지 말고 선생님과 정한 규칙을 지켜요.']]},
  {id:'learning',title:'별 발전소',entries:[['다섯 가지 배움','쉼터 북쪽에는 수학·영어·역사·과학·교양 발전소가 있어요. 건물에 다가가 조사한 뒤 단계나 주제를 선택해요.'],['문제와 이야기','문제를 풀고 설명을 읽거나 교양 이야기를 감상해요. 학습 보상과 하루 제한은 화면 안내를 확인해요. 학습 활동은 자동미션과 연결될 수 있어요.']]},
  {id:'play',title:'놀이터와 미니게임',entries:[['혼자 도전하기','쉼터 남쪽 놀이터에서 별그림 짝맞추기, 별 찾기, 테트리스, 스도쿠 등 게임기를 조사해요. 각 게임의 시작 화면에서 조작법을 볼 수 있어요.'],['친구와 함께하기','대결형 게임은 상대를 초대하고 수락하면 시작해요. 제한 시간과 차례를 지키며 놀아요. 순위와 보상은 게임별 안내를 확인해요.']]},
  {id:'battle',title:'몬스터와 전투',entries:[['공격과 조준','LV2부터 기본공격과 스킬을 사용할 수 있어요. 기본 키는 Q(공격)·E(스킬)·F(상호작용)이며, 조사하기 오른쪽 톱니바퀴에서 바꿀 수 있어요. 현재 키는 각 버튼에 표시돼요. 데스크탑에서는 마우스가 가리키는 쪽으로 공격해요. 모바일에서는 캐릭터가 보는 방향을 확인하고 공격 버튼을 눌러요. 학생끼리는 기본공격으로 피해를 주지 않아요.'],['탐험과 보스','낙원과 별의 시작점에는 다양한 몬스터가 있어요. 공격 예고를 피하고 체력·마나와 스킬 대기시간을 확인해요.'],['회복과 전리품','체력이 다하면 회복 안내를 기다려요. 떨어진 우주에너지나 재료는 가까이 가서 조사해요. 파티에서는 분배 규칙을 확인해요.']]},
  {id:'friends',title:'친구·채팅·파티',entries:[['소통 메뉴','소통에서 친구 보기와 채팅을 열 수 있어요. 전체·부서·귓속말 중 누구에게 보내는지 확인하고 대화해요.'],['함께 모험하기','친구 목록에서 초대·부르기·파티 기능을 이용해요. 상대가 동의해야 진행되는 활동도 있어요. 친구에게 불편한 말을 하거나 반복해서 요청하지 않아요.']]},
  {id:'special',title:'특별한 공간',entries:[['블랙홀 내부','검은별 상태에서는 블랙홀 밖으로 나갈 수 없어요. 선생님에게 어떤 부서의 경고인지 확인하고 해결해요.'],['고래자리의 배 속','고래자리의 제안을 수락하면 들어갈 수 있는 특별한 공간이에요. 안에서는 함께 있는 친구와 대화할 수 있어요. 혼자 탈출 버튼으로 나갈 수 있지만 안내된 고래자리 효과는 받지 못해요.'],['우주 탐사와 시장','별의 기원의 우주 탐사 장치와 교환 기능에서는 화면 안내에 따라 활동해요. 필요한 탐사권·재료·상대의 동의를 먼저 확인해요.']]},
  {id:'safety',title:'연결·도움 요청',entries:[['연결이 끊겼을 때','가운데 재접속 안내가 나오면 잠시 기다려요. 계속 연결되지 않으면 인터넷을 확인하고 선생님께 알려 주세요. 복구에 실패하면 자신의 교실 코드와 계정으로 다시 입장해요.'],['느릴 때','사용하지 않는 브라우저 탭이나 앱을 닫고 연결 상태를 확인해요. 특정 맵·기기에서 반복되면 맵 이름과 당시 활동을 선생님께 알려 주세요.'],['계정 보호','친구의 계정으로 들어가지 말고 비밀번호를 다른 사람에게 알려 주지 않아요. 비밀번호를 잊었다면 선생님에게 재설정을 부탁해요.']]}
];

export function mapGuide(mapId,planets=[]){
  const map=mapOf(mapId,planets);
  let text='주변의 물체 가까이 가서 조사하기로 이곳의 활동을 살펴보세요.';
  if(planetIdOfMap(mapId))text='우리 부서의 규칙·실적을 확인하고 경고 제어돌과 꾸미기 장치를 이용해요.';
  else if(mapId==='space-plaza')text='알림장·시간표·과제·미션을 확인하고 부서행성과 우주 탐사를 이용해요.';
  else if(mapId==='star-street')text='북쪽에서 배우고, 가운데 공원에서 쇼핑·조합하고, 남쪽 놀이터에서 함께 놀아요.';
  else if(mapId==='milky-valley')text='성장의 별에서 경험치를 사고, 경험치를 채우면 진화의 별에서 진화해요.';
  else if(mapId==='black-hole')text='검은별을 받은 친구들이 머무는 곳이에요. 상태가 해제되어야 나갈 수 있어요.';
  else if(mapId==='whale-stomach')text='함께 들어온 친구와 대화해요. 탈출하면 고래자리의 혜택은 받지 못해요.';
  else if(mapId==='star-origin-4')text='별의 여신 석상을 조사하고 조건을 갖추어 세레나에게 도전해요.';
  else if(mapId.startsWith('star-origin-'))text='별자리 몬스터를 만나 전투하고 우주에너지·아이템 재료를 모아 보세요.';
  else if(mapId==='moon-garden')text='귀여운 몬스터를 만나고 태양의 낙원과 달의 낙원으로 탐험을 떠나요.';
  else if(mapId==='star-paradise')text='강력한 별의 몬스터에 도전해요. 동료와 힘을 모으고 공격 예고를 살펴요.';
  else if(mapId.includes('paradise'))text='몬스터의 공격을 피하며 우주에너지와 재료를 모아요. 다음 지역의 문도 찾아보세요.';
  return {name:map.name,text};
}

export function createClassroomHelp({getRoom,getSelfId,stop}){
  const dialog=document.createElement('dialog');dialog.id='classroom-help-dialog';dialog.setAttribute('aria-labelledby','classroom-help-title');
  dialog.innerHTML='<header><div><small>우리 반 우주 탐험 안내서</small><h2 id="classroom-help-title">별빛 도우미</h2></div><button type="button" class="secondary" id="classroom-help-close">닫기</button></header><label for="classroom-help-search">무엇이 궁금한가요?</label><div class="help-search-row"><input id="classroom-help-search" type="search" maxlength="160" placeholder="예: 숙제는 어떻게 내요? · 장비 끼기" autocomplete="off"><button id="classroom-help-clear" class="secondary" type="button" hidden>검색 지우기</button></div><div id="help-suggestions" aria-label="검색 예시"></div><p id="help-result-status" role="status" aria-live="polite"></p><div class="classroom-help-layout"><nav id="classroom-help-tabs" aria-label="도움말 주제"></nav><section id="classroom-help-content" tabindex="0" aria-label="도움말 답변"></section></div>';
  document.body.append(dialog);
  const tabs=dialog.querySelector('#classroom-help-tabs'),content=dialog.querySelector('#classroom-help-content'),search=dialog.querySelector('input');
  const answers=[...STUDENT_QUESTIONS,...HELP_TOPICS.flatMap(t=>t.entries.map(([title,text],i)=>({id:`guide-${t.id}-${i}`,topic:t.id,title,text})))];
  const categories=[{id:'popular',title:'자주 묻는 질문'},...HELP_TOPICS];
  const status=dialog.querySelector('#help-result-status'),clear=dialog.querySelector('#classroom-help-clear');
  let selected='popular',returnFocus=null;
  function chooseTopic(id){selected=id;search.value='';render();}
  for(const word of ['진화','과제 제출','미션 보상','조합','장비','렉']){
    const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=word;button.onclick=()=>{search.value=word;render();};dialog.querySelector('#help-suggestions').append(button);
  }
  function showAnswer(answer,index,query){
    const card=document.createElement('details');card.className='help-answer';card.dataset.answerId=answer.id;card.open=!!query&&index===0;
    const summary=document.createElement('summary'),title=document.createElement('span'),tag=document.createElement('small');
    title.textContent=answer.title;tag.textContent=HELP_TOPICS.find(t=>t.id===answer.topic)?.title||'도움말';summary.append(title,tag);
    const body=document.createElement('div');body.className='help-answer-body';const intro=document.createElement('p');intro.textContent=answer.text;body.append(intro);
    if(answer.steps){const steps=document.createElement('ol');for(const step of answer.steps){const li=document.createElement('li');li.textContent=step;steps.append(li);}body.append(steps);}
    if(answer.note){const note=document.createElement('p');note.className='help-note';note.textContent=answer.note;body.append(note);}
    card.append(summary,body);content.append(card);
  }
  function render(){
    const query=search.value.trim();
    const results=query?searchHelp(answers,query):selected==='popular'?POPULAR_QUESTIONS.map(id=>answers.find(a=>a.id===id)):answers.filter(a=>a.topic===selected);
    tabs.replaceChildren();content.replaceChildren();
    for(const topic of categories){const button=document.createElement('button');button.id='help-tab-'+topic.id;button.type='button';button.className='secondary';button.setAttribute('aria-controls',content.id);button.setAttribute('aria-pressed',String(!query&&selected===topic.id));button.textContent=topic.title;button.onclick=()=>{chooseTopic(topic.id);document.getElementById(button.id)?.focus();};tabs.append(button);}
    clear.hidden=!query;status.textContent=query?`관련 도움말 ${results.length}개 · 질문을 누르면 방법을 볼 수 있어요.`:selected==='popular'?'궁금한 질문을 누르거나 위에서 검색해 보세요.':`${categories.find(t=>t.id===selected)?.title} · 질문을 눌러 펼쳐요.`;
    if(!results.length){const message=document.createElement('p');message.className='help-empty';message.textContent='아직 맞는 답을 찾지 못했어요. “레벨”, “숙제”, “장비”처럼 짧게 써 보세요. 그래도 모르겠으면 어떤 화면인지 선생님께 알려 주세요.';const reset=document.createElement('button');reset.type='button';reset.className='secondary';reset.textContent='자주 묻는 질문 보기';reset.onclick=()=>{chooseTopic('popular');search.focus();};content.append(message,reset);}
    else results.forEach((answer,index)=>showAnswer(answer,index,query));
    content.scrollTop=0;
  }
  search.oninput=render;clear.onclick=()=>{chooseTopic('popular');search.focus();};dialog.querySelector('#classroom-help-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{const target=returnFocus?.isConnected?returnFocus:document.getElementById('world');target?.focus();});
  function open(topic='popular',opener=document.activeElement){if(!getSelfId())return;stop();returnFocus=opener;selected=categories.some(t=>t.id===topic)?topic:'popular';search.value='';render();if(!dialog.open)dialog.showModal();dialog.querySelector('#classroom-help-close').focus();}
  // Help opens above the source dialog; close returns to the same screen without losing its inputs.
  const contextTopics={'inventory-dialog':'items','tasks-dialog':'class','student-missions-dialog':'mission','crafting-dialog':'craft','energy-shop-dialog':'shop','shop-dialog':'shop','assignment-dialog':'class','evolution-dialog':'avatar'};
  document.addEventListener('click',event=>{const button=event.target.closest('[data-student-help]');if(button)open(button.dataset.studentHelp,button);});
  function installContextHelp(){for(const [id,topic] of Object.entries(contextTopics)){const host=document.getElementById(id);if(!host||host.querySelector('[data-student-help]'))continue;const heading=host.querySelector('h2');if(!heading)continue;const button=document.createElement('button');button.type='button';button.className='secondary student-help-link';button.dataset.studentHelp=topic;button.textContent='이용 방법';button.setAttribute('aria-label',`${heading.textContent} 이용 방법`);heading.after(button);}}
  const bar=document.createElement('button');bar.id='map-guide-bar';bar.type='button';bar.hidden=true;bar.setAttribute('aria-label','현재 맵 설명 보기');bar.innerHTML='<strong></strong><span></span>';document.querySelector('.map-wrap').append(bar);
  const mapTopics=mapId=>planetIdOfMap(mapId)?['department']:mapId==='space-plaza'?['class','mission','department']:mapId==='star-street'?['shop','craft','learning','play']:mapId==='milky-valley'?['avatar']:mapId==='black-hole'?['department']:mapId==='whale-stomach'?['special']:['battle','start'];
  bar.onclick=()=>{stop();const r=getRoom(),p=r?.players.find(p=>p.id===getSelfId());if(!p)return;const guide=mapGuide(p.mapId,r.planets);detail.querySelector('h2').textContent=guide.name;detail.querySelector('p').textContent=guide.text;const links=detail.querySelector('.map-help-links');links.replaceChildren();for(const id of mapTopics(p.mapId)){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=HELP_TOPICS.find(t=>t.id===id).title;button.onclick=()=>{detail.close();open(id,bar);};links.append(button);}if(!detail.open)detail.showModal();};
  const detail=document.createElement('dialog');detail.id='map-guide-dialog';detail.innerHTML='<h2></h2><p></p><div class="dialog-actions"><button class="secondary" type="button">확인</button></div>';detail.querySelector('button').onclick=()=>detail.close();document.body.append(detail);
  detail.querySelector('.dialog-actions').insertAdjacentHTML('beforebegin','<h3>이곳 이용 방법</h3><div class="map-help-links"></div>');detail.addEventListener('close',()=>bar.focus());
  return {open,update(){installContextHelp();const r=getRoom(),p=r?.players.find(p=>p.id===getSelfId());bar.hidden=!p;if(!p)return;const guide=mapGuide(p.mapId,r.planets);bar.querySelector('strong').textContent=guide.name;bar.querySelector('span').textContent=guide.text;bar.title=guide.text;},reset(){bar.hidden=true;returnFocus=null;if(dialog.open)dialog.close();if(detail.open)detail.close();}};
}
