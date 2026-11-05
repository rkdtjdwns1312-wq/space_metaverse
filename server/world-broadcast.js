import {monsterViews} from './monsters.js';
import {visibleGatherMonsters} from './forgotten-constellation-gather.js';
import {serenaView,darkStarView,starRecordView,forgottenConstellationView,truthCreatorView} from './boss-lifecycle.js';
import {spiritOrbViews} from './spirit-king-skills.js';
import {spiritBlueStarViews} from './spirit-blue-stars.js';
import {projectileViews} from './projectiles.js';
import {aquariusViews,aquariusCooldowns} from './aquarius-skills.js';
import {corvusCooldowns} from './corvus-skills.js';
import {ophiuchusViews,ophiuchusCooldowns} from './ophiuchus-skills.js';
import {waterAuraViews,waterCooldowns} from './water-skills.js';
import {swanAuraViews,swanCooldowns} from './swan-skills.js';
import {geminiCooldowns} from './gemini-skills.js';
import {ariesCloudViews,ariesCooldowns} from './aries-skills.js';
import {taurusDashViews,taurusCooldowns} from './taurus-skills.js';
import {herculesShieldViews,herculesCooldowns} from './hercules-skills.js';
import {libraAuraViews,libraCooldowns} from './libra-skills.js';
import {coronaAuraViews,coronaCooldowns} from './corona-skills.js';
import {capricornBlessingViews,capricornCooldowns} from './capricorn-skills.js';
import {leoCooldowns} from './leo-skills.js';
import {sagittariusViews,skillCooldowns} from './sagittarius-skills.js';
import {usesTeacherSkill,teacherCooldowns} from './teacher-skill.js';
import {isWaterConstellation} from '../shared/water-skills.js';

const cooldownViews={aquarius:aquariusCooldowns,corvus:corvusCooldowns,cygnus:swanCooldowns,
  ophiuchus:ophiuchusCooldowns,gemini:geminiCooldowns,aries:ariesCooldowns,taurus:taurusCooldowns,
  hercules:herculesCooldowns,libra:libraCooldowns,'corona-borealis':coronaCooldowns,
  capricorn:capricornCooldowns,leo:leoCooldowns};
const effectViews={spiritOrbs:spiritOrbViews,spiritBlueStars:spiritBlueStarViews,projectiles:projectileViews,
  aquarius:aquariusViews,ophiuchus:ophiuchusViews,water:waterAuraViews,swan:swanAuraViews,
  aries:ariesCloudViews,taurus:taurusDashViews,hercules:herculesShieldViews,libra:libraAuraViews,
  corona:coronaAuraViews,capricorn:capricornBlessingViews};

// A frame lives for one broadcast only. Each occupied map shares its immutable views;
// every packet still contains a complete replacement, including empty arrays.
export function worldBroadcastFrame(room,now){
  const monstersByMap=new Map(),maps=new Map();
  for(const monster of monsterViews(room,now)){
    if(!monstersByMap.has(monster.mapId))monstersByMap.set(monster.mapId,[]);
    monstersByMap.get(monster.mapId).push(monster);
  }
  // Statue/respawn state remains global for map navigation and boss interfaces.
  const bosses={serena:serenaView(room),darkStar:darkStarView(room),starRecord:starRecordView(room),forgottenConstellation:forgottenConstellationView(room),truthCreator:truthCreatorView(room)};
  return (viewer,positions)=>{
    const mapId=viewer.mapId;
    if(!maps.has(mapId)){
      const effects=Object.fromEntries(Object.entries(effectViews).map(([key,view])=>[key,view(room,mapId,now)]));
      const monsters=monstersByMap.get(mapId)||[];
      maps.set(mapId,{...bosses,...effects,monsters,studentMonsters:visibleGatherMonsters(room,monsters,{mapId,role:'student'}),casts:sagittariusViews(room,mapId,now)});
    }
    const {casts,studentMonsters,...shared}=maps.get(mapId);
    const cooldownView=usesTeacherSkill(viewer)?teacherCooldowns:
      cooldownViews[viewer.avatar.constellationId]||(isWaterConstellation(viewer)?waterCooldowns:skillCooldowns);
    return {...shared,monsters:viewer.role==='teacher'?shared.monsters:studentMonsters,mapId,positions,positionTime:now,sagittarius:{casts,cooldowns:cooldownView(viewer,now),serverNow:now}};
  };
}
