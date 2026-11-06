import {infiniteEnergyConfig,infiniteEnergyStacks} from '../shared/infinite-energy.js';

export function gainInfiniteEnergy(player,now){
  const config=infiniteEnergyConfig(player);if(!config)return;
  const stacks=Math.min(config.maxStacks,infiniteEnergyStacks(player,now)+1);
  // Delayed damage can carry an earlier simulation tick than a recent direct hit.
  const endsAt=Math.max(player.infiniteEnergy?.endsAt||0,now+config.durationMs);
  player.infiniteEnergy={stacks,endsAt};
}

// Publish at most one update per wearer per simulation tick. Catch expiry even
// when nobody attacks again; reconnecting clients also get the current snapshot.
export function infiniteEnergyChanged(player,now){
  if(player.infiniteEnergy&&!infiniteEnergyStacks(player,now)){
    delete player.infiniteEnergy;
    delete player.lastSentInfiniteEnergy;
    return true;
  }
  if(player.infiniteEnergy===player.lastSentInfiniteEnergy)return false;
  player.lastSentInfiniteEnergy=player.infiniteEnergy;
  return true;
}
