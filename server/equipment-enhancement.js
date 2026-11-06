import {randomInt} from 'node:crypto';
import {equipmentOf,enhancementInfo} from '../shared/equipment.js';
import {SHOP} from '../shared/config.js';
import {GameError} from './rooms.js';
const ensure=(ok,message)=>{if(!ok)throw new GameError(message);};

// Inventory rows represent interchangeable copies of exactly the same stage.
// Worn copies are separate and never mutated by an enhancement attempt.
export function enhanceEquipment(player,{itemId,materialId},{draw=()=>randomInt(100)/100}={}){
  const info=enhancementInfo(itemId);
  ensure(info,'아직 강화할 수 없는 장비예요.');
  ensure(info.nextStage!==null,'이미 최고 단계인 +9 장비예요.');
  ensure(info.materialIds.includes(materialId),'이 장비에 맞는 보스 재료를 골라주세요.');
  const row=player.inventory.find(e=>e.id===itemId),material=player.inventory.find(e=>e.id===materialId);
  ensure(row?.quantity>0,'강화할 장비를 먼저 해제해서 가방에 넣어주세요.');
  ensure(material?.quantity>0,'가방에 강화 재료가 부족해요.');
  const output=player.inventory.find(e=>e.id===info.nextItemId);
  ensure(!output||output.quantity<SHOP.maxStack,'강화된 장비를 가방에 더 담을 수 없어요.');
  const kinds=player.inventory.length-(row.quantity===1?1:0)-(material.quantity===1?1:0)+(output?0:1);
  ensure(kinds<=SHOP.maxKinds,'강화된 장비를 담을 가방 빈칸이 필요해요.');
  const roll=draw();ensure(Number.isFinite(roll)&&roll>=0&&roll<1,'강화를 처리하지 못했어요. 다시 시도해주세요.');
  const success=roll<info.chance;
  material.quantity--;
  if(success){row.quantity--;if(output)output.quantity++;else player.inventory.push({id:info.nextItemId,quantity:1});}
  player.inventory=player.inventory.filter(e=>e.quantity>0);
  const resultId=success?info.nextItemId:itemId;
  return {success,item:equipmentOf(resultId),itemId:resultId,previousItemId:itemId,stage:success?info.nextStage:info.stage,chance:info.chance,materialId,
    inventory:[...player.inventory],equipmentSlots:[...(player.equipmentSlots||[null,null,null])],balance:player.starShards,energyBalance:player.cosmicEnergy??0};
}
