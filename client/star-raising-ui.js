const html=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bookArt={science:'furniture-telescope.webp',art:'furniture-easel.webp',nature:'furniture-terrarium.png',care:'pet-flower.webp',build:'furniture-desk.webp',explore:'furniture-globe.webp'};
const stages=['별빛 유년기','호기심 성장기','꿈을 찾는 시기','새로운 출발'];
const accessories={none:'✦',ribbon:'🎀',crown:'👑',halo:'💫'};
const activityName=(catalog,id)=>catalog.activities?.find(a=>a.id===id)?.name||id;

export function renderStarHome(){
 return `<div class="raising-game raising-home"><button type="button" class="raising-home-button" data-pet-page="setup"><span aria-hidden="true">✦</span><b>별 돌보기 시작하기</b></button><button type="button" class="raising-home-button" data-pet-page="book"><span aria-hidden="true">▤</span><b>직업결말 도감 보기</b></button></div>`;
}
export function renderStarSetup({pet,catalog,draft}){
 const playing=pet.raising?.status==='playing';
 return `<section class="raising-game raising-setup" aria-labelledby="raising-setup-title"><h3 id="raising-setup-title">함께할 아기별을 골라주세요</h3>${playing?'<p class="raising-small">돌보던 아기별과 이어서 시작해요. 지금까지의 선택은 그대로 남아 있어요.</p>':''}<div class="cozy-choice-grid">${(catalog.species||[]).map(p=>`<button type="button" class="cozy-choice ${draft.species===p.id?'selected':''}" data-species="${html(p.id)}" aria-pressed="${draft.species===p.id}" ${playing&&pet.species!==p.id?'disabled':''}><img class="cozy-pet-emoji ${html(p.id)}" src="/assets/cozy/pet-${html(p.id)}.webp" alt=""><b>${html(p.name)}</b></button>`).join('')}</div><label class="cozy-label">아기별 이름<input data-name maxlength="12" value="${html(draft.name)}" placeholder="예: 반짝이" autocomplete="off"></label><fieldset class="raising-accessory-options"><legend>아기별 장식</legend><div class="cozy-accessories">${(catalog.accessories||[]).map(a=>`<button type="button" class="cozy-accessory ${draft.accessory===a.id?'selected':''}" data-accessory="${html(a.id)}" aria-pressed="${draft.accessory===a.id}" ${Number(pet.careCount||0)<a.care?'disabled':''}><span aria-hidden="true">${accessories[a.id]||'✦'}</span><small>${html(a.name)}</small>${Number(pet.careCount||0)<a.care?`<small>돌봄 ${a.care}회에 열려요</small>`:''}</button>`).join('')}</div></fieldset><button type="button" class="cozy-btn primary raising-confirm" data-raising-confirm ${draft.species?'':'disabled'}>${playing?'확인하고 이어서 돌보기':'확인하고 돌보기 시작'}</button></section>`;
}
export function renderStarBook({pet,catalog={},category=null,careerId=null}){
 const album=pet.raising?.album||[],collected=new Set(album.map(e=>e.careerId));
 const activities=catalog.activities||[],careers=catalog.careers||[],group=activities.find(a=>a.id===category);
 const available=c=>!c.locked&&(catalog.canBrowseAll||collected.has(c.id));
 const career=careers.find(c=>c.id===careerId&&c.track===group?.id&&available(c));
 const art=id=>`<img src="/assets/cozy/${bookArt[id]||bookArt.science}" alt="" loading="lazy">`;
 let content;
 if(career){
  const guide=career.guide||{};
  content=`<div class="raising-career-title">${art(career.track)}<div><span class="raising-eyebrow">${html(group.name)} · ${collected.has(career.id)?'발견한 직업':'선생님 미리보기'}</span><h3 id="raising-book-title">${html(career.name)}</h3></div></div>
   <p class="raising-career-intro">${html(career.description)}</p>${guide.related?`<p class="raising-related">이야기와 이어지는 진로: ${html(guide.related)}</p>`:''}
   <section class="raising-career-lesson"><h4>어떤 일을 하나요?</h4><p>${html(guide.work||career.description)}</p></section>
   <section class="raising-career-lesson"><h4>함께 길러볼 힘</h4><ul>${(guide.strengths||[]).map(s=>`<li><b>${html(s.name)}</b><span>${html(s.description)}</span></li>`).join('')}</ul><p class="raising-small">처음부터 잘할 필요는 없어요. 여러 경험을 하며 조금씩 길러갈 수 있어요.</p></section>
   <section class="raising-career-lesson raising-career-mission"><h4>오늘의 작은 진로 체험</h4><ol><li>${html(career.learningTip)}</li><li>${html(guide.activity)}</li><li>${html(guide.reflection)}</li></ol></section>
   <p class="raising-disclaimer">${html(catalog.disclaimer)}</p><a class="raising-career-resource" href="https://www.career.go.kr/cloud/jm/main/home" target="_blank" rel="noopener noreferrer">주니어 커리어넷에서 더 알아보기 ↗</a>`;
 }else if(group){
  content=`<h3 id="raising-book-title">${html(group.name)}의 직업</h3><p>${catalog.canBrowseAll?'선생님은 모든 직업의 진로 이야기를 볼 수 있어요.':'발견한 직업을 눌러 어떤 일을 하는지 알아보세요.'}</p><div class="raising-career-grid">${careers.filter(c=>c.track===group.id).map(c=>available(c)?`<button type="button" class="raising-career-card ${collected.has(c.id)?'collected':''}" data-raising-career="${html(c.id)}">${art(c.track)}<span>${collected.has(c.id)?'✦ 발견한 직업':'선생님 미리보기'}</span><h4>${html(c.name)}</h4><small>진로 이야기 보기 →</small></button>`:`<article class="raising-career-card locked" aria-label="아직 발견하지 않은 직업"><strong aria-hidden="true">?</strong><h4>아직 발견하지 않은 직업</h4><p>아기별과 이야기를 완성해보세요.</p></article>`).join('')}</div>`;
 }else{
  content=`<h3 id="raising-book-title">직업결말 도감 <span>${collected.size} / ${careers.length||48}</span></h3><p>어떤 배움터의 꿈을 만나볼까요?</p><div class="raising-book-categories">${activities.map(a=>`<button type="button" class="raising-category-card" data-raising-category="${html(a.id)}">${art(a.id)}<b>${html(a.name)}</b><small>발견 ${careers.filter(c=>c.track===a.id&&collected.has(c.id)).length} / ${careers.filter(c=>c.track===a.id).length}</small></button>`).join('')}</div>`;
 }
 return `<section class="raising-game raising-book" aria-labelledby="raising-book-title">${content}</section>`;
}
export function renderStarRaising({pet,catalog={},reward,selectedActivity=null,showStory=true}){
 const r=pet.raising,step=r.step||0,total=catalog.totalTurns||12,complete=r.status==='complete',stage=complete?3:Math.min(2,Math.floor(step/4)),ending=r.ending;
 const portrait=`<div class="raising-portrait stage-${stage}"><img src="/assets/cozy/pet-${html(pet.species)}.webp" alt="${html(pet.name)}"><span class="raising-crown" aria-hidden="true">${accessories[pet.accessory]||'✦'}</span></div>`;
 const journal=`<div class="raising-journey" aria-label="성장 ${step}/${total}">${Array.from({length:total},(_,i)=>`<span class="${i<step?'done':i===step?'current':''}">${i<step?'✦':i+1}</span>`).join('')}</div>`;
 let content='';
 if(complete&&ending){
  const axes=(catalog.axes||[]).map(axis=>{const [a,b]=axis.letters,[la,lb]=axis.labels,av=r.scores?.[a]||0,bv=r.scores?.[b]||0;return `<div class="raising-axis"><span><b>${a}</b> ${html(la)}</span><div class="raising-axis-pips" aria-label="${a} ${av}번, ${b} ${bv}번">${[0,1,2].map(i=>`<i class="${i<av?'left':i>=3-bv?'right':''}"></i>`).join('')}</div><span>${html(lb)} <b>${b}</b></span></div>`;}).join('');
  content=`<section class="raising-ending" aria-label="아기별의 직업 결말"><span class="raising-eyebrow">열두 번의 선택이 만든 미래</span><h4>${html(ending.careerName)}</h4><p>${html(ending.description)}</p><div class="raising-lesson"><b>함께 해볼 작은 배움</b><p>${html(ending.learningTip)}</p></div><p class="raising-small">가장 많이 배운 활동: ${html(activityName(catalog,ending.track))}</p><section class="raising-traits" aria-label="아기별의 성향 기록"><h5>아기별의 성향 기록</h5><div class="raising-type">${html(ending.type)}</div>${axes}</section><p class="raising-disclaimer">${html(catalog.disclaimer||'이 결과는 이번 선택으로 키운 아기별의 게임 속 성향이에요. 실제 성격 검사나 직업 추천이 아니에요. 어떤 성향도 다양한 직업을 가질 수 있어요.')}</p><div class="raising-end-actions"><button type="button" class="cozy-btn primary" data-pet-page="setup">새로운 성장 이야기 시작</button><button type="button" class="cozy-btn" data-pet-page="book">직업결말 도감 보기</button></div></section>`;
 }else{
  const event=r.event;
  const chosen=(catalog.activities||[]).find(a=>a.id===selectedActivity);
  const overlay=showStory?`<section class="raising-map-dialog raising-story" role="region" aria-labelledby="raising-story-title"><div class="raising-story-heading"><span class="raising-eyebrow">성장 이야기 ${step+1} / ${total}</span><span>${stages[stage]}</span></div><h4 id="raising-story-title">${html(event?.title)}</h4><p>${html(event?.text)}</p>${r.lastFeedback?`<div class="raising-feedback"><span aria-hidden="true">✦</span><p>${html(r.lastFeedback)}</p></div>`:''}<button type="button" class="cozy-btn primary raising-story-confirm" data-raising-story-confirm>확인</button></section>`:chosen?`<section class="raising-map-dialog raising-method" role="region" aria-labelledby="raising-method-title"><span class="raising-eyebrow">${html(chosen.name)}</span><h4 id="raising-method-title">아기별에게 어떤 방법을 알려줄까요?</h4><p class="raising-choice-hint">${html(event?.title)}</p><div class="raising-choices">${(event?.choices||[]).map((choice,i)=>`<button type="button" data-raising-choice="${html(choice.id)}" class="raising-choice"><span aria-hidden="true">${i===0?'☾':'✦'}</span><b>${html(choice.label)}</b><span aria-hidden="true">→</span></button>`).join('')}</div><button type="button" class="cozy-btn raising-place-back" data-raising-place-back>다른 장소 고르기</button></section>`:'';
  content=event?`<section class="raising-village" aria-label="아기별 배움 마을"><div class="raising-map-picture" ${overlay?'inert':''}><img src="/assets/cozy/star-learning-village.png" alt="여섯 배움터가 모인 아기별 마을"><div class="raising-places">${(catalog.activities||[]).map(a=>`<button type="button" data-raising-activity="${html(a.id)}" class="raising-place place-${html(a.id)}" aria-label="${html(a.name)}에서 배우기"><b>${html(a.name)}</b></button>`).join('')}</div></div><p class="raising-map-hint" ${overlay?'inert':''}>함께 가고 싶은 장소를 눌러주세요.</p>${overlay?`<div class="raising-map-overlay">${overlay}</div>`:''}</section>`:'';
 }
 return `<div class="raising-game"><div class="raising-profile">${portrait}<div><h4>${html(pet.name)}</h4>${journal}<p class="raising-small">${complete?'꿈을 찾았어요!':`${step}/${total} 이야기 완료`}</p></div></div><div class="raising-main">${content}</div><div class="raising-reward"><span aria-hidden="true">✦</span><div><b>이야기 완성 보상</b><p>${html(reward)}</p></div></div></div>`;
}
