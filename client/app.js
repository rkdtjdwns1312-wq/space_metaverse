import { createWorld, renderPortrait } from './world.js';
import { startClassroomClock } from './classroom-clock.js';
import { createSocialUI } from './social-ui.js';
import { createAccountsUI } from './accounts-ui.js';
import { createUniverseUI } from './universe-ui.js';
import { createJoystick } from './joystick-ui.js';
import { createTempleUI } from './temple-ui.js';
import { createArcadeUI } from './arcade-ui.js';
import { createDepartmentWorkUI } from './department-work-ui.js';
import {createMonsterUI} from './monster-ui.js';
import {createPlanetRulesUI} from './planet-rules-ui.js';
import {createEvolutionUI} from './evolution-ui.js';
import {createGrowthUI} from './growth-ui.js';
import {createWarningUI} from './warning-ui.js';
import {createAssignmentUI} from './assignment-ui.js';
import {createInteriorDecorUI} from './interior-decor-ui.js';
import {interiorDecorObject} from '/shared/interior-decor.js';
import {constellationOf} from '/shared/constellations.js';
import { PROGRESSION, STATIC_MAPS, CHAT } from '/shared/config.js';
import { PLAZA_ID, STREET_ID, GARDEN_ID, VALLEY_ID, BLACK_HOLE_ID, PLANET, PLANET_COLORS, planetIdOfMap, interiorIdOf, SHOP, ITEM_TYPES, itemOf, ITEM_USE, TRADE, BAG, PLANET_TEMPLATES, templateOf } from '/shared/config.js';
const $=id=>document.getElementById(id),world=createWorld($('world'));
startClassroomClock($('classroom-clock'));
const socket=window.io({autoConnect:false,reconnectionDelay:500,reconnectionDelayMax:2000});
let selfId=null,room=null,busy=false,toastTimer,mode='student',held=new Set(),touch={x:0,y:0},last={x:0,y:0},chatBusy=false,planetDialogId=null,placing=false,createPoint=null,useItem=null,tradeDialogSig='',knownIncomingTradeIds=new Set(),selectedSlotId=null;
const planetById=id=>room?.planets.find(p=>p.id===id)||null;
const social=createSocialUI({getRoom:()=>room,getSelfId:()=>selfId,request,stop,toast,renderMessage:addChatMessage,clearMessages:clearChat});
$('avatar-card').append($('experience-panel'));
let discardItemId=null;
$('discard-no').onclick=()=>$('discard-dialog').close();
$('discard-yes').onclick=async()=>{
  if(!discardItemId)return;$('discard-yes').disabled=true;
  try{await request('item:discard',{itemId:discardItemId});$('discard-dialog').close();toast('아이템 1개를 버렸어요.');}
  catch(e){toast(e.message);}finally{$('discard-yes').disabled=false;}
};
$('discard-dialog').addEventListener('close',()=>{discardItemId=null;});
document.querySelector('.top-right').append($('connection'));
let overview=false;
const universe=createUniverseUI({getRoom:()=>room,getSelfId:()=>selfId,stop,onAreaView:()=>{overview=!overview;world.setOverview(overview);$('map-area-view').textContent=overview?'내 주변으로 돌아가기':'현재 맵 한눈에 보기';$('world').focus();}});
const joystick=createJoystick({onMove:value=>{if(!selfId||placing||document.querySelector('dialog[open]'))return;touch=value;input();},onStop:()=>{touch={x:0,y:0};input();}});
const temple=createTempleUI({request,stop,toast,getRoom:()=>room,getSelfId:()=>selfId});
const interiorDecor=createInteriorDecorUI({request,stop,toast,getRoom:()=>room});
const subscribe=(event,listener)=>{socket.on(event,listener);return()=>socket.off(event,listener);};
const arcade=createArcadeUI({stop,toast,request,
  subscribeStarRanking:listener=>subscribe('stars:ranking',listener),
  sendDodgeInput:data=>socket.volatile.emit('dodge:input',data),
  subscribeDodgeState:listener=>subscribe('dodge:state',listener),
  subscribeDodgeRanking:listener=>subscribe('dodge:ranking',listener)});
