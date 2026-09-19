import { CRAFTING } from '../shared/crafting.js';
import { SHOP } from '../shared/config.js';

const validId = value => typeof value === 'string' && value.length > 0;
const levelOf = item => Number.isSafeInteger(item?.level) ? item.level : null;

function fail(player, error) {
  return { success: false, item: null, error, balance: player?.starShards ?? 0, inventory: player?.inventory ?? [] };
}

function recipeParts(recipe) {
  const ingredients = recipe?.ingredients;
  const output = recipe?.output;
  if (!Array.isArray(ingredients) || !output || !validId(output.id) || ingredients.length < 1) return null;
  return { ingredients, output };
}

function normalizeIngredients(input, maxQuantity) {
  if (!Array.isArray(input) || input.length < 1 || input.length > CRAFTING.slots) return null;
  const seen = new Set();
  const result = [];
  for (const part of input) {
    if (!part || !validId(part.id) || seen.has(part.id) ||
        !Number.isSafeInteger(part.quantity) || part.quantity < 1 || part.quantity > maxQuantity) return null;
    seen.add(part.id);
    result.push({ id: part.id, quantity: part.quantity });
  }
  return result;
}

function sameMultiset(left, right) {
  if (left.length !== right.length) return false;
  const a = new Map(left.map(part => [part.id, part.quantity]));
  return right.every(part => a.get(part.id) === part.quantity);
}

function validRecipe(recipe, catalog, maxQuantity) {
  const parts = recipeParts(recipe);
  if (!parts) return null;
  const ingredients = normalizeIngredients(parts.ingredients, maxQuantity);
  if (!ingredients || parts.output.quantity !== undefined && parts.output.quantity !== 1) return null;
  const output = catalog.find(item => item?.id === parts.output.id);
  if (!output) return null;
  const outputLevel = levelOf(output);
  if (outputLevel === null || outputLevel < 2 || outputLevel > 5) return null;
  const levels = ingredients.map(part => levelOf(catalog.find(item => item?.id === part.id)));
  if (levels.some(level => level === null || level >= outputLevel) || Math.max(...levels) + 1 !== outputLevel) return null;
  return { ingredients, output };
}

// 서버에서만 호출하며, 검증 실패는 재화와 재료를 함께 보존합니다.
export function attemptCraft(player, input, { recipes = [], catalog = SHOP.items } = {}) {
  if (!player || !Array.isArray(player.inventory) || !Number.isSafeInteger(player.starShards) || player.starShards < 0 ||
      !Array.isArray(recipes) || !Array.isArray(catalog)) return fail(player || {}, 'invalid-player');
  if (recipes.length === 0) return fail(player, 'invalid-recipe');
  const ingredients = normalizeIngredients(input, CRAFTING.maxQuantity);
  if (!ingredients) return fail(player, 'invalid-input');
  const known = new Map(catalog.filter(item => validId(item?.id)).map(item => [item.id, item]));
  if (ingredients.some(part => !known.has(part.id))) return fail(player, 'unknown-ingredient');
  const owned = new Map(player.inventory.filter(item => validId(item?.id)).map(item => [item.id, item]));
  if (ingredients.some(part => !Number.isSafeInteger(owned.get(part.id)?.quantity) || owned.get(part.id).quantity < part.quantity)) return fail(player, 'insufficient-ingredients');
  const validRecipes = recipes.map(recipe => validRecipe(recipe, catalog, CRAFTING.maxQuantity)).filter(Boolean);
  if (validRecipes.length === 0) return fail(player, 'invalid-recipe');
  const match = validRecipes.find(recipe => sameMultiset(recipe.ingredients, ingredients));
  if (!match) {
    if (player.starShards < CRAFTING.fee) return fail(player, 'insufficient-fee');
    player.starShards -= CRAFTING.fee;
    return { success: false, item: null, error: 'recipe-mismatch', balance: player.starShards, inventory: player.inventory };
  }
  const outputEntry = owned.get(match.output.id);
  if(match.output.maxOwned && (outputEntry?.quantity||0)+1>match.output.maxOwned)return fail(player,'output-stack-full');
  if (outputEntry && outputEntry.quantity >= CRAFTING.maxQuantity) return fail(player, 'output-stack-full');
  const consumedKinds = ingredients.reduce((count, part) => count + (owned.get(part.id).quantity === part.quantity ? 1 : 0), 0);
  const resultingKinds = player.inventory.length - consumedKinds + (outputEntry ? 0 : 1);
  if (resultingKinds > SHOP.maxKinds) return fail(player, 'inventory-full');
  if (player.starShards < CRAFTING.fee) return fail(player, 'insufficient-fee');
  for (const part of ingredients) {
    const entry = owned.get(part.id);
    entry.quantity -= part.quantity;
    if (entry.quantity === 0) player.inventory.splice(player.inventory.indexOf(entry), 1);
  }
  if (outputEntry && outputEntry.quantity < CRAFTING.maxQuantity) outputEntry.quantity += 1;
  else player.inventory.push({ id: match.output.id, quantity: 1 });
  player.starShards -= CRAFTING.fee;
  return { success: true, item: match.output, error: null, balance: player.starShards, inventory: player.inventory };
}
