import {itemOf, SHARDS, SHOP} from '../shared/config.js';
import {ensure} from './rooms.js';

// 포식은 서버의 사용 기록에서만 대상을 고릅니다. 클라이언트가 아이템이나 가격을 지정할 수 없습니다.
function eaterFor(room, eaterId, markerId, now) {
  const eater = room.players.get(eaterId);
  const marker = eater?.cardMarkers?.find(m => m.id === markerId && m.itemId === 'alien-creature-card' &&
    Number.isSafeInteger(m.startsAt) && m.startsAt <= now && m.until > now && !m.holdingAbility);
  ensure(eater?.role === 'student' && marker, '지금 포식 상태인 친구를 선택해주세요.');
  return eater;
}

function targets(room, eater, now) {
  const out = [];
  for (const victim of room.players.values()) {
    if (victim.role !== 'student' || victim.id === eater.id) continue;
    for (const marker of victim.cardMarkers || []) {
      const item = itemOf(marker.itemId);
      if (!item || item.level > 2 || marker.until !== null && marker.until <= now ||
          marker.holdingAbility || !Number.isSafeInteger(item.price) || item.price < 0) continue;
      out.push({victimId: victim.id, nickname: victim.nickname, kind: 'marker', recordId: marker.id,
        itemId: item.id, itemName: item.name, refund: Math.floor(item.price / 2)});
    }
    for (const effect of victim.effects || []) {
      const item = itemOf(effect.itemId);
      if (!item || item.level > 2 || effect.until <= now || !Number.isSafeInteger(item.price) || item.price < 0) continue;
      out.push({victimId: victim.id, nickname: victim.nickname, kind: 'effect', recordId: item.id,
        itemId: item.id, itemName: item.name, refund: Math.floor(item.price / 2)});
    }
  }
  return out;
}

export function devourOptions(room, teacher, data, now = Date.now()) {
  ensure(teacher?.role === 'teacher', '선생님만 포식을 처리할 수 있어요.');
  const eater = eaterFor(room, data.eaterId, data.markerId, now);
  return {eaterName: eater.nickname, rows: targets(room, eater, now)};
}

export function devourItem(room, teacher, data, now = Date.now()) {
  const eater = eaterFor(room, data.eaterId, data.markerId, now);
  ensure(teacher?.role === 'teacher', '선생님만 포식을 처리할 수 있어요.');
  const choice = targets(room, eater, now).find(row => row.victimId === data.victimId &&
    row.kind === data.kind && row.recordId === data.recordId);
  ensure(choice, '먹을 수 있는 사용 중 아이템을 다시 선택해주세요.');
  const victim = room.players.get(choice.victimId);
  const owned = eater.inventory.find(entry => entry.id === choice.itemId);
  ensure(owned ? owned.quantity < SHOP.maxStack : eater.inventory.length < SHOP.maxKinds, '포식할 친구의 가방이 가득 찼어요.');
  ensure(victim.starShards + choice.refund <= SHARDS.max, '먹힌 친구의 별 파편이 최대치라서 보상을 지급할 수 없어요.');
  if (choice.kind === 'marker') victim.cardMarkers = victim.cardMarkers.filter(entry => entry.id !== choice.recordId);
  else victim.effects = victim.effects.filter(entry => entry.itemId !== choice.recordId);
  if (owned) owned.quantity++;
  else eater.inventory.push({id: choice.itemId, quantity: 1});
  victim.starShards += choice.refund;
  return {message: `${eater.nickname} 친구가 ${choice.itemName}을 포식했어요. ${victim.nickname} 친구에게 별 파편 ${choice.refund}개를 돌려주었어요.`,
    eaterId: eater.id, victimId: victim.id, itemId: choice.itemId, refund: choice.refund};
}
