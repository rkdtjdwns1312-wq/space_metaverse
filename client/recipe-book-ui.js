import {itemOf} from '/shared/config.js';

export function createRecipeBookUI({request,toast}){
  const dialog=document.createElement('dialog');dialog.id='recipe-book-dialog';
  const title=document.createElement('h2');title.textContent='내 조합레시피';
  const note=document.createElement('p');note.className='muted';
  const list=document.createElement('ul');list.className='recipe-book-list';
  const actions=document.createElement('div');actions.className='dialog-actions';
  const close=document.createElement('button');close.type='button';close.className='secondary';close.textContent='닫기';close.onclick=()=>dialog.close();actions.append(close);
  dialog.append(title,note,list,actions);document.body.append(dialog);let revision=0;
  return {async open(){
    const ticket=++revision;list.replaceChildren();note.textContent='배운 조합법을 불러오는 중이에요.';if(!dialog.open)dialog.showModal();
    try{
      const reply=await request('recipes:learned',{});if(ticket!==revision||!dialog.open)return;
      note.textContent=reply.recipes.length?'직접 만들거나 레시피를 사용해서 배운 조합법이에요.':'아직 배운 조합법이 없어요. 조합에 성공하거나 레시피 아이템을 사용해 보세요.';
      for(const recipe of reply.recipes){
        const item=itemOf(recipe.output.id);if(!item)continue;
        const li=document.createElement('li');li.dataset.recipeId=recipe.output.id;
        const name=document.createElement('strong');name.textContent=item.name+' · Lv'+item.level;
        if(item.art){const image=document.createElement('img');image.src=item.art;image.alt='';li.append(image);}
        const ingredients=document.createElement('p');ingredients.textContent=recipe.ingredients.map(part=>(itemOf(part.id)?.name||part.id)+' × '+part.quantity).join(' + ');
        li.append(name,ingredients);list.append(li);
      }
    }catch(error){if(ticket===revision){note.textContent='조합법을 불러오지 못했어요.';toast(error.message);}}
  },reset(){revision++;list.replaceChildren();dialog.close();}};
}
