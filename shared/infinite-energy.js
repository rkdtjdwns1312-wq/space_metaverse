export const INFINITE_BRACELET='infinite-star-bracelet';
export const INFINITE_ENERGY=Object.freeze({maxStacks:5,durationMs:10000});
export function infiniteEnergyStacks(player,now=Date.now()){
  const state=player?.infiniteEnergy;
  return state&&state.endsAt>now&&player.equipmentSlots?.includes(INFINITE_BRACELET)?state.stacks:0;
}
export function infiniteEnergyEffect(player,now){
  const stacks=infiniteEnergyStacks(player,now);
  return stacks?{statusId:'infinite-energy',label:'무한의기운 · 공격력 +'+stacks,icon:'∞',style:'combat',
    stacks,until:player.infiniteEnergy.endsAt,remainingMs:player.infiniteEnergy.endsAt-now}:null;
}