const departmentWork=createDepartmentWorkUI({request,stop,toast});
const monsterUI=createMonsterUI({request,stop,toast,isJoined:()=>!!selfId});
const rulesUI=createPlanetRulesUI({request,stop,toast,isJoined:()=>!!selfId});
const evolutionUI=createEvolutionUI({request,stop,toast,isJoined:()=>!!selfId});
const growthUI=createGrowthUI({request,stop,toast,isJoined:()=>!!selfId});
const warningUI=createWarningUI({request,stop,toast,getSelfId:()=>selfId});
const assignmentUI=createAssignmentUI({request,stop,toast});
socket.on('department:changed',event=>departmentWork.changed(event));
const departmentButton=document.createElement('button');departmentButton.id='planet-work';departmentButton.className='small primary';departmentButton.textContent='부서실적 · 분배하기 · 분배결과';
$('planet-rename').after(departmentButton);
departmentButton.onclick=()=>{const id=planetDialogId;$('planet-dialog').close();departmentWork.open(id);};
$('planet-colors').append(...PLANET_COLORS.map((color,i)=>{
  const label=document.createElement('label');label.className='swatch';
  const input=document.createElement('input');input.type='radio';input.name='planet-color';input.value=color;if(i===0)input.checked=true;
  const span=document.createElement('span');span.style.background=color;
  label.append(input,span);return label;
}));
function onPlanetTypeChange(t){
  $('planet-name').value=t.name;$('planet-desc').value=t.description;
  const colorInput=[...$('planet-colors').querySelectorAll('input')].find(i=>i.value===t.color);
  if(colorInput)colorInput.checked=true;
  for(const label of $('planet-types').querySelectorAll('label.type'))label.classList.toggle('selected',label.querySelector('input').checked);
}
$('planet-types').append(...PLANET_TEMPLATES.map(t=>{
  const label=document.createElement('label');label.className='type';
  const input=document.createElement('input');input.type='radio';input.name='planet-type';input.value=t.id;
  input.addEventListener('change',()=>onPlanetTypeChange(t));
  const icon=document.createElement('span');icon.className='type-icon';icon.textContent=t.icon;icon.style.background=t.color;
  const name=document.createElement('span');name.className='type-name';name.textContent=t.name;
  label.append(input,icon,name);return label;
}));
let sessionToken=null;
try{sessionToken=sessionStorage.getItem('space-session');}catch{}
const saveToken=token=>{sessionToken=token;try{token?sessionStorage.setItem('space-session',token):sessionStorage.removeItem('space-session');}catch{}};
const accounts=createAccountsUI({getRoom:()=>room,getSelfId:()=>selfId,request,toast,saveToken});
const TEACHER_KEY_STORAGE='space-teacher-key';
const cube=$('ability-cube');
for(let face=1;face<=6;face++){
  const side=document.createElement('div');side.className='die-face';side.dataset.face=String(face);
  for(let star=0;star<face;star++){const dot=document.createElement('span');dot.textContent='★';side.append(dot);}
  cube.append(side);
}
const faceRotation={1:'rotateX(0deg) rotateY(0deg)',2:'rotateY(-90deg)',3:'rotateX(90deg)',4:'rotateX(-90deg)',5:'rotateY(90deg)',6:'rotateY(180deg)'};
let dieTurn=0;
function showStarDie(roll,rolls=[roll]){
  $('ability-dice').hidden=false;$('ability-dice-result').textContent='별 주사위가 굴러가요…';
  dieTurn+=2;cube.style.transition='none';cube.style.transform='rotateX(0deg) rotateY(0deg)';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    cube.style.transition='transform 1.15s cubic-bezier(.16,.8,.22,1)';
    cube.style.transform=`rotateX(${dieTurn*360}deg) rotateY(${dieTurn*360}deg) ${faceRotation[roll]}`;
  }));
  setTimeout(()=>$('ability-dice-result').textContent='결과: '+rolls.join(' · ')+' ★',1200);
}
async function refreshAbilityStatus(){
  const me=room?.players.find(player=>player.id===selfId),level=me?.avatar?.level||1,constellation=constellationOf(me?.avatar?.constellationId,level);
  if(!constellation?.ability)return;
  const status=await request('ability:status',{}),ability=constellation.ability;
  $('ability-title').textContent='Lv'+level+' '+constellation.name+' 능력';
  $('ability-description').textContent=ability.description+(ability.note?' '+ability.note:'')+(ability.mode==='manual'?' · 선생님 확인 후 적용하는 능력이에요.':'');
  $('ability-status').textContent=status.used?'이번 주 능력 사용 완료 · 다음 월요일에 다시 사용할 수 있어요.':'이번 주에 한 번 사용할 수 있어요.';
  if(status.pending?.mode==='shop-copy')$('ability-status').textContent+=' 다음 '+(status.pending.maxPrice?'별 '+status.pending.maxPrice+'개 이하':'Lv2 이하')+' 아이템을 살 때 1개가 더 생겨요.';
  if(status.pending?.mode==='dice-item')$('ability-status').textContent+=' 주사위 '+status.pending.roll+' · Lv'+status.pending.maxLevel+' 이하 아이템을 골라주세요.';
  if(status.pending?.mode==='value-item')$('ability-status').textContent+=' 남은 가치 '+status.pending.budget+'별 · Lv'+status.pending.maxLevel+' 이하 · 최대 '+status.pending.picks+'종';
  const retry=status.pending?.mode==='dice-retry'&&constellation.id==='libra';
  $('ability-use').dataset.event=retry?'ability:retry':'ability:use';
  $('ability-use').textContent=retry?'별 2개로 다시 던지기':ability.mode==='manual'?'이번 주 능력 확인 요청':'이번 주 능력 사용하기';
  $('ability-use').disabled=status.used&&!retry;
  const requiresTarget=['ban-two-days','sleep'].includes(ability.mode)||ability.target||
    (me.avatar.level===2&&['cetus','cancer','pisces'].includes(constellation.id));
  $('ability-target-row').hidden=!requiresTarget;
  $('ability-target').replaceChildren(...(room?.players||[]).filter(player=>player.role==='student'&&player.connected&&player.id!==selfId)
    .filter(player=>player.avatar.level<=(ability.targetMaxLevel||(me.avatar.level===2&&constellation.id==='cetus'?2:6)))
    .map(player=>new Option(player.nickname,player.id)));
  $('ability-planet-row').hidden=ability.mode!=='warning-one';
  $('ability-planet').replaceChildren(...status.planets.map(planet=>new Option(planet.name+' · 경고 '+planet.count+'회',planet.id)));
  $('ability-item-row').hidden=!['dice-item','value-item'].includes(status.pending?.mode);
  $('ability-item').replaceChildren(...SHOP.items.filter(item=>item.level<=status.pending?.maxLevel&&
    (status.pending?.mode!=='value-item'||item.price<=status.pending.budget&&!status.pending.selected.includes(item.id)))
    .map(item=>new Option('Lv'+item.level+' '+item.name+' · '+item.price+'별',item.id)));
  $('ability-choose-item').disabled=!$('ability-item').options.length;
}
$('self-ability-open').onclick=async()=>{
  $('avatar-dialog').close();stop();$('ability-dice').hidden=true;
  try{await refreshAbilityStatus();$('ability-dialog').showModal();}catch(error){toast(error.message);}
};
$('ability-close').onclick=()=>$('ability-dialog').close();
$('ability-use').onclick=async()=>{
  const button=$('ability-use');button.disabled=true;
  try{
    const result=await request(button.dataset.event||'ability:use',{targetId:$('ability-target-row').hidden?null:$('ability-target').value,
      planetId:$('ability-planet-row').hidden?null:$('ability-planet').value});
    if(result.roll)showStarDie(result.roll,result.rolls||[result.roll]);
    toast(result.note||'별자리 능력을 사용했어요.');
    await refreshAbilityStatus();
  }catch(error){toast(error.message);button.disabled=false;}
};
$('ability-choose-item').onclick=async()=>{
  const button=$('ability-choose-item');button.disabled=true;
  try{const result=await request('ability:choose-item',{itemId:$('ability-item').value});toast(result.itemName+' 1개를 만들었어요.');await refreshAbilityStatus();}
  catch(error){toast(error.message);}finally{button.disabled=false;}
};
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function setMode(value){
  mode=value;$('student-form').hidden=value!=='student';$('teacher-form').hidden=value!=='teacher';
  for(const role of ['student','teacher']){$(role+'-tab').classList.toggle('selected',role===value);$(role+'-tab').setAttribute('aria-pressed',String(role===value));}
  $('form-message').textContent='';
}
$('student-tab').onclick=()=>setMode('student');$('teacher-tab').onclick=()=>setMode('teacher');
let classMode='';
function chooseClassMode(value){
  classMode=value;
  const open=value==='open',create=value==='new';
  $('open-class-fields').hidden=!open;$('new-class-fields').disabled=!create;$('new-class-fields').hidden=!create;
  $('open-code').required=open;$('form-message').textContent='';
  for(const [id,selected] of [['choose-open-class',open],['choose-new-class',create]]){
    $(id).classList.toggle('selected',selected);$(id).setAttribute('aria-pressed',String(selected));
  }
  const submitButton=$('teacher-form').querySelector('.submit');
  submitButton.hidden=!value;submitButton.textContent=open?'기존 교실 입장하기 ↗':'설정한 교실 생성하기 ✦';
}
$('choose-open-class').onclick=()=>chooseClassMode('open');
$('choose-new-class').onclick=()=>chooseClassMode('new');
const studentAccountDraft=[];
function renderStudentAccountRows(){
  const count=Number($('student-count').value);
  if(!Number.isInteger(count)||count<1||count>29)return;
  for(const [index,row] of [...$('student-account-rows').children].entries()){
    studentAccountDraft[index]={name:row.querySelector('.student-account-name').value,
      pin:row.querySelector('.student-account-pin').value};
  }
  const rows=[];
  for(let index=0;index<count;index++){
    const row=document.createElement('div');row.className='student-account-row';
    const nameLabel=document.createElement('label');nameLabel.textContent=(index+1)+'번 학생 이름';
    const name=document.createElement('input');name.className='student-account-name';name.maxLength=12;name.required=true;
    name.autocomplete='off';name.value=studentAccountDraft[index]?.name||'';name.setAttribute('aria-label',(index+1)+'번 학생 이름');
    const pinLabel=document.createElement('label');pinLabel.textContent='비밀번호';
    const pin=document.createElement('input');pin.className='student-account-pin';pin.type='password';pin.inputMode='numeric';
    pin.pattern='[0-9]{4}';pin.minLength=4;pin.maxLength=4;pin.required=true;pin.autocomplete='new-password';
    pin.value=studentAccountDraft[index]?.pin||'';pin.setAttribute('aria-label',(index+1)+'번 학생 비밀번호 (숫자 4자리)');
    nameLabel.append(name);pinLabel.append(pin);row.append(nameLabel,pinLabel);rows.push(row);
  }
  $('student-account-rows').replaceChildren(...rows);
}
function clearStudentAccountPins(){
  for(const account of studentAccountDraft)if(account)account.pin='';
  for(const pin of $('student-account-rows').querySelectorAll('.student-account-pin'))pin.value='';
}
$('student-count').addEventListener('input',renderStudentAccountRows);
$('student-count').addEventListener('change',()=>{
  const normalized=String(Math.min(29,Math.max(1,Number($('student-count').value)||1)));
  if($('student-count').value!==normalized){$('student-count').value=normalized;renderStudentAccountRows();}
});
renderStudentAccountRows();
$('allowed-names').value=Array.from({length:29},(_,i)=>String(i+1)).join(', ');
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('teacher')){
  const key=fragment.get('teacher');$('teacher-key').value=key;setMode('teacher');history.replaceState(null,'',location.pathname);
  try{sessionStorage.setItem(TEACHER_KEY_STORAGE,key);}catch{}
}else{
  let savedKey=null;try{savedKey=sessionStorage.getItem(TEACHER_KEY_STORAGE);}catch{}
  if(savedKey){$('teacher-key').value=savedKey;setMode('teacher');}
}
function controls(){for(const b of document.querySelectorAll('.submit'))b.disabled=busy||!socket.connected;}
async function request(event,data){
  if(!socket.connected)throw new Error('연결을 기다리고 있어요. 잠시 후 다시 시도해주세요.');
  const reply=await socket.timeout(6000).emitWithAck(event,data);
  if(!reply.ok)throw new Error(reply.error);
  return reply;
}
function updateRoom(value){
  room=value;world.setRoom(room,selfId);
  universe.update();
  $('room-title').textContent=room.title;$('room-code').textContent=room.code;
  const countLabel=room.players.filter(p=>p.connected).length+' / '+room.maxPlayers;
  $('player-count').textContent=countLabel;$('crew-count').textContent=countLabel;
  $('crew-empty').hidden=room.players.length>0;
  const me=room.players.find(p=>p.id===selfId);
  const isTeacher=me?.role==='teacher';
  const myMapId=me?.mapId||PLAZA_ID,inPlanet=Boolean(planetIdOfMap(myMapId)),inStreet=myMapId===STREET_ID;
  $('players').replaceChildren(...room.players.filter(p=>p.connected).map(p=>{
    const li=document.createElement('li');li.classList.toggle('mine',p.id===selfId);
    const name=document.createElement('span');name.textContent=p.nickname+(p.id===selfId?' · 나':'');
    if(p.departmentId){
      const dp=planetById(p.departmentId),icon=templateOf(dp?.templateId)?.icon;
      const dept=document.createElement('span');dept.className='dept';dept.textContent=(icon?icon+' ':'')+(dp?.name||'').slice(0,2);
      name.append(dept);
    }
    const insideId=planetIdOfMap(p.mapId),inside=insideId?planetById(insideId):null;
    const state=document.createElement('span');state.textContent=p.away?'수업 밖':!p.connected?'다시 연결 중':inside?inside.name+' 안':p.role==='teacher'?'선생님':p.muted?'채팅 멈춤':p.avatar.level>=PROGRESSION.transcendentLevel?PROGRESSION.transcendentName:'LV '+p.avatar.level;
    li.append(name);
    if(p.id!==selfId){const select=document.createElement('button');select.type='button';select.className='small secondary friend-select';select.dataset.playerId=p.id;select.textContent='대화 · 부르기';select.setAttribute('aria-label',p.nickname+' 친구 선택');select.onclick=()=>social.friend(p.id);li.append(select);}
    // 별 파편 잔액은 본인과 선생님에게만 보여 줍니다(친구끼리 비교·놀림 방지).
    if(p.role!=='teacher'&&(isTeacher||p.id===selfId)){const shards=document.createElement('span');shards.className='shards-badge';shards.textContent='★ '+(p.starShards||0);li.append(shards);}
    const effects=document.createElement('span');effects.className='effects';effects.textContent=(p.effects||[]).map(e=>e.icon).join(' ');
    li.append(effects);
    li.append(state);
    if(isTeacher&&p.role!=='teacher'){
      const mute=document.createElement('button');mute.type='button';mute.className='small secondary mute';mute.dataset.playerId=p.id;
      mute.textContent=p.muted?'허용':'금지';mute.setAttribute('aria-label',(p.muted?'채팅 허용: ':'채팅 금지: ')+p.nickname);
      mute.onclick=async()=>{try{await request('chat:mute',{playerId:p.id,muted:!p.muted});}catch(e){toast(e.message);}};
      li.append(mute);
    }
    return li;
  }));
  $('self-name').textContent=me?.nickname||'나의 소행성';
  $('self-description').textContent=me?.role==='teacher'?'친구들에게 교실 코드를 알려주세요. 학생들은 허용한 번호나 닉네임으로 들어올 수 있어요.':'방향키로 움직여보세요. 이름 옆에 ‘나’라고 표시된 소행성이 바로 나예요.';
  if(me?.role==='student'){
    const constellation=constellationOf(me.avatar.constellationId,me.avatar.level);
    $('self-description').textContent=(constellation?constellation.icon+' Lv'+me.avatar.level+' '+constellation.name:'이름 없는 작은 소행성')+' · 방향키나 조이스틱으로 움직여요.';
  }
  if(me?.avatar.blackStar)$('self-description').textContent='현재 검은별 상태입니다. 선생님이 해제하면 블랙홀 밖으로 나갈 수 있어요.';
  const myPlanet=me?.departmentId?planetById(me.departmentId):null,myPlanetIcon=templateOf(myPlanet?.templateId)?.icon;
  $('self-department').textContent=isTeacher?'선생님은 모든 행성에 들어갈 수 있어요.':myPlanet?'소속: '+(myPlanetIcon?myPlanetIcon+' ':'')+(myPlanet.name||''):'아직 소속 행성이 없어요. 행성 가까이 가서 E를 눌러보세요.';
  $('self-shards').textContent=String(me?.starShards||0);
  $('bag-currency').hidden=isTeacher; // 선생님은 지급하는 사람이라 잔액을 보여 주지 않습니다.
  $('draw-resume').hidden=!me?.rabbitDrawPending;
  const myLv=myLevel();
  // 초기 HTML의 소행성 표기를 진화·별자리 변경·재접속 때 함께 갱신합니다.
  $('self-form-name').textContent=isTeacher?'선생님':myLv>=2?(constellationOf(me?.avatar?.constellationId,myLv)?.name||'별자리'):'소행성';
  const transcendent=myLv>=PROGRESSION.transcendentLevel;
  $('self-level').textContent=transcendent?PROGRESSION.transcendentName:'LV '+myLv+' '+'★'.repeat(myLv);
  const constellationType=myLv>=2?constellationOf(me?.avatar?.constellationId,myLv)?.type:null;
  $('self-constellation-type').hidden=!constellationType;
  $('self-constellation-type').textContent=constellationType||'';
  const abilityConstellation=myLv>=2&&me?.role==='student'?constellationOf(me.avatar.constellationId,myLv):null;
  $('self-ability-panel').hidden=!abilityConstellation?.ability;
  if(abilityConstellation?.ability){
    $('self-ability-art').src=abilityConstellation.art;
    $('self-ability-art').alt='Lv'+myLv+' '+abilityConstellation.name+' 카드 그림';
    $('self-ability-name').textContent='Lv'+myLv+' '+abilityConstellation.name+' · '+abilityConstellation.type;
    const ability=abilityConstellation.ability;
    $('self-ability-description').textContent=ability.description+(ability.note?' '+ability.note:'')+
      (ability.mode==='manual'?' · 선생님 확인 후 적용':'')+(myLv>4?' · 현재 Lv4 카드 자료 적용 중':'');
  }
  const required=PROGRESSION.nextLevelXp[myLv-1],xp=me?.avatar.xp||0;
  $('self-xp').textContent=transcendent?'최고 단계':xp+' / '+required;
  $('experience-bar').max=transcendent?1:required;$('experience-bar').value=transcendent?1:xp;
  $('experience-next').textContent=transcendent?'초월체에 도달했어요!':(myLv===5?'초월체':'LV '+(myLv+1))+'까지 '+Math.max(0,required-xp)+' 남았어요.';
  $('card-foot').textContent=room.title+' · '+room.code;
  $('avatar-card').style.setProperty('--card-accent',isTeacher?'#d2a454':(myPlanet?.color||'#b9a8f0'));
  $('avatar-card').classList.toggle('teacher-card',isTeacher);
  if(me)renderPortrait($('avatar-portrait'),{...me,deptIcon:myPlanetIcon},me.effects);
  $('hint').textContent=isTeacher
    ?(inStreet?'별상점 가까이에서 E · 왼쪽 문으로 우주 광장':inPlanet?'위 "우리 행성 정보"에서 규칙 편집 · "광장으로 나가기"로 복귀':'지도의 행성을 클릭해 관리 · "선생님 도구"에서 별 파편 지급')
    :(inStreet?'별상점 가까이에서 E · 왼쪽 문으로 우주 광장':inPlanet?'위쪽 게시판에서 규칙 확인 · 아래 문 근처에서 E로 광장':'행성 가까이에서 E · 오른쪽 문으로 오색별빛 쉼터 · 별 파편은 선생님이 나눠 줘요');
  renderBag(me?.inventory);
  renderMyTasks(me?.tasks||[]);
  $('dock-tasks').hidden=isTeacher;
  renderSelfEffects(me);
  const myProposal=(room.proposals||[]).find(p=>p.playerId===selfId);
  $('self-proposal').hidden=!myProposal;
  if(myProposal)$('self-proposal').textContent='"'+myProposal.name+'" 행성 신청 중 · 선생님 승인을 기다려요';
  $('leave').textContent=me?.role==='teacher'?(room.unattended?'선생님 나가기':room.persistent===true?'수업 마치기':'교실 종료하기'):'교실 나가기';
  $('planet-exit').hidden=!inPlanet;$('planet-new').hidden=myMapId!==PLAZA_ID;$('planet-info').hidden=!inPlanet;
  // 자리 고르는 중에 문으로 다른 맵에 가면 '행성 만들기' 버튼이 사라져 취소할 방법이 보이지 않습니다.
  // 행성 자리는 광장 좌표이므로(서버도 광장에서만 허용) 광장을 벗어나면 자리 고르기를 끝냅니다.
  if(placing&&myMapId!==PLAZA_ID)stopPlacement();
  $('teacher-tools').hidden=!isTeacher;
  $('copy-student-link').hidden=!isTeacher;
  $('pin-panel').hidden=!isTeacher||room.persistent!==true||room.managedAccounts;
  $('trade-section').hidden=isTeacher; // 선생님은 거래 당사자가 아니라 제안 버튼을 숨깁니다.
  if(!placing)$('map-caption').textContent=mapCaption(myMapId);
  if(!room.players.some(p=>p.role==='teacher'&&p.connected))$('connection').textContent=room.unattended?'우주와 연결되었어요 · 선생님 자리 비움':'선생님 연결 대기 · 잠시 이동을 멈춰요';
  else if(socket.connected)$('connection').textContent='우주와 연결되었어요';
  updateChatUI(me,isTeacher);
  social.update();
  accounts.update();
  updateProposalsPanel(isTeacher);
  updateShardsTargetOptions();
  updatePinTargetOptions();
  updateTradesList();
  updateTeacherPanels(isTeacher);
  updateTeacherBadge(isTeacher);
  if($('planet-dialog').open&&planetDialogId)renderPlanetDialog(planetDialogId);
  // 다른 친구의 입퇴장·구매마다 스냅샷이 오므로, 내 잔액·가방이 실제로 바뀐 경우에만 상점 목록을 다시 그립니다(입력 중인 수량 보호).
  if($('shop-dialog').open){const sig=shopSignature();if(sig!==shopSig){shopSig=sig;updateShopShards();renderShopBuyList();renderShopSellList();}}
  // 거래 대화상자가 열려 있을 때도 내 가방·접속 학생 목록이 실제로 바뀐 경우에만 다시 그립니다(체크·수량 입력 보호).
  if($('trade-dialog').open){const sig=tradeSignature();if(sig!==tradeDialogSig){tradeDialogSig=sig;renderTradeTargetOptions();renderTradeGiveItems();}}
}
let shopSig='';
function shopSignature(){return myShards()+'|'+JSON.stringify(myInventory());}
function mapCaption(myMapId){
  if(myMapId===PLAZA_ID)return '✦ 같은 교실의 친구들과 함께하는 공간';
  if(myMapId===BLACK_HOLE_ID)return '✦ 블랙홀 내부 · 검은별은 선생님이 해제할 때까지 밖으로 나갈 수 없어요';
  if(myMapId===STREET_ID)return '✦ 오색별빛 쉼터 · 별상점에서 별 파편으로 물건을 사고팔아요';
  if(myMapId===VALLEY_ID)return '✦ 은하수계곡 · 위쪽 문으로 별의 기원';
  if(myMapId===GARDEN_ID)return '✦ 낙원의 갈림길 · 위로 태양, 아래로 달, 오른쪽으로 별의 기원';
  if(['sun-paradise','moon-paradise','star-paradise'].includes(STATIC_MAPS[myMapId]?.theme))return '✦ '+STATIC_MAPS[myMapId].name+' · 길 끝의 문에서 E로 이동해요';
  if(STATIC_MAPS[myMapId]?.theme==='star-origin')return '✧ '+STATIC_MAPS[myMapId].name+' · 작은 별들이 반짝이는 우주';
  return '✦ '+(planetById(planetIdOfMap(myMapId))?.name||'행성')+' 안 · 소속 친구들만의 공간';
}
function myLevel(){const me=room?.players.find(p=>p.id===selfId);return me?.role==='teacher'?ITEM_USE.teacherLevel:me?.avatar?.level||1;}
function renderMyTasks(tasks){
  const list=$('my-tasks');list.replaceChildren();$('my-tasks-empty').hidden=tasks.length>0;
  for(const task of tasks){
    const li=document.createElement('li'),text=document.createElement('span');text.textContent=task.text;
    const button=document.createElement('button');button.type='button';button.className='small primary';button.textContent='과제완료';
    button.onclick=async()=>{button.disabled=true;try{const data=await request('task:complete',{taskId:task.id});const me=room?.players.find(p=>p.id===selfId);if(me)me.tasks=data.tasks;renderMyTasks(data.tasks);toast('과제를 완료했어요.');}
      catch(error){button.disabled=false;toast(error.message);}};
    li.append(text,button);list.append(li);
  }
}
$('tasks-close').onclick=()=>$('tasks-dialog').close();
$('tasks-dialog').addEventListener('close',()=>$('world').focus());
// 레트로 인벤토리 격자: BAG.columns×BAG.rows칸(한 종류당 한 칸). 채워진 칸만 li.slot(검증 스크립트가 세는 '가진 물건 수'), 빈 칸은 div.slot.empty입니다.
function itemVisual(item){
  if(!item.art){const icon=document.createElement('span');icon.className='icon';icon.textContent=item.icon;return icon;}
  const image=document.createElement('img');image.className='item-art';image.src=item.art;image.alt='';image.loading='lazy';return image;
}
function itemUseText(item){
  if(item.mode==='manual')return '게임에서는 사용 사실을 기록해요. 선생님이 현실 교실에서 처리합니다.';
  if(item.mode==='meteor')return '선택한 부서가 나에게 준 활성 경고를 즉시 해제해요.';
  if(item.mode==='uv')return '지정한 친구가 오늘 자정까지 자외선 상태가 돼요.';
  if(item.mode==='moon')return '자외선을 해제하고 오늘 자정까지 다른 카드 효과를 막아요.';
  if(item.mode==='draw')return '뒷면 카드 10장 중 하나를 골라 별 파편 1~10개를 받아요. 장기 평균은 3개예요.';
  return item.effect.label+' · '+Math.max(1,Math.round(item.effect.durationMs/60000))+'분 동안';
}
function renderBag(inventory){
  const rows=(inventory||[]).map(entry=>({entry,item:itemOf(entry.id)})).filter(row=>row.item);
  const total=BAG.columns*BAG.rows;
  $('bag-empty').hidden=rows.length>0;
  if(selectedSlotId&&!rows.some(r=>r.item.id===selectedSlotId))selectedSlotId=null;
  const cells=[];
  for(let i=0;i<total;i++){
    const row=rows[i];
    if(!row){
      const empty=document.createElement('div');empty.className='slot empty';empty.setAttribute('role','gridcell');
      cells.push(empty);continue;
    }
    const {entry,item}=row;
    const li=document.createElement('li');li.className='slot'+(selectedSlotId===item.id?' selected':'');li.dataset.itemId=item.id;li.setAttribute('role','gridcell');
    const btn=document.createElement('button');btn.type='button';btn.className='slot-btn';btn.setAttribute('aria-label',item.name+' × '+entry.quantity);
    const icon=itemVisual(item);
    const count=document.createElement('span');count.className='count';count.textContent='×'+entry.quantity;
    btn.append(icon,count);
    if(item.level>myLevel()){const lock=document.createElement('span');lock.className='lock';lock.textContent='LV'+item.level;btn.append(lock);}
    btn.onclick=()=>{selectedSlotId=(selectedSlotId===item.id)?null:item.id;renderBag(inventory);};
    li.append(btn);
    cells.push(li);
  }
  $('bag-list').replaceChildren(...cells);
  renderBagDetail(rows);
}
function renderBagDetail(rows){
  const row=rows.find(r=>r.item.id===selectedSlotId);
  if(!row){$('bag-detail').textContent='칸을 눌러 물건을 살펴봐요.';return;}
  const {entry,item}=row,canUse=item.level<=myLevel();
  const wrap=document.createElement('div');wrap.className='bag-detail-inner';
  const icon=itemVisual(item);
  const info=document.createElement('div');info.className='info';
  const name=document.createElement('strong');name.textContent=item.name;
  const desc=document.createElement('p');desc.className='muted';desc.textContent=item.description;
  const meta=document.createElement('p');meta.className='muted';meta.textContent=(ITEM_TYPES[item.type]||item.type)+' · LV '+item.level+' · × '+entry.quantity;
  info.append(name,desc,meta);
  if(item.special){const special=document.createElement('p');special.className='muted item-special';special.textContent=item.special;info.append(special);}
  const use=document.createElement('button');use.type='button';use.className='small primary use';use.dataset.itemId=item.id;use.textContent='사용';
  use.textContent=item.mode==='draw'?'뽑기 카드 보기':'아이템 사용하기';
  use.onclick=()=>canUse?openUseDialog(item):toast('캐릭터의 lv보다 높은 아이템으로 사용할 수 없습니다');
  const details=document.createElement('button');details.type='button';details.className='small secondary item-info';details.textContent='정보 보기';
  details.onclick=()=>{$('item-info-title').textContent=item.icon+' '+item.name;$('item-info-text').textContent=item.description+' · '+itemUseText(item)+(item.special?' · '+item.special:'')+' · LV '+item.level;$('item-info-dialog').showModal();};
  const discard=document.createElement('button');discard.type='button';discard.className='small danger item-discard';discard.textContent='아이템 버리기';
  discard.onclick=()=>{discardItemId=item.id;$('discard-message').textContent=item.name+' 1개를 정말 버리시겠습니까? 버린 아이템은 되돌릴 수 없어요.';$('discard-dialog').showModal();};
  const choices=document.createElement('div');choices.className='item-choices';choices.append(details,use,discard);
  wrap.append(icon,info,choices);
  $('bag-detail').replaceChildren(wrap);
}
function effectText(e){
  if(e.until===null)return e.icon+' '+e.label+' · 선생님 처리 대기';
  const mins=Math.max(1,Math.ceil((e.until-Date.now())/60000));
  return e.icon+' '+e.label+' · '+mins+'분';
}
function renderSelfEffects(me){
  const list=me?.effects||[];
  if(!list.length){
    const li=document.createElement('li');li.className='muted';li.textContent='지금은 특별한 효과가 없어요.';
    $('self-effects').replaceChildren(li);return;
  }
  $('self-effects').replaceChildren(...list.map(e=>{const li=document.createElement('li');li.textContent=effectText(e);return li;}));
}
async function openUseDialog(item){
  if(item.level>myLevel()){toast('캐릭터의 lv보다 높은 아이템으로 사용할 수 없습니다');return;}
  const me=room?.players.find(p=>p.id===selfId);
  if(me?.effects?.some(effect=>effect.itemId==='little-sun-card'&&(effect.until||0)>Date.now())&&item.mode!=='moon'){
    toast('자외선 상태라 오늘 자정까지 아이템을 사용할 수 없어요. 꼬마 달은 사용할 수 있어요.');return;
  }
  if(item.mode==='draw'){
    stop();$('draw-dialog').showModal();await loadRabbitDraw();return;
  }
  if(item.mode==='moon'&&me?.avatar?.blackStar){toast('검은별 상태에서는 꼬마 달을 사용할 수 없어요.');return;}
  let meteorOptions=[];
  if(item.mode==='meteor'){
    try{meteorOptions=(await request('item:meteor:options',{})).planets||[];}catch(error){toast(error.message);return;}
    if(!meteorOptions.length){toast('다른 부서에서 받은 활성 경고가 없어요.');return;}
  }
  useItem=item;
  $('use-title').textContent=item.icon+' '+item.name+' 사용하기';
  $('use-description').textContent=item.description;
  $('use-effect').textContent=itemUseText(item);
  $('use-special').textContent=item.special||'';$('use-special').hidden=!item.special;
  $('use-secret-note').hidden=!item.secret;
  const others=['any','other','pair'].includes(item.targets)?room.players.filter(p=>p.id!==selfId&&p.connected&&p.role!=='teacher'):[];
  if(item.targets==='other'&&!others.length){toast('지금 아이템을 사용할 친구가 없어요.');return;}
  if(item.targets==='pair'&&others.length+(me?.role==='student'?1:0)<2){toast('자리를 바꿀 학생 친구 2명이 필요해요.');return;}
  const targets=[...(item.targets==='other'||(item.targets==='pair'&&me?.role!=='student')?[]:[{value:selfId,label:'나에게'}]),...others.map(p=>({value:p.id,label:p.nickname}))];
  $('use-target').replaceChildren(...targets.map(o=>{
    const opt=document.createElement('option');opt.value=o.value;opt.textContent=o.label;return opt;
  }));
  $('use-second-target-row').hidden=item.targets!=='pair';
  $('use-second-target').replaceChildren(...targets.map(o=>{const opt=document.createElement('option');opt.value=o.value;opt.textContent=o.label;return opt;}));
  if(item.targets==='pair')$('use-second-target').value=targets.find(o=>o.value!==$('use-target').value)?.value||'';
  $('use-planet-row').hidden=item.mode!=='meteor';
  $('use-planet').replaceChildren(...meteorOptions.map(planet=>{
    const option=document.createElement('option');option.value=planet.id;option.textContent=planet.name+' · 내 경고 '+planet.count+'건';return option;
  }));
  stop();$('use-dialog').showModal();
}
$('use-confirm').onclick=async()=>{
  if(!useItem)return;
  const targetId=$('use-target').value;
  try{
    const reply=await request('item:use',{itemId:useItem.id,targetId,
      ...(useItem.targets==='pair'?{secondTargetId:$('use-second-target').value}:{}),
      ...(useItem.mode==='meteor'?{planetId:$('use-planet').value}:{})});
    const me=room?.players.find(p=>p.id===selfId);
    // reply.effects는 '대상'의 효과 목록입니다. 친구에게 썼을 때 이것을 내 효과로 넣으면
    // 다음 스냅샷이 올 때까지 친구의 효과가 내 카드에 잘못 보이므로, 나에게 쓴 경우에만 반영합니다.
    if(me){me.inventory=reply.inventory;if(targetId===selfId)me.effects=reply.effects;}
    renderBag(reply.inventory);renderSelfEffects(me);
    if(room)world.setRoom(room,selfId);
    toast(useItem.name+'을(를) 썼어요.');
    $('use-dialog').close();
  }catch(e){toast(e.message);}
};
$('use-cancel').onclick=()=>$('use-dialog').close();
$('use-dialog').addEventListener('close',()=>{useItem=null;$('world').focus();});
let rabbitDraw=null,rabbitPicked=false;
function renderRabbitDraw(){
  $('draw-start').hidden=!!rabbitDraw||rabbitPicked;
  $('draw-message').textContent=rabbitPicked?'뽑기를 마쳤어요. 별 파편은 가방에 바로 들어왔어요.':
    rabbitDraw?'뒷면 카드 10장 중 한 장을 골라보세요. 창을 닫아도 이어서 고를 수 있어요.':
      '10장 중 한 장을 골라 별 파편 1~10개를 받아요. 장기 평균은 3개예요.';
  $('draw-spread').replaceChildren(...(rabbitDraw?.cards||[]).map((card,index)=>{
    const button=document.createElement('button');button.type='button';button.className='draw-card';
    button.textContent='✦ ?';button.setAttribute('aria-label',`${index+1}번 뒷면 카드`);
    button.onclick=async()=>{if(!rabbitDraw)return;[...$('draw-spread').children].forEach(child=>child.disabled=true);
      try{const result=await request('draw:pick',{drawId:rabbitDraw.id,cardId:card.id});
        rabbitDraw=null;rabbitPicked=true;button.classList.add('revealed');button.textContent='★ '+result.reward;
        $('draw-message').textContent='별 파편 '+result.reward+'개 당첨! 지금 '+result.starShards+'개를 가지고 있어요.';
        const me=room?.players.find(p=>p.id===selfId);if(me)me.starShards=result.starShards;
      }catch(error){toast(error.message);[...$('draw-spread').children].forEach(child=>child.disabled=false);}};
    return button;
  }));
}
async function loadRabbitDraw(){
  try{rabbitDraw=(await request('draw:status',{})).draw;rabbitPicked=false;renderRabbitDraw();}
  catch(error){toast(error.message);$('draw-dialog').close();}
}
$('draw-start').onclick=async()=>{const button=$('draw-start');button.disabled=true;
  try{const result=await request('draw:start',{});rabbitDraw=result.draw;rabbitPicked=false;
    const me=room?.players.find(p=>p.id===selfId);if(me)me.inventory=result.inventory;renderBag(result.inventory);renderRabbitDraw();}
  catch(error){toast(error.message);}finally{button.disabled=false;}};
