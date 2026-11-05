// Possessions prove acquisition regardless of who dealt the final blow.
// Recipe knowledge and recipe cards are deliberately excluded.
export const BOSS_ITEM_CREDITS=Object.freeze(Object.fromEntries(Object.entries({
  'leoon-claw':['leoon'],'sun-ring':['leoon'],
  'noksera-horn':['noksera'],'moon-earring':['noksera'],
  'burning-ice-necklace':['leoon','noksera'],
  'spirit-king-soul':['spirit-king'],'spirit-king-cloak':['spirit-king'],
  'radiant-star-origin':['serena'],'primordial-star-gem':['serena'],
  'black-gem':['dark-star'],'primordial-star-sigil':['dark-star'],
  'origin-star-record':['star-record'],'truth-record':['star-record'],
  'infinite-star-fragment':['forgotten-constellation'],'infinite-star-bracelet':['forgotten-constellation'],
  'truth-gem':['truth-creator'],'truth-convergence':['truth-creator']
}).map(([id,bosses])=>[id,Object.freeze(bosses)])));

export function bossItemEvidence(player){
  const found=new Set();
  const add=id=>{if(Object.hasOwn(BOSS_ITEM_CREDITS,id))for(const boss of BOSS_ITEM_CREDITS[id])found.add(boss);};
  for(const item of player?.inventory||[])if(Number.isSafeInteger(item?.quantity)&&item.quantity>0)add(item.id);
  for(const id of player?.equipmentSlots||[])if(typeof id==='string')add(id);
  // The server temporarily stores previously worn gear during the Corona Lv1 trial.
  for(const id of player?.constellationAbilityState?.coronaTrial?.savedEquipmentSlots||[])if(typeof id==='string')add(id);
  return [...found].sort();
}
