import {EQUIPMENT_ITEMS,equipmentOf,validateEquipmentSlots} from '../shared/equipment.js';
import {SHOP} from '../shared/config.js';
import {GameError} from './rooms.js';

function ensure(ok,message){if(!ok)throw new GameError(message);}
const levelOf=p=>p.role==='teacher'?5:p.avatar?.level||1;
function addToBag(player,itemId){
  const row=player.inventory.find(entry=>entry.id===itemId);
  ensure(row?row.quantity<SHOP.maxStack:player.inventory.length<SHOP.maxKinds,'가방에 빈칸이 없어요.');
  if(row)row.quantity++;else player.inventory.push({id:itemId,quantity:1});
}
export function buyEquipment(player,itemId){
  const item=equipmentOf(itemId);ensure(item&&EQUIPMENT_ITEMS.includes(item),'우주에너지 상점의 물건을 골라주세요.');
  ensure(levelOf(player)>=item.level,'이 장비는 LV'+item.level+'부터 살 수 있어요.');
  const free=player.role==='teacher';
  ensure(free||Number.isSafeInteger(player.cosmicEnergy)&&player.cosmicEnergy>=item.price,'우주에너지가 부족해요.');
  addToBag(player,item.id);
  if(!free)player.cosmicEnergy-=item.price;
  return {inventory:[...player.inventory],cosmicEnergy:player.cosmicEnergy};
}
export function equip(player,itemId,slot){
  const item=equipmentOf(itemId);ensure(item,'장착할 수 있는 장비가 아니에요.');
  ensure(Number.isInteger(slot)&&slot>=1&&slot<=3,'장비 칸을 다시 골라주세요.');
  ensure(levelOf(player)>=item.level,'이 장비는 LV'+item.level+'부터 장착할 수 있어요.');
  const slots=validateEquipmentSlots(player.equipmentSlots),row=player.inventory.find(entry=>entry.id===itemId);
  ensure(row?.quantity>0,'가방에 장비가 없어요.');
  ensure(!slots.includes(itemId),'같은 장비는 한 번만 장착할 수 있어요.');
  const previous=slots[slot-1];
  // 교체할 때 빈칸이 필요한 경우는 먼저 검사하여 기존 장비를 잃지 않게 합니다.
  ensure(!previous||!player.inventory.some(entry=>entry.id===previous&&entry.quantity>=SHOP.maxStack),'가방에 장비를 더 담을 수 없어요.');
  if(previous&&!player.inventory.some(entry=>entry.id===previous)&&player.inventory.length>=SHOP.maxKinds&&row.quantity>1)
    throw new GameError('가방에 빈칸이 없어서 장비를 바꿀 수 없어요.');
  row.quantity--;if(row.quantity===0)player.inventory=player.inventory.filter(entry=>entry!==row);
  if(previous)addToBag(player,previous);
  slots[slot-1]=itemId;player.equipmentSlots=slots;
  return {inventory:[...player.inventory],equipmentSlots:[...slots]};
}
export function unequip(player,slot){
  ensure(Number.isInteger(slot)&&slot>=1&&slot<=3,'장비 칸을 다시 골라주세요.');
  const slots=validateEquipmentSlots(player.equipmentSlots),itemId=slots[slot-1];ensure(itemId,'비어 있는 칸이에요.');
  addToBag(player,itemId);slots[slot-1]=null;player.equipmentSlots=slots;
  return {inventory:[...player.inventory],equipmentSlots:[...slots]};
}
