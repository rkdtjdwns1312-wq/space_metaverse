import {itemOf} from '/shared/config.js';

export function createTeacherCardCatalog({request,getPlayer,stop=()=>{},toast=()=>{}}){
  const css=document.createElement('link');css.rel='stylesheet';css.href='/teacher-card-catalog.css';document.head.append(css);
  const footer=document.querySelector('#inventory-dialog > .dialog-actions'),buttons=document.createElement('div');
  buttons.id='teacher-card-catalog-buttons';buttons.hidden=true;footer.prepend(buttons);
  const dialog=document.createElement('dialog');dialog.id='teacher-card-catalog-dialog';dialog.setAttribute('aria-labelledby','teacher-card-catalog-title');
  dialog.innerHTML='<h2 id="teacher-card-catalog-title"></h2><p id="teacher-card-catalog-summary" role="status"></p><div id="teacher-card-catalog-list"></div><div class="dialog-actions"><button type="button" class="secondary">닫기</button></div>';
  document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();
  const title=dialog.querySelector('h2'),summary=dialog.querySelector('p'),list=dialog.querySelector('#teacher-card-catalog-list');
  let revision=0;
  const teacher=()=>getPlayer()?.role==='teacher';
  function text(tag,value,parent){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el;}
  function render(data,kind){
    list.replaceChildren();const gold=kind==='gold',entries=gold?data.gold:data.silver;
    summary.textContent=gold?`금별 카드 ${entries.length}종 · 효과를 확인하세요.`:`은별 뽑기 ${data.silverTotal}장 · ${entries.length}종의 보상과 구성 장수예요.`;
    for(const card of entries){
      const article=document.createElement('article');article.className='teacher-catalog-card';
      const heading=document.createElement('div');heading.className='teacher-catalog-heading';
      if(!gold&&card.kind==='item'&&itemOf(card.itemId)?.art){const img=document.createElement('img');img.src=itemOf(card.itemId).art;img.alt='';img.loading='lazy';heading.append(img);}
      text('h3',card.name,heading);if(!gold)text('span',`${card.count}장`,heading).className='teacher-catalog-count';article.append(heading);
      if(gold){text('p',card.effect,article).className='teacher-catalog-effect';
        for(const note of [...card.automatic,...card.manual])text('p',note,article).className='teacher-catalog-note';
      }else{
        const reward=card.kind==='shards'?`별 파편 ${card.amount}개`:card.kind==='xp'?`경험치 ${card.amount}`:card.kind==='item'?`${card.name} ${card.amount}개`:'추가 보상 없음';
        text('p',reward,article).className='teacher-catalog-effect';
        if(card.kind==='item'){const item=itemOf(card.itemId);if(item?.description)text('p',item.description,article).className='teacher-catalog-note';}
      }
      list.append(article);
    }
  }
  async function open(kind){
    if(!teacher())return;stop();const current=++revision;title.textContent=kind==='gold'?'별카드 보기':'뽑기카드 보기';summary.textContent='카드 목록을 불러오고 있어요.';list.replaceChildren();dialog.showModal();
    try{const data=await request('teacher:cards:catalog',{});if(current===revision&&teacher()&&dialog.open)render(data,kind);}
    catch(error){if(current===revision){summary.textContent='목록을 불러오지 못했어요. 창을 닫고 다시 열어주세요.';toast(error.message);}}
  }
  for(const [kind,label] of [['gold','별카드 보기'],['silver','뽑기카드 보기']]){
    const b=document.createElement('button');b.type='button';b.className='secondary small';b.dataset.catalog=kind;b.textContent=label;b.onclick=()=>open(kind);buttons.append(b);
  }
  function reset(){revision++;buttons.hidden=true;dialog.close();list.replaceChildren();}
  function update(){buttons.hidden=!teacher();if(!teacher()&&dialog.open)reset();}
  dialog.addEventListener('close',()=>{revision++;});update();return {update,reset};
}
