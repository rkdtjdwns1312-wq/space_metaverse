import {PLAZA_LAYOUT} from './plaza-layout.js';
import {STREET_LAYOUT} from './street-layout.js';
import {VALLEY_LAYOUT} from './valley-layout.js';

export const JOURNEY_VERSION=2;
export const JOURNEY_ITEM_IDS=Object.freeze({consumable:'journey-practice-spark',equipment:'journey-practice-badge'});
export const JOURNEY_PRACTICE_MS=60000;
export const JOURNEY_EQUIP_MESSAGE='잘했습니다. 장착아이템은 2Lv부터 사용할 수 있습니다';
const ui=(id,label)=>({id,label,source:'ui'});
const pillar=(id,label,x,y)=>({id,label,source:'pillar',objectId:id,mapId:'space-plaza',x,y});
const zone=(id,label,mapId,area)=>({id,label,source:'zone',mapId,...area});
export const JOURNEY_STEPS=Object.freeze([
  {stage:1,title:'우주와 소통해볼까요?',description:'직접 움직이고 서로 다른 기둥 4개를 모두 살펴보세요.',goals:[
    {id:'moved',label:'방향키나 조이스틱으로 직접 움직이기',source:'movement'},
    pillar('pillar-notice','오늘의 알림장 살펴보기',1580,1210),pillar('pillar-effects','사용 중인 아이템 살펴보기',2020,1210),
    pillar('pillar-timetable','오늘의 시간표 살펴보기',1580,1430),pillar('pillar-weekly','이번 주 받은 별 살펴보기',2020,1430)]},
  {stage:2,title:'우주를 살펴볼까요?',description:'광장 네 모서리의 원형 구역을 방문하고 전체 우주 지도를 열어 보세요.',goals:[
    ...['black-hole','department','market','assignment'].flatMap(id=>{const area=PLAZA_LAYOUT.islands.find(a=>a.id===id),goal=zone(id,area.name+' 구역 방문하기','space-plaza',{x:area.x,y:area.y,rx:area.rx,ry:area.ry});return id==='department'?[goal,{...ui('department-menu','메뉴에서 행성 만들기 버튼 확인하기'),requires:['department']}]:[goal];}),
    ui('world-map','전체 우주 지도 열기')]},
  {stage:3,title:'특수맵을 탐험해볼까요?',description:'북쪽 발전소 → 상점가 → 남쪽 놀이터 → 성장의 별 → 진화의 별 순서로 살펴보세요.',ordered:true,goals:[
    zone('station','북쪽 발전소 방문하기','star-street',STREET_LAYOUT.north),zone('shops','상점가 방문하기','star-street',STREET_LAYOUT.upper),
    zone('playground','남쪽 놀이터 방문하기','star-street',STREET_LAYOUT.lower),
    {id:'growth-star',label:'성장의 별 살펴보기',source:'info',objectId:'growth-star',mapId:'milky-valley',x:VALLEY_LAYOUT.temples[1].x,y:VALLEY_LAYOUT.temples[1].y-40},
    {id:'evolution-star',label:'진화의 별 살펴보기',source:'info',objectId:'evolution-star',mapId:'milky-valley',x:VALLEY_LAYOUT.temples[0].x,y:VALLEY_LAYOUT.temples[0].y-40}]},
  {stage:4,title:'가방 살펴보기',description:'가방 3페이지와 아이템 정보를 보고 연습용 소모품을 사용한 뒤, 사용 중인 아이템 기둥에서 효과를 확인하고 연습 장비를 장착해 보세요.',goals:[
    ui('bag-1','가방 1페이지 살펴보기'),ui('bag-2','가방 2페이지 살펴보기'),ui('bag-3','가방 3페이지 살펴보기'),ui('item-info','아이템 정보 살펴보기'),
    {id:'practice-used',label:'연습용 소모품 사용하기',source:'practice'},
    {...pillar('effects-seen','사용 중인 아이템 기둥에서 연습 효과 확인하기',2020,1210),objectId:'pillar-effects'},
    {id:'practice-equipped',label:'연습 장비 장착 누르기',source:'practice'}]},
  {stage:5,title:'소통하기',description:'왼쪽 채팅창 버튼과 소통의 친구 목록을 열어 보세요. 채팅을 보내거나 친구를 초대하지 않아도 됩니다.',goals:[ui('chat-open','왼쪽 채팅창 열기'),ui('friends-open','소통에서 친구 목록 열기')]}
].map(step=>Object.freeze({...step,goals:Object.freeze(step.goals.map(Object.freeze))})));
