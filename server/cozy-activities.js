import {createGardenGame,validateGardenGame,gardenGameView,actGardenGame,gardenScore} from './garden-minigame.js';
import {gardenGrade} from '../shared/garden-minigame.js';
import {validateStarRaising,starView,actStarRaising} from './star-raising.js';
import {COZY_SPECIES,COZY_THEMES,COZY_FURNITURE,COZY_SEEDS,COZY_ACCESSORIES,COZY_CARE,COZY_CATALOG,COZY_GRID,cozyPreset,cozyRewardUnit} from '../shared/cozy-activities.js';
import {STREET,STREET_ID} from '../shared/config.js';
import {GameError} from './pin-auth.js';
import {isNear} from './world.js';
import {isDefeated} from './vitals.js';
import {cultureDay} from './culture-library.js';
const need=(v,m='입력 내용을 확인해주세요.')=>{if(!v)throw new GameError(m);};
const has=(list,id)=>list.some(v=>v.id===id),int=(v,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const day=v=>v===null||typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const name=v=>typeof v==='string'?Array.from(v.normalize('NFC').replace(/[\p{C}<>]/gu,'').trim()).slice(0,12).join(''):'';
const qualityNames=[100,80,60,40,0].map(score=>gardenGrade(score).name);
const blankQuality=()=>Object.fromEntries(COZY_SEEDS.map(seed=>[seed.id,Object.fromEntries(qualityNames.map(grade=>[grade,0]))]));
function qualityCollection(raw,collection){
 if(raw===undefined)return blankQuality();
 need(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).length===COZY_SEEDS.length);
 return Object.fromEntries(COZY_SEEDS.map(seed=>{
  const counts=raw[seed.id];need(counts&&typeof counts==='object'&&!Array.isArray(counts)&&Object.keys(counts).length===qualityNames.length&&qualityNames.every(grade=>int(counts[grade])));
  const total=qualityNames.reduce((n,grade)=>n+counts[grade],0);need(int(total)&&total<=collection[seed.id]);
  return [seed.id,Object.fromEntries(qualityNames.map(grade=>[grade,counts[grade]]))];
 }));
}
function layout(raw){
 need(Array.isArray(raw)&&raw.length<=COZY_GRID.maxItems);const ids=new Set(),cells=new Set();
 const coordinate=(v,max)=>Number.isFinite(v)&&v>=0&&v<=max;
 return raw.map(p=>{
  const scale=p?.scale===undefined?1:p.scale;
  need(p?.space===undefined||p.space==='room');
  const cell=p?.space==='room'?`${p.x/5*100},${p.y/3*100}`:`${8+p?.x/5*84},${49+p?.y/3*41}`;
  need(p&&has(COZY_FURNITURE,p.id)&&coordinate(p.x,5)&&coordinate(p.y,3)&&int(p.rotation,3)&&int(p.palette,3)&&COZY_GRID.scales.includes(scale)&&!ids.has(p.id)&&!cells.has(cell));
  ids.add(p.id);cells.add(cell);return {id:p.id,x:p.x,y:p.y,rotation:p.rotation,palette:p.palette,scale,...(p.space==='room'?{space:'room'}:{})};
 });
}
export function validateCozyActivities(raw){
 if(raw===undefined)return {pet:{species:null,name:'',careCount:0,accessory:'none',day:null,careToday:[],raising:validateStarRaising()},room:{theme:'moon',layout:[],day:null,rewarded:false},garden:{pots:[null,null,null],collection:Object.fromEntries(COZY_SEEDS.map(s=>[s.id,0])),qualityCollection:blankQuality(),day:null,harvestsToday:0}};
 need(raw&&typeof raw==='object'&&!Array.isArray(raw),'꾸미기 저장 데이터를 확인해주세요.');const p=raw.pet,r=raw.room,g=raw.garden;
 need(p&&r&&g&&day(p.day)&&day(r.day)&&day(g.day));
 need((p.species===null||has(COZY_SPECIES,p.species))&&typeof p.name==='string'&&p.name===name(p.name)&&int(p.careCount)&&has(COZY_ACCESSORIES,p.accessory)&&COZY_ACCESSORIES.find(a=>a.id===p.accessory).care<=p.careCount);
 need(Array.isArray(p.careToday)&&p.careToday.length<=3&&new Set(p.careToday).size===p.careToday.length&&p.careToday.every(c=>COZY_CARE.includes(c))&&p.careCount>=p.careToday.length);
 need(p.species!==null?!!p.name:p.name===''&&p.careCount===0&&p.careToday.length===0);need(p.day!==null||p.careToday.length===0);
 need(has(COZY_THEMES,r.theme)&&typeof r.rewarded==='boolean'&&(r.day!==null||!r.rewarded));const savedLayout=layout(r.layout);
 need(Array.isArray(g.pots)&&g.pots.length===3&&g.collection&&typeof g.collection==='object'&&!Array.isArray(g.collection)&&Object.keys(g.collection).length===5&&COZY_SEEDS.every(s=>int(g.collection[s.id]))&&int(g.harvestsToday,3)&&(g.day!==null||g.harvestsToday===0));
 const pots=g.pots.map(pot=>{if(pot===null)return null;need(pot&&has(COZY_SEEDS,pot.seed)&&int(pot.plantedAt,8640000000000000)&&typeof pot.watered==='boolean');return {seed:pot.seed,plantedAt:pot.plantedAt,watered:pot.watered,...(pot.game===undefined?{}:{game:validateGardenGame(pot.game)})};});
 return {pet:{species:p.species,name:p.name,careCount:p.careCount,accessory:p.accessory,day:p.day,careToday:[...p.careToday],raising:validateStarRaising(p.raising)},room:{theme:r.theme,layout:savedLayout,day:r.day,rewarded:r.rewarded},garden:{pots,collection:{...g.collection},qualityCollection:qualityCollection(g.qualityCollection,g.collection),day:g.day,harvestsToday:g.harvestsToday}};
}
function current(player,now){const state=validateCozyActivities(player.cozyActivities),today=cultureDay(now);for(const kind of ['pet','room','garden'])if(state[kind].day!==today){state[kind].day=today;if(kind==='pet')state.pet.careToday=[];if(kind==='room')state.room.rewarded=false;if(kind==='garden')state.garden.harvestsToday=0;}return state;}
function readyAt(pot){return pot.plantedAt+COZY_SEEDS.find(s=>s.id===pot.seed).minutes*60000*(pot.watered?.8:1);}
export function cozyView(player,kind,now=Date.now()){
 need(['pet','room','garden'].includes(kind));const state=current(player,now)[kind];
 if(kind==='pet'){state.raising=starView(state.raising);state.stage=[3,9,18].filter(n=>state.careCount>=n).length;state.album=[3,9,18].filter(n=>state.careCount>=n);}
 if(kind==='garden')state.pots=state.pots.map(p=>p&&({...p,...(p.game?gardenGameView(p,now):{readyAt:readyAt(p),ready:now>=readyAt(p),remainingMs:Math.max(0,readyAt(p)-now)})}));
 const preview=player.role==='teacher'||player.accountKind==='master',unit=preview?0:cozyRewardUnit(player.avatar?.level);
 return {kind,serverNow:now,cosmicEnergy:player.cosmicEnergy??0,state,catalog:COZY_CATALOG,preview,rewards:{unit,perAction:kind==='room'?unit*3:unit,dailyMax:unit*3}};
}
export function actCozy(player,data,now=Date.now()){
 const {kind,action}=data;need(['pet','room','garden'].includes(kind));const state=current(player,now),s=state[kind],unit=cozyRewardUnit(player.avatar?.level);need(unit>0||player.role==='teacher'||player.accountKind==='master','현재 레벨을 확인해주세요.');let amount=0;
 if(kind==='pet'){
  if(action==='adopt'){need(s.species===null,'이미 함께하는 아기별이 있어요.');need(has(COZY_SPECIES,data.species));s.species=data.species;s.name=name(data.name)||COZY_SPECIES.find(p=>p.id===data.species).name;}
  else {need(s.species!==null,'먼저 아기별을 만나주세요.');if(action==='rename'){need(!!name(data.name));s.name=name(data.name);}
   else if(action==='care'){need(COZY_CARE.includes(data.care));if(!s.careToday.includes(data.care)){need(s.careCount<Number.MAX_SAFE_INTEGER);s.careToday.push(data.care);s.careCount++;amount=unit;}}
   else if(action==='raising:start'||action==='raising:choose'){if(actStarRaising(s,data,now)){amount=unit*(3-s.careToday.length);s.careToday=[...COZY_CARE];}}
   else if(action==='accessory'){need(has(COZY_ACCESSORIES,data.accessory)&&COZY_ACCESSORIES.find(a=>a.id===data.accessory).care<=s.careCount,'아기별을 더 돌보면 열려요.');s.accessory=data.accessory;}
   else need(false);}
 } else if(kind==='room'){
  need(has(COZY_THEMES,data.theme));need(['save','preset'].includes(action));s.theme=data.theme;s.layout=action==='preset'?cozyPreset(data.theme):layout(data.layout);
  if(action==='save'&&s.layout.length>=3&&!s.rewarded){s.rewarded=true;amount=unit*3;}
 } else {
  need(int(data.pot,2));const pot=s.pots[data.pot];
  if(action==='plant'){need(pot===null,'먼저 꽃을 수확해주세요.');need(has(COZY_SEEDS,data.seed));s.pots[data.pot]={seed:data.seed,plantedAt:now,watered:false,game:createGardenGame(now)};}
  else if(pot?.game){const multiplier=actGardenGame(pot,data,now);if(action==='harvest'){
   const grade=gardenGrade(gardenScore(pot.game)).name;
   need(s.collection[pot.seed]<Number.MAX_SAFE_INTEGER&&s.qualityCollection[pot.seed][grade]<Number.MAX_SAFE_INTEGER);
   s.collection[pot.seed]++;s.qualityCollection[pot.seed][grade]++;s.pots[data.pot]=null;if(s.harvestsToday<3){s.harvestsToday++;amount=Math.floor(unit*multiplier);}
  }}
  else if(action==='water'){need(pot&&!pot.watered,'빈 화분이거나 이미 물을 주었어요.');pot.watered=true;}
  else if(action==='harvest'){need(pot&&now>=readyAt(pot),'꽃이 자라는 중이에요.');need(s.collection[pot.seed]<Number.MAX_SAFE_INTEGER);s.collection[pot.seed]++;s.pots[data.pot]=null;if(s.harvestsToday<3){s.harvestsToday++;amount=unit;}}
  else need(false);
 }
 if(player.role==='teacher'||player.accountKind==='master')amount=0;
 const energy=player.cosmicEnergy??0;need(int(energy)&&int(energy+amount),'우주에너지를 더 담을 수 없어요.');
 player.cozyActivities=state;if(amount)player.cosmicEnergy=energy+amount;
 return {...cozyView(player,kind,now),amount,awarded:amount>0};
}
export function registerCozyActivities({socket,action,store,roster,clock=Date.now}){
 const access=kind=>{need(['pet','room','garden'].includes(kind));const {room,player}=socket.data.session||{};
  need(socket.connected&&player?.connected&&!player.away&&player.socketId===socket.id&&['teacher','student'].includes(player.role)&&store.rooms.get(room?.code)===room&&room?.players.get(player.id)===player,'현재 접속에서 교실에 다시 입장해주세요.');
  const prop=STREET.objects.find(o=>o.kind===`cozy-${kind}`);need(player.mapId===STREET_ID&&prop&&isNear(player,prop),'쉼터의 활동 장소 가까이에서 이용해주세요.');need(!isDefeated(player),'체력을 회복한 뒤 이용해주세요.');return {room,player};};
 action('cozy:read',data=>cozyView(access(data.kind).player,data.kind,clock()),false);
 action('cozy:act',data=>{const {room,player}=access(data.kind),result=actCozy(player,data,clock());if(result.amount)roster(room);return result;});
}
