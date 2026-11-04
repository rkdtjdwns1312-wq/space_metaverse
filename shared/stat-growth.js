export const STAT_GROWTH_KEYS=Object.freeze(['hp','mp','attack','defense']);
const rule=(cost,weights,amounts)=>Object.freeze({cost,weights:Object.freeze(weights),amounts:Object.freeze(amounts)});
export const STAT_GROWTH_LEVELS=Object.freeze({
  2:rule(20,{hp:45,mp:45,attack:5,defense:5},{hp:1,mp:1,attack:1,defense:1}),
  3:rule(60,{hp:40,mp:40,attack:15,defense:5},{hp:1,mp:1,attack:1,defense:1}),
  4:rule(140,{hp:40,mp:40,attack:10,defense:10},{hp:2,mp:2,attack:1,defense:1}),
  5:rule(300,{hp:35,mp:35,attack:20,defense:10},{hp:3,mp:3,attack:2,defense:1})
});
export const statGrowthRule=level=>Number.isInteger(level)?STAT_GROWTH_LEVELS[level]??null:null;
export function statGrowthBonus(player,key){
  const value=player?.statGrowth?.bonuses?.[key];
  return Number.isSafeInteger(value)&&value>=0?value:0;
}
