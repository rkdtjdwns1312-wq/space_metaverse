import {SHOP, ITEM_USE, itemOf} from '../shared/config.js';
import {recipeItemId} from '../shared/recipe-items.js';
import {ensure} from './rooms.js';
import {collectSunTax, hasLv2ItemBlock} from './lv2-item-effects.js';
import {hasCardStatus} from './item-cards.js';
import {activeItemBlocks} from './constellation-abilities.js';
import {requireStarCardItemAccess} from './star-cards.js';

// Recipe identities are their output IDs. The catalogue contains no ingredient data.
export function validateLearnedRecipeIds(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > SHOP.items.length || new Set(value).size !== value.length ||
      value.some(id => typeof id !== 'string' || !itemOf(recipeItemId(id))))
    throw new Error('배운 조합법 저장 데이터가 올바르지 않습니다.');
  return [...value];
}
export function learnedRecipesView(player, recipes) {
  const learned = new Set(player.learnedRecipeIds || []);
  return recipes.filter(recipe => learned.has(recipe.output.id)).map(recipe => ({
    output: {id: recipe.output.id, quantity: 1},
    ingredients: recipe.ingredients.map(part => ({id: part.id, quantity: part.quantity}))
  }));
}
export function useRecipeItem(room, player, data, recipes, now = Date.now()) {
  ensure(room.players.get(player?.id) === player && player.connected && !player.away, '먼저 교실에 입장해주세요.');
  ensure(!data.playerId || data.playerId === player.id, '조합법은 본인만 배울 수 있어요.');
  ensure(!data.targetId || data.targetId === player.id, '조합법은 본인만 배울 수 있어요.');
  ensure(!data.targetIds || (Array.isArray(data.targetIds) && data.targetIds.length === 1 && data.targetIds[0] === player.id), '조합법은 본인만 배울 수 있어요.');
  const item = itemOf(data.itemId), owned = player.inventory.find(entry => entry.id === data.itemId);
  ensure(item?.mode === 'recipe' && owned?.quantity > 0, '가방에 그 조합법이 없어요.');
  ensure((player.role === 'teacher' ? ITEM_USE.teacherLevel : player.avatar.level) >= item.level, '캐릭터의 lv보다 높은 아이템으로 사용할 수 없습니다');
  requireStarCardItemAccess(room, player, now);
  ensure(!hasCardStatus(player, 'little-sun-card', now) && !hasLv2ItemBlock(player, now) && !activeItemBlocks(player, now).length, '지금은 아이템을 사용할 수 없어요.');
  ensure(recipes.some(recipe => recipe.output.id === item.outputId), '이 조합법은 현재 준비 중이에요. 아이템은 그대로예요.');
  if ((player.learnedRecipeIds || []).includes(item.outputId)) return {
    learned: false, alreadyLearned: true, recipeId: item.outputId, inventory: structuredClone(player.inventory),
    message: '이미 배운 조합법이에요. 아이템은 소모하지 않았어요.'
  };
  ensure(now - (player.lastItemUseAt || 0) >= ITEM_USE.cooldownMs, '조금 천천히 써요.');
  // All rejection checks precede the tax/consumption/learning commit.
  collectSunTax(room, player, now);
  owned.quantity--;
  player.inventory = player.inventory.filter(entry => entry.quantity > 0);
  player.learnedRecipeIds = [...(player.learnedRecipeIds || []), item.outputId];
  player.lastItemUseAt = now;
  return {learned: true, alreadyLearned: false, recipeId: item.outputId,
    inventory: structuredClone(player.inventory), message: item.name + '를 배웠어요.'};
}
