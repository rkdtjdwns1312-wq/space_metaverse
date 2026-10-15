import {CULTURE_STORIES} from '/shared/culture-stories.js';
import {stationReward} from '/shared/station-rewards.js';
import {createReadingRefresh} from './reading-refresh.js';
import {historyTextParts} from '/shared/history-keywords.js';

const INITIALS=['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const TABS=['전체','ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const plain={'ㄲ':'ㄱ','ㄸ':'ㄷ','ㅃ':'ㅂ','ㅆ':'ㅅ','ㅉ':'ㅈ'};
export function storyInitial(title){const n=title.trim().charCodeAt(0)-0xac00;if(n<0||n>=11172)return '';const letter=INITIALS[Math.floor(n/588)];return plain[letter]||letter;}
const node=(tag,className,text)=>{const element=document.createElement(tag);if(className)element.className=className;if(text)element.textContent=text;return element;};
function historyText(element,text,id){element.replaceChildren(...historyTextParts(text,id).map(part=>part.key?node('strong','history-keyword',part.text):document.createTextNode(part.text)));return element;}
export function createCultureLibrary({request,stop,getSelf}){
 return createReadingLibrary({request,stop,getSelf,stories:CULTURE_STORIES});
}
export function createReadingLibrary({request,stop,getSelf,stories,chapters=null,namespace='culture',titleText='별 교양 발전소'}){
 const history=namespace==='history',unit=history?'편':'권',item=history?'글':'책';
 const dialog=node('dialog',`culture-library${history?' history-library':''}`);dialog.id=`${namespace}-library-dialog`;dialog.setAttribute('aria-labelledby',`${namespace}-library-title`);
 const header=node('header','culture-header'),title=node('h2','',titleText);title.id=`${namespace}-library-title`;
 const close=node('button','secondary','닫기');close.type='button';close.onclick=()=>dialog.close();header.append(title,close);
 const progress=node('p','culture-progress'),notice=node('p','culture-notice');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 const catalog=node('section','culture-catalog'),intro=node('p','',history?'시대별로 우리 역사의 흐름을 살펴보세요.':'책을 골라 짧은 이야기를 읽어 보세요.'),sortBar=node('div','culture-sort-bar'),sortButton=node('button','secondary culture-sort-button','추천순'),tabs=node('nav','culture-tabs'),list=node('div','culture-titles');tabs.setAttribute('aria-label',history?'역사 시대별 장':'책 제목 첫 자음');sortButton.type='button';sortBar.append(sortButton);
 catalog.append(intro,...(history?[]:[sortBar]),tabs,list);
 if(chapters){intro.hidden=true;tabs.classList.add('history-chapter-tabs');}
 const reader=node('section','culture-reader'),back=node('button','secondary culture-back',history?'제목 목록':'책 목록'),paper=node('article','culture-paper'),category=node('p','culture-category'),bookTitle=node('h3','culture-book-title'),paragraphs=node('div','culture-paragraphs'),lesson=node('p','culture-lesson'),source=node('details','culture-source'),sourceTitle=node('summary','',history?'참고한 역사 자료':'이야기의 바탕'),sourceInfo=node('p'),sourceLink=node('a');
 sourceLink.target='_blank';sourceLink.rel='noopener noreferrer';source.append(sourceTitle,sourceInfo,sourceLink);paper.append(category,bookTitle,paragraphs,lesson,source);
 const footer=node('footer','culture-reader-footer'),reward=node('p','culture-reward'),recommend=node('button','secondary culture-recommend','추천해요'),done=node('button','secondary culture-done','다 읽음');done.type='button';back.type='button';recommend.type='button';footer.append(reward,...(history?[]:[recommend]),done);reader.append(back,paper,footer);reader.hidden=true;
 dialog.append(header,progress,notice,catalog,reader);document.body.append(dialog);
 let status=null,selected=null,letter=chapters?.[0].id??'전체',generation=0,busy=false,recommendedSort=false;
 const dailyRefresh=createReadingRefresh({dialog,refresh:async()=>{
  if(!dialog.open||busy)return false;
  busy=true;renderStatus();const current=generation;
  try{const result=await request(`${namespace}:status`,{});if(current!==generation||!dialog.open)return false;status=result;if(catalog.hidden===false)renderList();return true;}
  catch(error){if(current===generation&&dialog.open)notice.textContent=error.message;return false;}
  finally{if(current===generation){busy=false;renderStatus();}}
 }});
 const books=chapters?[...stories]:[...stories].sort((a,b)=>a.title.localeCompare(b.title,'ko'));
 function renderStatus(){
  const teacher=getSelf()?.role==='teacher';
  progress.textContent=teacher?'선생님은 모든 글을 자유롭게 살펴볼 수 있어요.':`오늘의 ${history?'역사 읽기':'독서'} 보상 ${status?.count??0} / ${status?.limit??10}${unit} · 한 ${unit}당 우주에너지 ${status?.reward??stationReward(getSelf()?.avatar?.level??1)}개`;
  if(!selected)return;
  const already=status?.claimedIds?.includes(selected.id),full=(status?.count??0)>=(status?.limit??10);
  reward.textContent=teacher?'선생님 열람에는 보상이 지급되지 않아요.':already?`이 ${item}의 오늘 보상은 이미 받았어요.`:full?`오늘은 10${unit}의 보상을 모두 받았어요. 내일 또 읽어요!`:`다 읽으면 우주에너지 ${status?.reward??1}개를 받아요. 같은 ${item}은 하루 한 번, 하루 최대 10${unit}이에요.`;
  done.disabled=busy||teacher||already||full;
  if(!history){const mine=status?.recommendedIds?.includes(selected.id)??false;recommend.textContent=`${mine?'내 추천 취소':'추천해요'} · ${status?.recommendationCounts?.[selected.id]||0}`;recommend.setAttribute('aria-pressed',String(mine));recommend.disabled=busy||teacher;}
 }
 function renderList(){
  if(!history){sortButton.textContent=recommendedSort?'가나다순':'추천순';sortButton.setAttribute('aria-pressed',String(recommendedSort));}
  tabs.replaceChildren(...(chapters||TABS.map(value=>({id:value,title:value}))).map(({id,title,subtitle})=>{const button=node('button','secondary',title);button.type='button';button.setAttribute('aria-pressed',String(id===letter));if(subtitle)button.setAttribute('aria-label',`${title} · ${subtitle}`);button.onclick=()=>{letter=id;renderList();};return button;}));
  if(chapters){const chapterName=node('span','history-chapter-name',chapters.find(c=>c.id===letter)?.subtitle||'');chapterName.setAttribute('role','status');chapterName.setAttribute('aria-live','polite');tabs.append(chapterName);}
  const filtered=books.filter(book=>chapters?book.chapterId===letter:letter==='전체'||storyInitial(book.title)===letter);
  if(!history&&recommendedSort)filtered.sort((a,b)=>(status?.recommendationCounts?.[b.id]||0)-(status?.recommendationCounts?.[a.id]||0)||a.title.localeCompare(b.title,'ko'));
  list.replaceChildren(...filtered.map(book=>{const button=node('button','culture-title');button.type='button';button.dataset.storyId=book.id;button.append(node('span','',book.title));if(!history){const count=status?.recommendationCounts?.[book.id]||0,mine=status?.recommendedIds?.includes(book.id);if(count)button.append(node('small','culture-vote-count',`추천 ${count}${mine?' · 내 추천':''}`));else if(mine)button.append(node('small','culture-vote-count','내 추천'));}if(status?.claimedIds?.includes(book.id))button.append(node('small','','오늘 보상 받음'));button.onclick=()=>openBook(book);return button;}));
  if(!filtered.length)list.append(node('p','culture-empty','이 자음으로 시작하는 이야기는 아직 없어요. 다른 자음을 눌러 주세요.'));
 }
 sortButton.onclick=()=>{recommendedSort=!recommendedSort;renderList();};
 async function openBook(book){
  if(busy)return;busy=true;notice.textContent='책을 펼치고 있어요…';const current=generation;
  try{const result=await request(`${namespace}:open`,{storyId:book.id});if(current!==generation)return;status=result;selected=book;
   category.textContent=book.category||book.period;bookTitle.textContent=book.title;paragraphs.replaceChildren(...book.paragraphs.map(text=>history?historyText(node('p'),text,book.id):node('p','',text)));lesson.textContent=`${history?'기억해요':'함께 생각해요'} · ${book.lesson||book.summary}`;
   if(history)historyText(lesson,lesson.textContent,book.id);
   sourceInfo.textContent=book.adaptation||'어린이 눈높이로 새롭게 풀어쓴 이야기';sourceLink.textContent=book.source?.title||'원전';sourceLink.href=book.source?.url||'#';source.hidden=!book.source?.url;source.open=false;
   catalog.hidden=true;reader.hidden=false;notice.textContent='';dialog.scrollTop=0;bookTitle.tabIndex=-1;bookTitle.focus({preventScroll:true});
  }catch(error){if(current===generation)notice.textContent=error.message;}
  finally{if(current===generation){busy=false;renderStatus();}}
 }
 back.onclick=()=>{if(busy)return;selected=null;reader.hidden=true;catalog.hidden=false;notice.textContent='';renderList();dialog.scrollTop=0;tabs.querySelector('button[aria-pressed="true"]')?.focus();};
 done.onclick=async()=>{
  if(busy||!selected)return;busy=true;renderStatus();const current=generation,storyId=selected.id;
  try{const result=await request(`${namespace}:claim`,{storyId});if(current!==generation)return;status=result;notice.textContent=result.message||(result.awarded?`잘 읽었어요! 우주에너지 ${result.amount}개를 받았어요.`:'오늘의 보상을 확인했어요.');}
  catch(error){if(current===generation)notice.textContent=error.message;}
  finally{if(current===generation){busy=false;renderStatus();notice.scrollIntoView({block:'nearest'});}}
 };
 recommend.onclick=async()=>{
  if(busy||!selected||history)return;busy=true;renderStatus();const current=generation,storyId=selected.id;
  try{const result=await request('culture:recommend',{storyId});if(current!==generation||!dialog.open)return;status=result;notice.textContent='추천을 반영했어요.';renderList();}
  catch(error){if(current===generation)notice.textContent=error.message;}
  finally{if(current===generation){busy=false;renderStatus();}}
 };
 dialog.addEventListener('close',()=>{dailyRefresh.stop();generation++;busy=false;document.getElementById('world')?.focus();});
 return {async open(){stop();const current=++generation;busy=true;selected=null;letter=chapters?.[0].id??'전체';recommendedSort=false;status=null;catalog.hidden=false;reader.hidden=true;notice.textContent='책장을 준비하고 있어요…';list.replaceChildren();tabs.replaceChildren();renderStatus();if(!dialog.open)dialog.showModal();
  dailyRefresh.start();
  try{const result=await request(`${namespace}:status`,{});if(current!==generation)return;status=result;notice.textContent=`같은 ${item}은 하루 한 번, 매일 자정에 보상 횟수가 새로 시작돼요.`;renderList();renderStatus();}
  catch(error){if(current===generation)notice.textContent=error.message;}
  finally{if(current===generation)busy=false;}
 },reset(){generation++;busy=false;dialog.close();}};
}
