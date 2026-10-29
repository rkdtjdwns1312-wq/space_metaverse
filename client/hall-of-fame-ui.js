export function createHallOfFameUI({request,stop,toast}){
  const dialog=document.createElement('dialog');dialog.className='hall-of-fame-dialog';dialog.setAttribute('aria-labelledby','hall-of-fame-title');
  Object.assign(dialog.style,{width:'min(440px,calc(100vw - 28px))',maxHeight:'min(82vh,720px)',boxSizing:'border-box',padding:'22px',border:'3px solid #d7c28a',borderRadius:'24px',background:'linear-gradient(#fffdf5,#f8f1df)',color:'#41365a',boxShadow:'0 14px 48px #241b3c55'});
  const heading=document.createElement('h2');heading.id='hall-of-fame-title';heading.textContent='명예의 전당';
  Object.assign(heading.style,{margin:'0 0 14px',textAlign:'center',fontFamily:'Jua,"Malgun Gothic",sans-serif',fontSize:'28px'});
  const list=document.createElement('div');Object.assign(list.style,{display:'grid',gap:'12px',maxHeight:'62vh',overflowY:'auto'});
  const close=document.createElement('button');close.type='button';close.textContent='닫기';close.style.cssText='display:block;margin:16px auto 0;min-height:44px;padding:8px 22px;border:2px solid #d4c5e8;border-radius:14px;background:#f1eaff;color:#514271;font-weight:800;';
  close.addEventListener('click',()=>dialog.close());dialog.append(heading,list,close);document.body.append(dialog);
  dialog.addEventListener('close',()=>{$('world')?.focus?.();});
  function render(data){
    list.replaceChildren();
    for(const game of (Array.isArray(data?.games)?data.games:[data?.memory,data?.omok])){
      if(!game)continue;
      const section=document.createElement('section');Object.assign(section.style,{padding:'12px 14px',border:'2px solid #e6d9b9',borderRadius:'16px',background:'#fffaf0'});
      const title=document.createElement('h3');title.textContent=game.title;Object.assign(title.style,{margin:'0 0 8px',fontSize:'17px',textAlign:'center'});section.append(title);
      if(game.winners?.length){
        const names=document.createElement('ol');names.style.cssText='display:flex;flex-direction:column;align-items:center;gap:5px;margin:0;padding:0;list-style:none;font-weight:800;font-size:19px;';
        for(const nickname of game.winners){const row=document.createElement('li');row.textContent=nickname;names.append(row);}section.append(names);
      }else{const empty=document.createElement('p');empty.textContent='아직 이번 주 1등 기록이 없어요.';empty.style.cssText='margin:0;text-align:center;color:#766b80;';section.append(empty);}
      list.append(section);
    }
  }
  return {async open(){stop?.();list.textContent='순위를 불러오고 있어요.';dialog.showModal();try{render(await request('hall-of-fame:read',{}));}catch(error){list.textContent=error.message;toast?.(error.message);}},destroy(){dialog.remove();}};
}

const $=id=>document.getElementById(id);