$('draw-resume').onclick=async()=>{stop();$('draw-dialog').showModal();await loadRabbitDraw();};
$('draw-close').onclick=()=>$('draw-dialog').close();
$('draw-dialog').addEventListener('close',()=>$('world').focus());
function summarizeTrade(side){
  const parts=[];
  if(side?.shards)parts.push('★'+side.shards);
  for(const it of side?.items||[]){const item=itemOf(it.id);if(item)parts.push(item.icon+'×'+it.quantity);}
  return parts.length?parts.join(' '):'없음';
}
function tradeSignature(){return myInventory().map(e=>e.id+':'+e.quantity).join(',')+'|'+(room?.players||[]).filter(p=>p.role!=='teacher').map(p=>p.id+':'+p.connected).join(',');}
function updateTradesList(){
  if(!room)return;
  const trades=room.trades||[];
  const mine=trades.filter(t=>t.fromId===selfId||t.toId===selfId);
  const incomingIds=new Set(trades.filter(t=>t.toId===selfId&&t.status==='proposed').map(t=>t.id));
  for(const id of incomingIds)if(!knownIncomingTradeIds.has(id))toast('친구가 거래를 제안했어요. 가방 탭에서 확인해요.');
  knownIncomingTradeIds=incomingIds;
  $('trades-empty').hidden=mine.length>0;
  $('trades').replaceChildren(...mine.map(t=>{
    const li=document.createElement('li');
    const isSender=t.fromId===selfId,otherName=isSender?t.toNickname:t.fromNickname;
    const title=document.createElement('strong');title.textContent=otherName+' 친구와의 거래';
    const giveSide=isSender?t.give:t.want,getSide=isSender?t.want:t.give;
    const giveP=document.createElement('p');giveP.className='muted';giveP.textContent='내가 주는 것: '+summarizeTrade(giveSide);
    const getP=document.createElement('p');getP.className='muted';getP.textContent='내가 받는 것: '+summarizeTrade(getSide);
    const status=document.createElement('p');status.className='muted';
    const actions=document.createElement('div');actions.className='trade-actions';
    if(t.status==='proposed'&&t.toId===selfId){
      status.textContent='친구가 제안했어요';
      const accept=document.createElement('button');accept.type='button';accept.className='small primary trade-accept';accept.textContent='수락';
      accept.onclick=async()=>{try{await request('trade:respond',{tradeId:t.id,accept:true});}catch(e){toast(e.message);}};
      const decline=document.createElement('button');decline.type='button';decline.className='small secondary trade-decline';decline.textContent='거절';
      decline.onclick=async()=>{try{await request('trade:respond',{tradeId:t.id,accept:false});}catch(e){toast(e.message);}};
      actions.append(accept,decline);
    }else if(t.status==='proposed'){
      status.textContent='친구 수락 기다리는 중';
      const cancel=document.createElement('button');cancel.type='button';cancel.className='small secondary trade-cancel';cancel.textContent='취소';
      cancel.onclick=async()=>{try{await request('trade:cancel',{tradeId:t.id});}catch(e){toast(e.message);}};
      actions.append(cancel);
    }else if(t.status==='accepted'){
      status.textContent='선생님 승인 기다리는 중';
      const cancel=document.createElement('button');cancel.type='button';cancel.className='small secondary trade-cancel';cancel.textContent='취소';
      cancel.onclick=async()=>{try{await request('trade:cancel',{tradeId:t.id});}catch(e){toast(e.message);}};
      actions.append(cancel);
    }
    li.append(title,giveP,getP,status,actions);
    return li;
  }));
}
function renderTradeTargetOptions(){
  if(!room)return;
  const select=$('trade-target'),prev=select.value;
  const students=room.players.filter(p=>p.id!==selfId&&p.connected&&p.role!=='teacher');
  select.replaceChildren(...students.map(p=>{const opt=document.createElement('option');opt.value=p.id;opt.textContent=p.nickname;return opt;}));
  if([...select.options].some(o=>o.value===prev))select.value=prev;
}
// 목록을 다시 그릴 때 체크 상태와 입력 중인 수량을 유지합니다.
function rerenderPickList(list,build){
  const prev=new Map([...list.querySelectorAll('li.item')].map(li=>[li.dataset.itemId,{checked:li.querySelector('.pick')?.checked,qty:li.querySelector('.qty')?.value}]));
  list.replaceChildren(...build());
  for(const li of list.querySelectorAll('li.item')){
    const p=prev.get(li.dataset.itemId);if(!p)continue;
    const pick=li.querySelector('.pick');if(pick)pick.checked=Boolean(p.checked);
    const qty=li.querySelector('.qty');if(qty&&p.qty)qty.value=p.qty;
  }
}
function tradePickRow(item,maxQty){
  const li=document.createElement('li');li.className='item';li.dataset.itemId=item.id;
  const pick=document.createElement('input');pick.type='checkbox';pick.className='pick';pick.setAttribute('aria-label',item.name+' 선택');
  const icon=document.createElement('span');icon.className='icon';icon.textContent=item.icon;
  const name=document.createElement('span');name.className='name';name.textContent=item.name;
  const qty=document.createElement('input');qty.type='number';qty.className='qty';qty.min='1';qty.max=String(maxQty);qty.value='1';qty.setAttribute('aria-label','수량');
  li.append(pick,icon,name,qty);
  return li;
}
function renderTradeGiveItems(){
  rerenderPickList($('trade-give-items'),()=>myInventory().map(entry=>{
    const item=itemOf(entry.id);return item?tradePickRow(item,entry.quantity):null;
  }).filter(Boolean));
}
function renderTradeWantItems(){
  rerenderPickList($('trade-want-items'),()=>SHOP.items.map(item=>tradePickRow(item,99)));
}
function collectPicks(list){
  return [...list.querySelectorAll('li.item')].filter(li=>li.querySelector('.pick')?.checked)
    .map(li=>({id:li.dataset.itemId,quantity:Math.max(1,Math.round(Number(li.querySelector('.qty')?.value))||1)}));
}
function openTradeDialog(){
  $('trade-error').textContent='';$('trade-give-shards').value='0';$('trade-want-shards').value='0';
  renderTradeTargetOptions();renderTradeGiveItems();renderTradeWantItems();
  tradeDialogSig=tradeSignature();
  stop();$('trade-dialog').showModal();
}
$('trade-new').onclick=()=>openTradeDialog();
$('trade-submit').onclick=async()=>{
  $('trade-error').textContent='';
  const targetId=$('trade-target').value;
  if(!targetId){$('trade-error').textContent='거래할 친구를 골라주세요.';return;}
  const give={shards:Number($('trade-give-shards').value)||0,items:collectPicks($('trade-give-items'))};
  const want={shards:Number($('trade-want-shards').value)||0,items:collectPicks($('trade-want-items'))};
  if(give.items.length>TRADE.maxItemKinds||want.items.length>TRADE.maxItemKinds){
    $('trade-error').textContent='한쪽에 최대 '+TRADE.maxItemKinds+'종까지 고를 수 있어요.';return;
  }
  try{
    await request('trade:propose',{targetId,give,want});
    $('trade-dialog').close();toast('거래를 제안했어요.');
  }catch(e){$('trade-error').textContent=e.message;}
};
$('trade-cancel-btn').onclick=()=>$('trade-dialog').close();
$('trade-dialog').addEventListener('close',()=>{tradeDialogSig='';$('world').focus();});
function updateTeacherPanels(isTeacher){
  const trades=room?.trades||[];
  $('teacher-trades-empty').hidden=!isTeacher||trades.length>0;
  $('teacher-trades').replaceChildren(...(!isTeacher?[]:trades.map(t=>{
    const li=document.createElement('li');
    const title=document.createElement('strong');title.textContent=t.fromNickname+' → '+t.toNickname;
    const give=document.createElement('p');give.className='muted';give.textContent='주는 것: '+summarizeTrade(t.give);
    const want=document.createElement('p');want.className='muted';want.textContent='받는 것: '+summarizeTrade(t.want);
    const status=document.createElement('p');status.className='muted';status.textContent=t.status==='proposed'?'친구 수락 기다리는 중':'승인 대기';
    const actions=document.createElement('div');actions.className='trade-actions';
    // 주는 것 없이 받기만 하는 거래는 강요일 수 있어 선생님에게 눈에 띄게 표시합니다.
    const oneSided=(t.give?.shards||0)===0&&!(t.give?.items||[]).length&&((t.want?.shards||0)>0||(t.want?.items||[]).length>0);
    if(oneSided){const warn=document.createElement('p');warn.className='trade-warning';warn.textContent='⚠ 한쪽만 받는 거래예요. 억지로 요구한 것은 아닌지 확인해 주세요.';li.append(warn);}
    if(t.status==='accepted'){
      const approve=document.createElement('button');approve.type='button';approve.className='small primary approve-trade';approve.textContent='승인';
      approve.onclick=async()=>{try{await request('trade:approve',{tradeId:t.id});}catch(e){toast(e.message);}};
      actions.append(approve);
    }
    const reject=document.createElement('button');reject.type='button';reject.className='small secondary reject-trade';reject.textContent='거절';
    reject.onclick=async()=>{try{await request('trade:reject',{tradeId:t.id});}catch(e){toast(e.message);}};
    actions.append(reject);
    li.append(title,give,want,status,actions);
    return li;
  })));
  if(!isTeacher){$('item-log').replaceChildren();$('item-log-empty').hidden=true;return;}
  const entries=[
    ...(room?.itemLog||[]).map(e=>({at:e.at,text:fmtTime(e.at)+' '+e.userNickname+' → '+e.targetNickname+': '+e.itemName+(e.secret?' (비밀)':'')})),
    ...(room?.tradeLog||[]).map(e=>({at:e.at,text:fmtTime(e.at)+' 거래 '+e.fromNickname+'↔'+e.toNickname+': '+(e.result==='approved'?'승인':'거절')}))
  ].sort((a,b)=>b.at-a.at).slice(0,20);
  $('item-log-empty').hidden=entries.length>0;
  $('item-log').replaceChildren(...entries.map(e=>{const li=document.createElement('li');li.textContent=e.text;return li;}));
}
function updateTeacherBadge(isTeacher){
  const proposals=room?.proposals||[];
  const pendingTrades=(room?.trades||[]).filter(t=>t.status==='accepted').length;
  const total=proposals.length+pendingTrades;
  $('teacher-badge').hidden=!isTeacher||total===0;$('teacher-badge').textContent=String(total);
}
function updateShardsTargetOptions(){
  const select=$('shards-target'),prev=select.value;
  const students=room.players.filter(p=>p.role!=='teacher');
  select.replaceChildren(...[{value:'all',label:'모두에게'},...students.map(p=>({value:p.id,label:p.nickname}))].map(o=>{
    const opt=document.createElement('option');opt.value=o.value;opt.textContent=o.label;return opt;
  }));
  if([...select.options].some(o=>o.value===prev))select.value=prev;
}
function updatePinTargetOptions(){
  const select=$('pin-target'),prev=select.value;
  const students=(room?.players||[]).filter(p=>p.role!=='teacher');
  select.replaceChildren(...students.map(p=>{const opt=document.createElement('option');opt.value=p.id;opt.textContent=p.nickname+(p.away?' · 수업 밖':'');return opt;}));
  if([...select.options].some(o=>o.value===prev))select.value=prev;
}
let lastProposalCount=0;
function updateProposalsPanel(isTeacher){
  const proposals=room.proposals||[];
  // 선생님이 친구 목록 아래의 신청 패널을 놓치지 않도록 새 신청이 오면 알려 줍니다.
  if(isTeacher&&proposals.length>lastProposalCount)toast('새 행성 신청이 왔어요. "선생님 도구"에서 승인하거나 돌려보내 주세요.');
  lastProposalCount=proposals.length;
  $('proposals-empty').hidden=proposals.length>0;
  $('proposals').replaceChildren(...proposals.map(p=>{
    const li=document.createElement('li');
    const strong=document.createElement('strong');strong.textContent=p.name;
    const who=document.createElement('span');who.textContent='신청: '+p.nickname;
    const small=document.createElement('small');small.textContent=p.description||'';
    li.append(strong,who,small);
    if(isTeacher){
      const approve=document.createElement('button');approve.type='button';approve.className='small primary approve';approve.dataset.proposalId=p.id;approve.textContent='승인';
      approve.onclick=async()=>{try{await request('planet:approve',{proposalId:p.id});}catch(e){toast(e.message);}};
      const reject=document.createElement('button');reject.type='button';reject.className='small secondary reject';reject.dataset.proposalId=p.id;reject.textContent='돌려보내기';
      reject.onclick=async()=>{try{await request('planet:reject',{proposalId:p.id});}catch(e){toast(e.message);}};
      li.append(approve,reject);
    }else if(p.playerId===selfId){
      const withdraw=document.createElement('button');withdraw.type='button';withdraw.className='small secondary withdraw';withdraw.dataset.proposalId=p.id;withdraw.textContent='취소';
      withdraw.onclick=async()=>{try{await request('planet:withdraw',{proposalId:p.id});}catch(e){toast(e.message);}};
      li.append(withdraw);
    }
    return li;
  }));
}
function updateChatUI(me,isTeacher){
  const enabled=room.chat?.enabled!==false;
  $('chat-teacher-controls').hidden=!isTeacher;
  $('chat-toggle').textContent=enabled?'채팅 끄기':'채팅 켜기';
  if(isTeacher){
    $('chat-input').disabled=false;$('chat-input').placeholder='친구들에게 말해요 (Enter)';$('chat-status').textContent=enabled?'켜짐':'꺼짐 · 선생님만 말할 수 있어요';
  }else if(!enabled){
    $('chat-input').disabled=true;$('chat-input').placeholder='선생님이 채팅을 껐어요';$('chat-status').textContent='꺼짐';
  }else if(me?.muted){
    $('chat-input').disabled=true;$('chat-input').placeholder='선생님이 내 채팅을 잠시 멈췄어요';$('chat-status').textContent='내 채팅 멈춤';
  }else{
    $('chat-input').disabled=false;$('chat-input').placeholder='친구들에게 말해요 (Enter)';$('chat-status').textContent='켜짐';
  }
  $('chat-send').disabled=chatBusy||$('chat-input').disabled;
}
function renderPlanetDialog(planetId){
  if(!room)return;
  const planet=planetById(planetId);
  if(!planet){if($('planet-dialog').open)$('planet-dialog').close();return;}
  const me=room.players.find(p=>p.id===selfId),isTeacher=me?.role==='teacher';
  const dialogTemplate=templateOf(planet.templateId);
  $('planet-title').textContent=(dialogTemplate?dialogTemplate.icon+' ':'')+planet.name;
  $('planet-description').textContent=planet.description||'소개가 아직 없어요.';
  $('planet-member-count').textContent='소속 친구 '+(planet.memberCount||0)+'명';
  departmentButton.hidden=!(isTeacher||me?.departmentId===planetId);
  departmentButton.textContent=isTeacher&&planet.reportPending?'실적제출확인요함 · 확인하고 별 주기':'부서실적 · 분배하기 · 분배결과';
  const members=room.players.filter(p=>p.departmentId===planetId);
  $('planet-members-empty').hidden=members.length>0;
  $('planet-members').replaceChildren(...members.map(p=>{
    const li=document.createElement('li');
    li.textContent=p.nickname+(p.id===selfId?' · 나':'')+(p.mapId===interiorIdOf(planetId)?' · 안에 있어요':'');
    return li;
  }));
  const rules=planet.rules||[];
  $('planet-rules-list').replaceChildren(...rules.map(line=>{const li=document.createElement('li');li.textContent=line;return li;}));
  $('planet-rules-input').value=rules.join('\n');
  $('planet-rules-editor').hidden=true; // 외부/행성 정보는 읽기 전용, 내부 규칙판에서만 편집합니다.
  $('planet-enter').hidden=!(isTeacher||me?.departmentId===planetId)||me?.mapId!==PLAZA_ID;
  $('planet-join').hidden=isTeacher||me?.departmentId===planetId;
  $('planet-join').textContent=(!isTeacher&&me?.departmentId&&me.departmentId!==planetId)?(planetById(me.departmentId)?.name||'')+'에서 옮겨오기':'가입하기';
  $('planet-leave-dept').hidden=isTeacher||me?.departmentId!==planetId;
  renderPlanetRename(planet,me,isTeacher);
}
function renderPlanetRename(planet,me,isTeacher){
  const isMember=!isTeacher&&me?.departmentId===planet.id;
  $('planet-rename').hidden=!(isTeacher||isMember);
  const rename=planet.rename;
  $('planet-rename-propose-row').hidden=!(isMember&&!rename);
  $('planet-rename-status').hidden=!rename;
  $('planet-rename-votes').hidden=!(rename&&isMember);
  if(rename){
    $('planet-rename-status').textContent='이름을 "'+rename.name+'"(으)로 바꿀까요? 지금 찬성 '+rename.yes+'명 · 반대 '+rename.no+'명. 우리 행성 친구 '+rename.needed+'명이 찬성하면 바뀌어요. (제안: '+rename.proposedByNickname+')';
    if(isMember){
      const myVote=rename.votes?.[selfId];
      $('planet-vote-yes').classList.toggle('selected',myVote===true);
      $('planet-vote-no').classList.toggle('selected',myVote===false);
    }
  }
  $('planet-rename-teacher-row').hidden=!isTeacher;
  $('planet-remove').hidden=!isTeacher;
}
function openPlanetDialog(planetId){
  if(!planetById(planetId))return;
  planetDialogId=planetId;$('planet-rules').hidden=true;$('planet-rename-input').value='';$('planet-rename-teacher').value='';
  renderPlanetDialog(planetId);stop();
  if(!$('planet-dialog').open)$('planet-dialog').showModal();
}
$('planet-info').onclick=()=>{
  const me=room?.players.find(p=>p.id===selfId);
  const planetId=planetIdOfMap(me?.mapId||PLAZA_ID);
  if(planetId)openPlanetDialog(planetId);
};
$('planet-rename-propose').onclick=async()=>{
  const name=$('planet-rename-input').value.trim();if(!name)return;
  try{await request('planet:rename:propose',{planetId:planetDialogId,name});$('planet-rename-input').value='';}
  catch(e){toast(e.message);}
};
$('planet-vote-yes').onclick=async()=>{try{await request('planet:rename:vote',{planetId:planetDialogId,agree:true});}catch(e){toast(e.message);}};
$('planet-vote-no').onclick=async()=>{try{await request('planet:rename:vote',{planetId:planetDialogId,agree:false});}catch(e){toast(e.message);}};
$('planet-rename-set').onclick=async()=>{
  const name=$('planet-rename-teacher').value.trim();if(!name)return;
  try{await request('planet:rename:set',{planetId:planetDialogId,name});$('planet-rename-teacher').value='';toast('이름을 바꿨어요.');}
  catch(e){toast(e.message);}
};
$('planet-remove').onclick=async()=>{
  const planet=planetById(planetDialogId);if(!planet)return;
  if(!confirm('"'+planet.name+'" 행성을 없앨까요? 소속 친구들은 광장으로 나와요.'))return;
  try{await request('planet:remove',{planetId:planetDialogId});$('planet-dialog').close();}
  catch(e){toast(e.message);}
};
$('planet-rules-toggle').onclick=()=>{
  const show=$('planet-rules').hidden;$('planet-rules').hidden=!show;
  if(show&&planetDialogId)renderPlanetDialog(planetDialogId);
};
$('planet-close').onclick=()=>$('planet-dialog').close();
$('planet-dialog').addEventListener('close',()=>{planetDialogId=null;$('world').focus();});
$('black-hole-info-close').onclick=()=>$('black-hole-info-dialog').close();
$('black-hole-info-dialog').addEventListener('close',()=>$('world').focus());
$('planet-join').onclick=async()=>{try{await request('planet:join',{planetId:planetDialogId});}catch(e){toast(e.message);}};
$('planet-leave-dept').onclick=async()=>{try{await request('planet:leave',{planetId:planetDialogId});}catch(e){toast(e.message);}};
$('planet-enter').onclick=async()=>{
  try{await request('planet:enter',{planetId:planetDialogId});$('planet-dialog').close();}
  catch(e){toast(e.message);}
};
$('planet-rules-save').onclick=async()=>{
  const rules=$('planet-rules-input').value.split('\n').map(s=>s.trim()).filter(Boolean);
  try{await request('planet:rules:set',{planetId:planetDialogId,rules});toast('규칙을 저장했어요.');}
  catch(e){toast(e.message);}
};
async function exitPlanet(){try{await request('planet:exit',{});}catch(e){toast(e.message);}}
$('planet-exit').onclick=exitPlanet;
async function travelTo(to){try{await request('map:travel',{to});}catch(e){toast(e.message);}}
function doInteract(){
  if(!selfId||placing||document.querySelector('dialog[open]'))return;
  const n=world.nearby();if(!n)return;
  if(n.kind==='planet')openPlanetDialog(n.id);
  else if(n.kind==='door')exitPlanet();
  else if(n.kind==='gate')travelTo(n.target);
  else if(n.kind==='black-hole')travelTo(n.target);
  else if(n.kind==='black-star'){stop();$('black-hole-info-dialog').showModal();}
  else if(n.kind==='shop')openShopDialog();
  else if(n.kind==='pillar')temple.open(n);
  else if(n.kind==='monster')monsterUI.open(n.id);
  else if(n.kind==='board')rulesUI.open(n.id);
  else if(n.kind==='evolution')evolutionUI.open();
  else if(n.kind==='growth')growthUI.open();
  else if(n.kind==='report-board')departmentWork.open(n.id);
  else if(n.kind==='warning-rock')warningUI.open(n.id,room?.players.find(p=>p.id===selfId)?.role==='student');
  else if(n.kind==='andromeda')assignmentUI.open();
  else if(n.kind==='arcade'){stop();request('arcade:open',{objectId:n.id}).then(r=>{if(selfId&&!document.querySelector('dialog[open]'))arcade.open(r.gameId);}).catch(e=>toast(e.message));}
}
$('interact-prompt').onclick=doInteract;
$('touch-interact').onclick=doInteract;
$('interior-decorate').onclick=()=>{
  if(!selfId||placing||document.querySelector('dialog[open]'))return;
  const nearby=world.nearby(),planetId=planetIdOfMap(world.currentMapId());
  const me=room?.players.find(player=>player.id===selfId);
  if(nearby&&planetId&&interiorDecorObject(nearby.kind)&&(me?.role==='teacher'||me?.departmentId===planetId))interiorDecor.open(planetId,nearby.kind);
};
function updateInteractPrompt(){
  const prompt=$('interact-prompt'),touchButton=$('touch-interact'),decorate=$('interior-decorate');
  const hide=()=>{if(!prompt.hidden)prompt.hidden=true;if(!decorate.hidden)decorate.hidden=true;if(!touchButton.disabled)touchButton.disabled=true;};
  if(!selfId||placing||document.querySelector('dialog[open]')){hide();return;}
  const n=world.nearby();
  if(!n){hide();return;}
  const label=n.kind==='door'?'광장으로 나가기':n.kind==='shop'?'별상점 구경하기':n.name;
  const caption=$('interact-object');
  if(caption.textContent!==label){caption.textContent=label;touchButton.setAttribute('aria-label',label+' · E 상호작용하기');}
  if(prompt.hidden)prompt.hidden=false;
  if(touchButton.disabled)touchButton.disabled=false;
  const point=world.screenPoint(n),width=prompt.offsetWidth,height=prompt.offsetHeight,gap=12;
  let x=Math.max(8,Math.min(innerWidth-width-8,point.x-width/2));
  let y=point.y-(n.radius||0)*point.scale-height-gap;
  const navigation=$('world-navigation').getBoundingClientRect();
  // 맵 상단과 미니맵에 가려지는 경우에는 같은 물체 바로 아래에 붙입니다.
  if(y<8||(x<navigation.right&&x+width>navigation.left&&y<navigation.bottom&&y+height>navigation.top))
    y=point.y+(n.radius||0)*point.scale+gap;
  y=Math.max(8,Math.min(innerHeight-height-8,y));
  // 좌표만 바뀔 때 레이아웃을 다시 계산하지 않도록 합성 이동을 사용합니다.
  prompt.style.transform='translate3d('+x+'px,'+y+'px,0)';
  const planetId=planetIdOfMap(world.currentMapId()),me=room?.players.find(player=>player.id===selfId);
  const canDecorate=!!(planetId&&interiorDecorObject(n.kind)&&(me?.role==='teacher'||me?.departmentId===planetId));
  decorate.hidden=!canDecorate;
  if(canDecorate){
    const decorWidth=decorate.offsetWidth,decorHeight=decorate.offsetHeight;
    const dx=Math.max(8,Math.min(innerWidth-decorWidth-8,x+(width-decorWidth)/2));
    const below=y+height+5,dy=below+decorHeight+8<=innerHeight?below:Math.max(8,y-decorHeight-5);
    decorate.style.transform='translate3d('+dx+'px,'+dy+'px,0)';
  }
  const objectId=n.id||n.target||n.kind;if(prompt.dataset.objectId!==objectId)prompt.dataset.objectId=objectId;
}
window.addEventListener('keydown',e=>{
  if(e.code!=='KeyE'||!selfId||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','BUTTON'].includes(e.target.tagName))return;
  e.preventDefault();doInteract();
});
function startPlacement(){world.setPlacing(true);
  placing=true;document.body.classList.add('placing');
  $('map-caption').textContent='✦ 지도에서 행성을 만들 자리를 눌러주세요 (Esc 취소)';
  $('planet-new').textContent='취소';
}
function stopPlacement(){
  placing=false;document.body.classList.remove('placing');
  $('planet-new').textContent='행성 만들기';world.setPlacement(null);world.setPlacing(false);
  if(room&&!$('planet-create-dialog').open)$('map-caption').textContent=mapCaption(room.players.find(p=>p.id===selfId)?.mapId||PLAZA_ID);
}
$('planet-new').onclick=()=>{placing?stopPlacement():startPlacement();$('world').focus();};
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&placing)stopPlacement();});
function openPlanetCreateDialog(point){
  const isTeacher=room?.players.find(p=>p.id===selfId)?.role==='teacher';
  createPoint=point;
  $('planet-create-title').textContent=isTeacher?'새 행성 만들기':'새 행성 신청하기';
  $('planet-create-hint').textContent='행성은 우리 반의 역할이에요. 어떤 역할의 행성인지 이름과 소개를 적어요.'+(isTeacher?'':' 선생님이 승인하면 행성이 생기고, 내가 첫 멤버가 돼요.');
  $('planet-name').value='';$('planet-desc').value='';$('planet-create-error').textContent='';
  for(const label of $('planet-types').querySelectorAll('label.type')){label.querySelector('input').checked=false;label.classList.remove('selected');}
  const firstColor=$('planet-colors').querySelector('input');if(firstColor)firstColor.checked=true;
  $('planet-create-submit').textContent=isTeacher?'만들기':'신청하기';
  stop();$('planet-create-dialog').showModal();
}
$('planet-create-cancel').onclick=()=>$('planet-create-dialog').close();
$('planet-create-dialog').addEventListener('close',()=>{world.setPlacement(null);$('map-caption').textContent=mapCaption(room?.players.find(p=>p.id===selfId)?.mapId||PLAZA_ID);$('world').focus();});
$('planet-create-submit').onclick=async()=>{
  const templateId=$('planet-types').querySelector('input:checked')?.value;
  if(!templateId){$('planet-create-error').textContent='행성 종류를 골라주세요.';return;}
  const name=$('planet-name').value.trim(),description=$('planet-desc').value.trim();
  const color=$('planet-colors').querySelector('input:checked')?.value||PLANET_COLORS[0];
  const isTeacher=room?.players.find(p=>p.id===selfId)?.role==='teacher';
  if(!createPoint)return;
  try{
    await request(isTeacher?'planet:create':'planet:propose',{name,description,x:createPoint.x,y:createPoint.y,color,templateId});
    $('planet-create-dialog').close();
    toast(isTeacher?'행성을 만들었어요.':'행성을 신청했어요. 선생님의 승인을 기다려요.');
  }catch(e){$('planet-create-error').textContent=e.message;}
};
$('crew-button').onclick=()=>{stop();$('crew-dialog').showModal();};
$('crew-close').onclick=()=>$('crew-dialog').close();
$('crew-dialog').addEventListener('close',()=>$('world').focus());
$('teacher-tools').onclick=()=>{updateShardsTargetOptions();$('shards-feedback').textContent='';stop();$('teacher-dialog').showModal();};
$('teacher-close').onclick=()=>$('teacher-dialog').close();
$('teacher-leave').onclick=()=>{$('teacher-dialog').close();$('leave').click();};
$('teacher-dialog').addEventListener('close',()=>$('world').focus());
$('shards-give').onclick=async()=>{
  if($('shards-give').disabled)return;
  const playerId=$('shards-target').value,amount=Number($('shards-amount').value);
  $('shards-give').disabled=true;$('shards-feedback').textContent='';
  // 모달 뒤에 가려지는 토스트 대신 지급 버튼 옆에도 서버 처리 결과를 남깁니다.
  try{await request('shards:give',{playerId,amount});const message=amount<0?'별 파편을 거두었습니다.':'지급되었습니다';$('shards-feedback').textContent=message;toast(message);}
  catch(e){$('shards-feedback').textContent=e.message;toast(e.message);}
  finally{$('shards-give').disabled=false;}
};
$('pin-save').onclick=async()=>{
  const pin=$('reset-pin').value;
  if(!/^\d{4}$/.test(pin)){toast('비밀번호는 숫자 4자리로 입력해 주세요.');return;}
  try{await request('student:pin:set',{playerId:$('pin-target').value,pin});$('reset-pin').value='';toast('학생 비밀번호를 바꿨어요.');}
  catch(e){toast(e.message);}
};
function myShards(){return room?.players.find(p=>p.id===selfId)?.starShards||0;}
function myInventory(){return room?.players.find(p=>p.id===selfId)?.inventory||[];}
function updateShopShards(){const n=myShards();$('shop-shards').textContent='내 별 파편 ★ '+n+(n===0?' · 별 파편은 선생님이 나눠 줘요':'');}
// 목록을 다시 그릴 때 입력 중인 수량과 스크롤 위치를 유지합니다.
function rerenderList(list,build){
  const prev=new Map([...list.querySelectorAll('li.item')].map(li=>[li.dataset.itemId,li.querySelector('.qty')?.value]));
  const top=list.scrollTop;
  list.replaceChildren(...build());
  for(const li of list.querySelectorAll('li.item')){const q=li.querySelector('.qty');if(q&&prev.has(li.dataset.itemId))q.value=prev.get(li.dataset.itemId);}
  list.scrollTop=top;
}
function setShopTab(tab){
  $('shop-tab-buy').classList.toggle('selected',tab==='buy');$('shop-tab-buy').setAttribute('aria-selected',String(tab==='buy'));
  $('shop-tab-sell').classList.toggle('selected',tab==='sell');$('shop-tab-sell').setAttribute('aria-selected',String(tab==='sell'));
  $('shop-buy-list').hidden=tab!=='buy';$('shop-sell-list').hidden=tab!=='sell';
  $('shop-sell-empty').hidden=tab!=='sell'||myInventory().length>0;
}
$('shop-tab-buy').onclick=()=>setShopTab('buy');$('shop-tab-sell').onclick=()=>setShopTab('sell');
function shopQty(input){const q=Math.max(1,Math.min(10,Math.round(Number(input.value))||1));input.value=String(q);return q;}
function applyShopAck(reply){
  const me=room?.players.find(p=>p.id===selfId);
  if(me){me.starShards=reply.starShards;me.inventory=reply.inventory;}
  $('self-shards').textContent=String(reply.starShards);
  shopSig=shopSignature();
  updateShopShards();renderShopBuyList();renderShopSellList();renderBag(reply.inventory);
}
function renderShopBuyList(){
  const shards=myShards();
  rerenderList($('shop-buy-list'),()=>SHOP.items.map(item=>{
    const li=document.createElement('li');li.className='item';li.dataset.itemId=item.id;
    if(item.art)li.classList.add('ppt-card');
    const icon=itemVisual(item);
    const info=document.createElement('div');info.className='info';
    const name=document.createElement('strong');name.textContent=item.name;
    const desc=document.createElement('p');desc.className='muted';desc.textContent=item.description;
    const meta=document.createElement('span');meta.className='meta';meta.textContent=(ITEM_TYPES[item.type]||item.type)+' · LV '+item.level;
    info.append(name,desc,meta);
    if(item.special){const special=document.createElement('p');special.className='muted item-special';special.textContent=item.special;info.append(special);}
    const row=document.createElement('div');row.className='item-actions';
    const price=document.createElement('span');price.className='price';price.textContent='★ '+item.price;
    const qty=document.createElement('input');qty.type='number';qty.min='1';qty.max='10';qty.value='1';qty.className='qty';qty.setAttribute('aria-label','수량');
    const buy=document.createElement('button');buy.type='button';buy.className='small primary buy';buy.dataset.itemId=item.id;buy.textContent='사기';
    if(shards<item.price){buy.disabled=true;buy.title='별 파편이 부족해요.';}
    buy.onclick=async()=>{
      const quantity=shopQty(qty);
      try{
        const reply=await request('shop:buy',{itemId:item.id,quantity});
        toast(item.name+' '+quantity+'개를 샀어요. 남은 별 파편 ★ '+reply.starShards);
        applyShopAck(reply);
      }catch(e){toast(e.message);}
    };
    row.append(price,qty,buy);li.append(icon,info,row);
    return li;
  }));
}
function renderShopSellList(){
  const inv=myInventory(),sellTabActive=!$('shop-sell-list').hidden;
  $('shop-sell-empty').hidden=inv.length>0||!sellTabActive;
  rerenderList($('shop-sell-list'),()=>inv.map(entry=>{
    const item=itemOf(entry.id);if(!item)return null;
    const li=document.createElement('li');li.className='item';li.dataset.itemId=item.id;
    const icon=itemVisual(item);
    const info=document.createElement('div');info.className='info';
    const name=document.createElement('strong');name.textContent=item.name;
    const count=document.createElement('p');count.className='muted';count.textContent='가진 개수 '+entry.quantity;
    info.append(name,count);
    const row=document.createElement('div');row.className='item-actions';
    const sellPrice=Math.floor(item.price*SHOP.sellRate);
    const price=document.createElement('span');price.className='price';price.textContent='★ '+sellPrice;
    const qty=document.createElement('input');qty.type='number';qty.min='1';qty.max='10';qty.value='1';qty.className='qty';qty.setAttribute('aria-label','수량');
    const sell=document.createElement('button');sell.type='button';sell.className='small secondary sell';sell.dataset.itemId=item.id;sell.textContent='팔기';
    sell.onclick=async()=>{
      const quantity=shopQty(qty);
      try{
        const reply=await request('shop:sell',{itemId:item.id,quantity});
        toast(item.name+' '+quantity+'개를 팔았어요. 별 파편 ★ '+reply.starShards);
        applyShopAck(reply);
      }catch(e){toast(e.message);}
    };
    row.append(price,qty,sell);li.append(icon,info,row);
    return li;
  }).filter(Boolean));
}
function openShopDialog(){
  shopSig=shopSignature();setShopTab('buy');updateShopShards();renderShopBuyList();renderShopSellList();
  stop();$('shop-dialog').showModal();
}
$('shop-close').onclick=()=>$('shop-dialog').close();
$('shop-dialog').addEventListener('close',()=>$('world').focus());
const fmtTime=ms=>{const d=new Date(ms);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
function addChatMessage(msg){
  $('chat-empty').hidden=true;
  const li=document.createElement('li');
  if(msg.role==='system')li.classList.add('system');
  if(msg.playerId===selfId&&msg.role!=='system')li.classList.add('mine');
  if(msg.flagged)li.classList.add('flagged');
  if(msg.private)li.classList.add('private');
  const who=document.createElement('span');who.className='who';
  who.textContent=msg.role==='system'?'안내':msg.role==='teacher'?'선생님':msg.nickname;
  const text=document.createElement('span');text.className='text';text.textContent=msg.text;
  const time=document.createElement('span');time.className='time';time.textContent=fmtTime(msg.at);
  li.append(who,text,time);
  if(msg.flagged){const badge=document.createElement('span');badge.className='badge';badge.textContent='순화됨';li.append(badge);}
  if(msg.private){const badge=document.createElement('span');badge.className='badge private-badge';badge.textContent='나에게만';li.append(badge);}
  $('chat-log').append(li);
  while($('chat-log').children.length>200)$('chat-log').firstElementChild.remove();
  $('chat-log').scrollTop=$('chat-log').scrollHeight;
}
function clearChat(){$('chat-log').replaceChildren();$('chat-empty').hidden=false;}
function enter(result){
  social.reset();selfId=result.selfId;saveToken(result.token);updateRoom(result.room);$('lobby').hidden=true;
  $('menu-dialog').prepend($('connection'));
  $('room-badge').hidden=false;$('leave').hidden=false;$('touch-controls').hidden=false;$('chat-panel').hidden=false;
  $('crew-button').hidden=false;
  social.seed(result.chat?.messages);
  document.body.classList.add('joined');$('world').focus();$('form-message').textContent='';
  $('interact-prompt').hidden=true;$('interior-decorate').hidden=true;if($('planet-dialog').open)$('planet-dialog').close();
  if($('planet-create-dialog').open)$('planet-create-dialog').close();if(placing)stopPlacement();
  knownIncomingTradeIds=new Set();tradeDialogSig='';selectedSlotId=null;
  if($('use-dialog').open)$('use-dialog').close();if($('trade-dialog').open)$('trade-dialog').close();
}
function reset(message){
  accounts.reset();
  clearStudentAccountPins();
  universe.reset();overview=false;world.setOverview(false);$('map-area-view').textContent='현재 맵 한눈에 보기';
  social.reset();document.querySelector('.top-right').append($('connection'));
  stop();selfId=null;room=null;saveToken(null);world.setRoom(null,null);
  $('lobby').hidden=false;$('room-badge').hidden=true;$('leave').hidden=true;$('touch-controls').hidden=true;$('chat-panel').hidden=true;
  $('crew-button').hidden=true;$('teacher-tools').hidden=true;$('teacher-badge').hidden=true;
  $('players').replaceChildren();$('player-count').textContent='0 / 30';$('crew-count').textContent='0 / 30';$('crew-empty').hidden=false;
  clearChat();$('chat-input').value='';updateChatCount();$('chat-feedback').textContent='';$('chat-input').disabled=false;$('chat-input').placeholder='친구들에게 말해요 (Enter)';
  $('room-title').textContent='우리들의 우주 광장';$('self-name').textContent='나의 소행성';
  $('self-description').textContent='교실에 입장하면 내 소행성의 정보를 볼 수 있어요.';
  $('self-department').textContent='아직 소속 행성이 없어요. 행성 가까이 가서 E를 눌러보세요.';
  $('self-shards').textContent='0';$('bag-currency').hidden=false;
  $('self-effects').replaceChildren(Object.assign(document.createElement('li'),{className:'muted',textContent:'지금은 특별한 효과가 없어요.'}));
  $('self-level').textContent='LV 1 ★';$('card-foot').textContent='';
  $('self-form-name').textContent='소행성';
  $('self-constellation-type').hidden=true;$('self-constellation-type').textContent='';
  $('self-ability-panel').hidden=true;
  if($('ability-dialog').open)$('ability-dialog').close();
  $('avatar-card').style.removeProperty('--card-accent');$('avatar-card').classList.remove('teacher-card');
  {const portrait=$('avatar-portrait');portrait.getContext('2d').clearRect(0,0,portrait.width,portrait.height);}
  $('self-proposal').hidden=true;$('proposals-empty').hidden=false;$('proposals').replaceChildren();lastProposalCount=0;$('pin-panel').hidden=true;$('reset-pin').value='';
  $('planet-exit').hidden=true;$('planet-new').hidden=true;$('planet-info').hidden=true;$('interact-prompt').hidden=true;$('interior-decorate').hidden=true;$('map-caption').textContent='✦ 같은 교실의 친구들과 함께하는 공간';
  selectedSlotId=null;$('bag-list').replaceChildren();$('bag-empty').hidden=false;$('bag-detail').textContent='칸을 눌러 물건을 살펴봐요.';
  $('shop-buy-list').replaceChildren();$('shop-sell-list').replaceChildren();$('shop-sell-empty').hidden=true;
  $('trades').replaceChildren();$('trades-empty').hidden=false;
  $('teacher-trades').replaceChildren();$('teacher-trades-empty').hidden=false;
  $('item-log').replaceChildren();$('item-log-empty').hidden=false;
  knownIncomingTradeIds=new Set();tradeDialogSig='';useItem=null;
  if(placing)stopPlacement();
  document.body.classList.remove('joined');$('form-message').textContent=message||'';
  departmentWork.reset();
  monsterUI.reset();
  rulesUI.reset();
  interiorDecor.reset();
  evolutionUI.reset();growthUI.reset();
  if($('leave-dialog').open)$('leave-dialog').close();
  if($('planet-dialog').open)$('planet-dialog').close();
  if($('planet-create-dialog').open)$('planet-create-dialog').close();
  if($('crew-dialog').open)$('crew-dialog').close();
  if($('teacher-dialog').open)$('teacher-dialog').close();
  if($('shop-dialog').open)$('shop-dialog').close();
  if($('use-dialog').open)$('use-dialog').close();
  if($('trade-dialog').open)$('trade-dialog').close();
}
async function submit(event,handler){
  event.preventDefault();if(busy)return;busy=true;controls();$('form-message').textContent='';
  try{await accounts.ready;const result=await handler();enter(result);accounts.entered(result,{login:mode==='student'});}catch(e){$('form-message').textContent=e.message==='operation has timed out'?'응답이 늦어지고 있어요. 연결 상태를 확인해주세요.':e.message;}
  finally{busy=false;controls();}
}
$('student-form').onsubmit=e=>submit(e,async()=>{accounts.checkLink();const result=await request('room:join',{code:$('join-code').value,nickname:$('nickname').value,pin:$('student-pin').value});$('student-pin').value='';return result;});
$('teacher-form').onsubmit=e=>submit(e,async()=>{
  const teacherKey=$('teacher-key').value;
  if(classMode==='open')return request('room:open',{teacherKey,code:$('open-code').value});
  if(classMode!=='new')throw new Error('교실 방식을 먼저 골라주세요.');
  const managed=!$('student-setup-fields').disabled;
  const studentAccounts=managed?[...$('student-account-rows').children].map(row=>({
    nickname:row.querySelector('.student-account-name').value.trim(),pin:row.querySelector('.student-account-pin').value
  })):null;
  const allowedNames=managed?studentAccounts.map(account=>account.nickname):$('allowed-names').value.split(/[,\n]/).map(s=>s.trim()).filter(Boolean);
  const result=await request('room:create',{teacherKey,title:$('class-title').value,allowedNames,
    ...(managed?{studentAccounts}:{}),seedPlanets:$('seed-planets').checked});
  if(managed)clearStudentAccountPins();
  return result;
});
$('saved-classes-button').onclick=async()=>{
  const teacherKey=$('teacher-key').value;
  if(!teacherKey){toast('교사 확인 키를 먼저 입력해 주세요.');return;}
  try{
    const result=await request('room:list',{teacherKey}),select=$('saved-classes');
    select.replaceChildren(...(result.classes||[]).map(c=>{const option=document.createElement('option');option.value=c.code;option.textContent=c.title+' · '+c.code+(c.open?' · 열림':'');return option;}));
    select.hidden=!result.classes?.length;
    if(result.classes?.length){$('open-code').value=result.classes[0].code;select.onchange=()=>{$('open-code').value=select.value;};}
    else toast('아직 저장된 교실이 없어요. 새 교실을 한 번 만들어주세요.');
  }catch(e){toast(e.message);}
};
socket.on('connect',async()=>{
  $('connection').textContent='우주와 연결되었어요';controls();
  if(sessionToken){busy=true;controls();try{enter(await request('session:resume',{token:sessionToken}));}
    catch(e){reset(e.message);}finally{busy=false;controls();}}
});
socket.on('connect_error',()=>{$('connection').textContent='서버 연결을 기다리는 중…';controls();});
socket.on('disconnect',()=>{held.clear();touch={x:0,y:0};$('connection').textContent='다시 연결 중… 60초 안에 돌아올 수 있어요';controls();});
socket.on('room:state',data=>{if(selfId)updateRoom(data);});
socket.on('world:positions',data=>{if(selfId){world.positions(data);world.monsters(data);universe.positions(data);}});
socket.on('room:closed',data=>reset(data.message));
socket.on('item:notice',data=>{if(selfId)toast(data.text);});
// 서버에서 대화 범위에 맞게 전달한 메시지만 말풍선으로 표시합니다.
// 1:1·부서 대화는 원래 수신자 화면에서만 그려지며 다른 친구에게 전파하지 않습니다.
socket.on('chat:message',msg=>{if(!selfId)return;social.receive(msg);if(msg.playerId&&['map','department','direct'].includes(msg.channel))world.say(msg.playerId,msg.text);});
socket.on('chat:cleared',()=>{if(selfId)social.clear();});
function updateChatCount(){
  const input=$('chat-input');
  input.value=Array.from(input.value).slice(0,CHAT.maxLength).join('');
  $('chat-count').textContent=Array.from(input.value).length+' / '+CHAT.maxLength+'자';
}
// 한글 조합 중에는 자르지 않고 조합이 끝난 뒤 제한합니다. 이모지도 한 글자로 셉니다.
$('chat-input').addEventListener('input',e=>{if(!e.isComposing)updateChatCount();});
$('chat-input').addEventListener('compositionend',updateChatCount);
$('chat-form').onsubmit=async e=>{
  e.preventDefault();const text=$('chat-input').value.trim();if(!text||chatBusy)return;
  if(Array.from(text).length>CHAT.maxLength){$('chat-feedback').textContent='채팅은 1~100자로 입력해주세요.';return;}
  $('chat-feedback').textContent='';
  chatBusy=true;$('chat-send').disabled=true;
  try{await request('chat:send',{text,...social.scope()});$('chat-input').value='';updateChatCount();}
  catch(err){$('chat-feedback').textContent=err.message;toast(err.message);}
  finally{chatBusy=false;$('chat-send').disabled=$('chat-input').disabled;$('chat-input').focus();}
};
$('chat-toggle').onclick=async()=>{
  const enabled=room?.chat?.enabled!==false;
  try{await request('chat:setEnabled',{enabled:!enabled});}catch(e){toast(e.message);}
};
$('chat-clear').onclick=async()=>{try{await request('chat:clear',{});}catch(e){toast(e.message);}};
$('world').addEventListener('keydown',e=>{if(e.code==='Enter'){e.preventDefault();social.openChat();}});
$('chat-input').addEventListener('keydown',e=>{if(e.code==='Escape'){$('chat-input').blur();$('world').focus();}});
$('copy-code').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);toast('교실 코드를 복사했어요.');}catch{toast('화면의 교실 코드 '+room.code+'를 알려주세요.');}};
$('leave').onclick=()=>{
  stop();const teacher=room?.players.find(p=>p.id===selfId)?.role==='teacher';
  const persistent=room?.persistent===true;
  $('leave-title').textContent=teacher&&persistent?'수업을 마칠까요?':teacher?'모두의 교실을 종료할까요?':'교실에서 나갈까요?';
  $('leave-description').textContent=teacher&&persistent?'저장하고 수업을 마칩니다. 교실 코드와 아이들이 만든 내용은 그대로 유지돼요.':teacher?'모든 친구들이 나가게 되고, 이 교실 코드는 사용할 수 없어요.':'다시 교실 코드로 입장할 수 있어요.';
  if(teacher&&room.unattended){$('leave-title').textContent='선생님 화면에서 나갈까요?';$('leave-description').textContent='학생들은 서버가 켜져 있으면 07~21시에 계속 이용할 수 있어요. 다음에는 기존 교실 열기로 돌아오세요.';}
  $('leave-dialog').showModal();
};
$('stay').onclick=()=>{$('leave-dialog').close();$('world').focus();};
$('confirm-leave').onclick=async()=>{
  try{await request('room:leave',{});reset('다음 여행에서 또 만나요.');}
  catch(e){toast(e.message);}finally{$('leave-dialog').close();}
};
const keys={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]};
function input(){
  if(!selfId||!socket.connected)return;
  let x=touch.x,y=touch.y;for(const code of held){x+=keys[code][0];y+=keys[code][1];}
  const magnitude=Math.hypot(x,y);if(magnitude>1){x/=magnitude;y/=magnitude;}
  if(x||y||last.x||last.y)socket.volatile.emit('player:input',{x,y});
  last={x,y};
}
function stop(){held.clear();touch={x:0,y:0};joystick.reset();input();}
window.addEventListener('keydown',e=>{
  if(!selfId||!keys[e.code]||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)||e.target.isContentEditable)return;
  e.preventDefault();$('world').focus({preventScroll:true});held.add(e.code);input();
});
window.addEventListener('keyup',e=>{if(keys[e.code]){held.delete(e.code);input();}});
window.addEventListener('blur',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
// 네이티브 dialog는 닫히면 열었던 메뉴 버튼으로 초점을 돌립니다.
// 마지막 창이 닫힌 뒤에는 맵으로 복귀해 방향키/Enter가 이전 메뉴를 다시 누르지 않게 합니다.
document.addEventListener('close',e=>{if(e.target.tagName==='DIALOG'&&selfId&&!document.querySelector('dialog[open]'))$('world').focus({preventScroll:true});},true);
$('world').addEventListener('click',e=>{
  $('world').focus();
  if(!placing){
    if(world.currentMapId()===PLAZA_ID){
      const planet=world.planetAt(world.canvasPoint(e));
      if(planet)openPlanetDialog(planet.id);
    }
    return;
  }
  const point=world.canvasPoint(e);
  world.setPlacement(point);world.setPlacing(false);placing=false;document.body.classList.remove('placing');$('planet-new').textContent='행성 만들기';
  openPlanetCreateDialog(point);
});
for(const button of document.querySelectorAll('[data-dx]')){
  button.addEventListener('pointerdown',e=>{e.preventDefault();touch={x:Number(button.dataset.dx),y:Number(button.dataset.dy)};input();try{button.setPointerCapture(e.pointerId);}catch{}});
  for(const type of ['pointerup','pointercancel','lostpointercapture','pointerleave'])button.addEventListener(type,()=>{touch={x:0,y:0};input();});
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
// 입력 전송 간격은 그대로 두고, 물체 안내만 화면 프레임에 맞춰 카메라를 따라갑니다.
setInterval(input,80);
function interactionFrame(){updateInteractPrompt();requestAnimationFrame(interactionFrame);}
requestAnimationFrame(interactionFrame);controls();socket.connect();
