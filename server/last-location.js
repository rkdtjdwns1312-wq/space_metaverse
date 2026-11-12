import {sleepingStarsEligible} from '../shared/sleeping-stars.js';
import {migrateLegacyPlazaPosition} from '../shared/plaza-layout.js';
import {migrateLegacyStreetPosition} from '../shared/street-layout.js';
import {PLAZA_ID,STREET_ID,BLACK_HOLE_ID,WHALE_STOMACH_ID,STATIC_MAPS,mapOf,planetIdOfMap} from '../shared/config.js';
import {TRUTH_CREATOR,truthCreatorEligible} from '../shared/truth-creator.js';
import {huntingExempt,huntingTimeView,isHuntingMap} from './hunting-time.js';
import {arrivePosition,spawnInside} from './world.js';

export function validateLastLocation(value){
  if(!value||typeof value.mapId!=='string'||value.mapId.length>160||
    !Number.isFinite(value.x)||!Number.isFinite(value.y)||value.x<0||value.y<0||value.x>100000||value.y>100000)return null;
  return {mapId:value.mapId,x:value.x,y:value.y};
}

// Stage only the affected student's exit, never mutate records during serialization.
export function rememberStudentLocation(player){
  if(player?.role==='student'&&!player.away){
    const location=validateLastLocation(player);
    if(location)player.lastLocation=location;
  }
}

export function studentReturnPosition(room,player,now,location=player.lastLocation){
  const raw=validateLastLocation(location),saved=raw?migrateLegacyPlazaPosition(migrateLegacyStreetPosition(raw)):null;
  const forced=player.avatar.blackStar?BLACK_HOLE_ID:
    player.constellationAbilityState?.cetusStomach?.endsAt>now?WHALE_STOMACH_ID:null;
  let mapId=forced||saved?.mapId||PLAZA_ID;
  if(!forced){
    const departmentId=planetIdOfMap(mapId),department=departmentId&&room.planets.get(departmentId);
    if((departmentId?(!department||player.avatar.departmentId!==departmentId):!Object.hasOwn(STATIC_MAPS,mapId))||
      mapId===BLACK_HOLE_ID||mapId===WHALE_STOMACH_ID)mapId=PLAZA_ID;
    const map=mapOf(mapId,room.planets.values());
    if(!sleepingStarsEligible(player,mapId)||(map.minLevel&&player.avatar.level<map.minLevel)||
      (mapId===TRUTH_CREATOR.mapId&&!truthCreatorEligible(player)))mapId=PLAZA_ID;
    if(isHuntingMap(mapId)&&!huntingExempt(player)&&huntingTimeView(player,now).remainingMs<=0)mapId=STREET_ID;
  }
  try{
    const point=saved?.mapId===mapId?saved:mapOf(mapId,room.planets.values()).spawn;
    return {...arrivePosition(room,mapId,point,player),mapId};
  }catch{
    // A changed room layout can remove the old safe point. Required confinement wins.
    const fallback=forced||PLAZA_ID;
    return {...spawnInside(room,fallback,player),mapId:fallback};
  }
}
