export const STAT_GROWTH_COST=100;
export const STAT_GROWTH_WEIGHTS=Object.freeze({hp:40,mp:40,attack:10,defense:10});
export function statGrowthBonus(player,key){
  const value=player?.statGrowth?.bonuses?.[key];
  return Number.isSafeInteger(value)&&value>=0?value:0;
}
