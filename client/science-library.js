import {SCIENCE_FACTS} from '/shared/science-facts.js';
import {createReadingRefresh} from './reading-refresh.js';
const node=(tag,className,text)=>{const el=document.createElement(tag);if(className)el.className=className;if(text)el.textContent=text;return el;};
export function createScienceLibrary({request,stop}){
 const dialog=node('dialog','culture-library science-library');dialog.id='science-library-dialog';dialog.setAttribute('aria-labelledby','science-library-title');
 const header=node('header','culture-header'),title=node('h2','','별 과학 발전소'),close=node('button','secondary','닫기');title.id='science-library-title';close.type='button';close.onclick=()=>dialog.close();header.append(title,close);
 const progress=node('p','culture-progress'),notice=node('p','culture-notice');notice.setAttribute('role','status');
 const menu=node('section','science-menu'),bulb=node('img','science-bulb');bulb.src='/assets/maps/science-idea-bulb.png';bulb.alt='별빛이 담긴 과학 전구';bulb.width=170;bulb.height=170;
 const explain=node('p','',`하루에 두 가지 과학 이야기를 만나요. ${SCIENCE_FACTS.length}개를 모두 읽을 때까지 중복 없이 만나고, 다 읽으면 처음부터 다시 볼 수 있어요.`),start=node('button','secondary science-start','오늘의 과학상식 보기');start.type='button';menu.append(bulb,explain,start);
 const memo=node('article','science-memo'),memoTitle=node('h3'),body=node('div','culture-paragraphs'),source=node('details','culture-source'),summary=node('summary','','참고한 과학 자료'),sourceLink=node('a');sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';source.append(summary,sourceLink);
 const actions=node('footer','culture-reader-footer'),reward=node('p','culture-reward'),done=node('button','secondary science-done','읽음'),again=node('button','secondary science-next','다음 과학상식 보기');done.type='button';again.type='button';again.hidden=true;actions.append(reward,done,again);memo.append(memoTitle,body,source,actions);memo.hidden=true;dialog.append(header,progress,notice,menu,memo);document.body.append(dialog);
 let generation=0,status=null,busy=false,active=null,read=false;
 const dailyRefresh=createReadingRefresh({dialog,refresh:async()=>{
  if(!dialog.open||busy)return false;
  busy=true;render();const current=generation;
  try{const result=await request('science:status',{});if(current!==generation||!dialog.open)return false;status=result;return true;}
  catch(error){if(current===generation&&dialog.open)notice.textContent=error.message;return false;}
  finally{if(current===generation){busy=false;render();}}
 }});
 function render(){
  progress.textContent=`오늘 ${status?.count??0} / 2개 · 이번 차례 남은 이야기 ${status?.remaining??SCIENCE_FACTS.length} / ${SCIENCE_FACTS.length}개`;
  start.textContent=status?.activeId?'읽던 과학상식 이어 보기':'오늘의 과학상식 보기';start.disabled=busy||status?.canOpen===false;
  done.disabled=busy||read;again.hidden=!read||!status?.canOpen;again.disabled=busy;
  reward.textContent=read?'오늘의 배움을 기억해 보세요.':status?.reward===0?'선생님은 보상 없이 살펴볼 수 있어요.':`다 읽으면 우주에너지 ${status?.reward??1}개를 받아요.`;
 }
 async function openFact(){
  if(busy)return;busy=true;read=false;render();memo.hidden=true;menu.hidden=false;notice.textContent='새로운 발견에 불을 켜요…';const current=generation;
  try{const result=await request('science:open',{});if(current!==generation)return;status=result;const fact=SCIENCE_FACTS.find(f=>f.id===result.factId);if(!fact)throw new Error('이야기를 불러오지 못했어요. 다시 열어 주세요.');
   bulb.classList.remove('is-glowing');void bulb.offsetWidth;bulb.classList.add('is-glowing');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(r=>setTimeout(r,750));if(current!==generation)return;
   active=fact.id;memoTitle.textContent=fact.title;body.replaceChildren(...fact.paragraphs.map(text=>node('p','',text)));sourceLink.textContent=fact.source?.title||'과학 자료';sourceLink.href=fact.source?.url||'#';source.hidden=!fact.source?.url;source.open=false;menu.hidden=true;memo.hidden=false;notice.textContent='';dialog.scrollTop=0;memoTitle.tabIndex=-1;memoTitle.focus({preventScroll:true});
  }catch(error){if(current===generation)notice.textContent=error.message;}
  finally{if(current===generation){busy=false;bulb.classList.remove('is-glowing');render();}}
 }
 start.onclick=openFact;again.onclick=openFact;
 done.onclick=async()=>{
  if(busy||read||!active)return;busy=true;render();const current=generation;
  try{const result=await request('science:claim',{factId:active});if(current!==generation)return;status=result;read=true;notice.textContent=result.message||(result.awarded?`우주에너지 ${result.amount}개를 받았어요.`:'잘 읽었어요!');if(!result.canOpen)notice.textContent+=' 오늘의 두 이야기를 모두 만났어요. 내일 또 만나요.';}
  catch(error){if(current===generation)notice.textContent=error.message;}
  finally{if(current===generation){busy=false;render();notice.scrollIntoView({block:'nearest'});}}
 };
 dialog.addEventListener('close',()=>{dailyRefresh.stop();generation++;busy=false;bulb.classList.remove('is-glowing');document.getElementById('world')?.focus();});
 return {async open(){stop();const current=++generation;busy=true;active=null;read=false;status=null;memo.hidden=true;menu.hidden=false;notice.textContent='오늘의 과학 이야기를 준비하고 있어요…';render();if(!dialog.open)dialog.showModal();
  dailyRefresh.start();
  try{const result=await request('science:status',{});if(current!==generation)return;status=result;notice.textContent=result.canOpen?'':'오늘의 과학 이야기를 모두 만났어요. 내일 다시 와 주세요.';}
  catch(error){if(current===generation)notice.textContent=error.message;}
  finally{if(current===generation){busy=false;render();}}
 },reset(){generation++;busy=false;dialog.close();}};
}
