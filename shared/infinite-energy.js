import {equipmentOf,equipmentBaseId} from './equipment.js';
export const INFINITE_BRACELET='infinite-star-bracelet';
export const INFINITE_ENERGY=Object.freeze({maxStacks:3,durationMs:5000});
export function infiniteEnergyConfig(player){
  const id=player?.equipmentSlots?.find(id=>equipmentBaseId(id)===INFINITE_BRACELET),item=equipmentOf(id);
  return item?{maxStacks:item.infiniteMaxStacks,durationMs:item.infiniteDurationMs}:null;
}
export function infiniteEnergyStacks(player,now=Date.now()){
  const state=player?.infiniteEnergy;
  const config=infiniteEnergyConfig(player);
  return state&&state.endsAt>now&&config?Math.min(config.maxStacks,state.stacks):0;
}
export function infiniteEnergyEffect(player,now){
  const stacks=infiniteEnergyStacks(player,now);
  return stacks?{statusId:'infinite-energy',label:'무한의기운 · 공격력 +'+stacks,icon:'∞',style:'combat',
    stacks,until:player.infiniteEnergy.endsAt,remainingMs:player.infiniteEnergy.endsAt-now}:null;
}
