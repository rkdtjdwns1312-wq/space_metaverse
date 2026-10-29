import {preloadWaterMonsterArt} from './water-monster-art.js';
import {preloadLv2MonsterArt} from './lv2-monster-art.js';
import {preloadSunMonsterArt} from './sun-monster-art.js';
import {preloadCelestialArt} from './celestial-monster-art.js';
import {preloadBossArt} from './boss-monster-art.js';
import {preloadGuardianArt} from './guardian-monster-art.js';
import {preloadMonsterAttack} from './monster-attack-frames.js';
import {preloadOriginWalkArt} from './origin-monster-walk.js';

const prepared=new Map();
// Only prepare species present in the current map, once per page. The rendering
// modules own their images, so preloading warms the exact objects they draw.
export function prepareMonsterArt(shape){
  if(!shape)return Promise.resolve([]);
  if(!prepared.has(shape)){
    const tasks=[preloadWaterMonsterArt(shape),preloadLv2MonsterArt(shape),
      preloadSunMonsterArt(shape),preloadCelestialArt(shape),
      preloadMonsterAttack(shape),preloadOriginWalkArt(shape)];
    if(['leoon','noksera','spirit-king','serena','dark-star'].includes(shape))tasks.push(preloadBossArt(shape));
    if(shape==='star-guardian')tasks.push(preloadGuardianArt());
    prepared.set(shape,Promise.allSettled(tasks));
  }
  return prepared.get(shape);
}
