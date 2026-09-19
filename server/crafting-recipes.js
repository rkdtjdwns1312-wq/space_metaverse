import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {SHOP} from '../shared/config.js';

// Git·웹 공개 대상이 아닌 data 파일에 실제 조합법을 보관합니다.
// 다른 PC로 옮길 때 학급 데이터와 함께 이 파일도 비공개로 복사해야 합니다.
export function loadCraftingRecipes(path=process.env.CRAFTING_RECIPES_FILE||'data/crafting-recipes.json'){
  const absolute=resolve(path);if(!existsSync(absolute))return [];
  const recipes=JSON.parse(readFileSync(absolute,'utf8').replace(/^\uFEFF/,''));
  if(!Array.isArray(recipes))throw new Error('비밀 조합법 파일의 형식이 올바르지 않습니다.');
  for(const recipe of recipes){
    const output=SHOP.items.find(i=>i.id===recipe?.output?.id),seen=new Set();
    if(!output||output.level<2||output.level>5||!Array.isArray(recipe.ingredients)||!recipe.ingredients.length||recipe.ingredients.length>16)throw new Error('비밀 조합법의 완성품을 확인해주세요.');
    let maxLevel=0;
    for(const part of recipe.ingredients){const item=SHOP.items.find(i=>i.id===part?.id);
      if(!item||seen.has(item.id)||!Number.isSafeInteger(part.quantity)||part.quantity<1||part.quantity>99||item.level>=output.level)throw new Error('비밀 조합법의 재료를 확인해주세요.');
      seen.add(item.id);maxLevel=Math.max(maxLevel,item.level);
    }
    if(maxLevel+1!==output.level)throw new Error('조합은 바로 다음 레벨 아이템으로 진행합니다.');
  }
  return recipes;
}
