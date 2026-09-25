import { PROGRESSION, VALLEY, VALLEY_ID } from '../shared/config.js';
import {hasUnlimitedShards,shardCost} from '../shared/economy.js';
import { CONSTELLATIONS, CONSTELLATION_LIMIT, constellationOf } from '../shared/constellations.js';
import { ensure } from './rooms.js';
import { isNear } from './world.js';
import { evolveAvatar, gainExperience } from './progression.js';

const evolutionStar = VALLEY.objects.find(object => object.id === 'evolution-star');
const growthStar = VALLEY.objects.find(object => object.id === 'growth-star');

function requireStudentAt(player, object, label, allowTeacher = false) {
  ensure(player?.role === 'student' || (allowTeacher && hasUnlimitedShards(player)), '학생만 ' + label + '을 이용할 수 있어요.');
  ensure(player.mapId === VALLEY_ID, '은하수계곡에서 ' + label + ' 가까이 가주세요.');
  ensure(object && isNear(player, object), label + ' 가까이 가주세요.');
}

function requirement(avatar) {
  return avatar.level < PROGRESSION.transcendentLevel
    ? PROGRESSION.nextLevelXp[avatar.level - 1]
    : 0;
}

function constellationCount(room, constellationId, exceptId = null) {
  return [...room.players.values()].filter(player =>
    player.id !== exceptId && player.role === 'student' && player.avatar?.level >= 2 &&
    player.avatar.constellationId === constellationId
  ).length;
}

function optionsFor(room, player) {
  const currentLegacy=constellationOf(player.avatar?.constellationId);
  const values=currentLegacy?.legacy?[...CONSTELLATIONS,currentLegacy]:CONSTELLATIONS;
  return values.map(value => {
    const count = constellationCount(room, value.id);
    const current = player.avatar?.constellationId === value.id;
    return { ...constellationOf(value.id, player.avatar.level), count, available: !value.legacy && (current || count < CONSTELLATION_LIMIT), current };
  });
}

function baseInfo(room, player) {
  const requiredXp = requirement(player.avatar);
  return {
    options: optionsFor(room, player),
    avatar: structuredClone(player.avatar),
    requiredXp,
    canEvolve: player.avatar.level < PROGRESSION.transcendentLevel && player.avatar.xp >= requiredXp
  };
}

export function evolutionInfo(room, player) {
  requireStudentAt(player, evolutionStar, '진화의 별');
  return baseInfo(room, player);
}

export function changeConstellation(room, player, { constellationId } = {}) {
  requireStudentAt(player, evolutionStar, '진화의 별');
  const selected = constellationOf(constellationId);
  ensure(selected&&!selected.legacy, '현재 선택할 수 있는 별자리를 골라주세요.');
  ensure(player.avatar.level >= 2, 'LV1은 첫 진화를 할 때 별자리를 고를 수 있어요.');
  ensure(constellationCount(room, selected.id, player.id) < CONSTELLATION_LIMIT,
    selected.name + '는 이미 두 친구가 선택했어요.');
  player.avatar = {
    ...structuredClone(player.avatar),
    form: player.avatar.level >= PROGRESSION.transcendentLevel ? 'transcendent' : 'constellation',
    constellationId: selected.id
  };
  return baseInfo(room, player);
}

export function evolveConstellation(room, player, { constellationId } = {}) {
  requireStudentAt(player, evolutionStar, '진화의 별');
  ensure(player.avatar.level < PROGRESSION.transcendentLevel, '이미 최고 단계인 초월체예요.');
  const requiredXp = requirement(player.avatar);
  ensure(player.avatar.xp >= requiredXp, '진화하려면 경험치가 ' + (requiredXp - player.avatar.xp) + ' 더 필요해요.');

  let selectedId = player.avatar.constellationId;
  if (player.avatar.level === 1) {
    const selected = constellationOf(constellationId);
    ensure(selected&&!selected.legacy, '첫 진화에 사용할 별자리를 골라주세요.');
    ensure(constellationCount(room, selected.id, player.id) < CONSTELLATION_LIMIT,
      selected.name + '는 이미 두 친구가 선택했어요.');
    selectedId = selected.id;
  } else {
    ensure(constellationOf(selectedId), '현재 별자리 계보를 확인해주세요.');
    ensure(constellationId === undefined || constellationId === selectedId,
      '진화할 때는 현재 별자리 계보를 유지해야 해요.');
  }

  const next = evolveAvatar({ ...player.avatar, constellationId: selectedId });
  player.avatar = next;
  return baseInfo(room, player);
}

export function growthInfo(room, player) {
  requireStudentAt(player, growthStar, '성장의 별', true);
  const requiredXp = requirement(player.avatar);
  const remainingXp = Math.max(0, requiredXp - player.avatar.xp);
  const starShards = Number.isSafeInteger(player.starShards) && player.starShards >= 0 ? player.starShards : 0;
  const unlimitedShards = hasUnlimitedShards(player);
  const maxBuy = player.avatar.level >= PROGRESSION.transcendentLevel ? 0 : Math.min(remainingXp, unlimitedShards ? remainingXp : starShards);
  return { avatar: structuredClone(player.avatar), requiredXp, remainingXp, starShards, unlimitedShards, maxBuy, canBuy: maxBuy > 0 };
}

export function buyExperience(room, player, { amount } = {}) {
  requireStudentAt(player, growthStar, '성장의 별', true);
  ensure(player.avatar.level < PROGRESSION.transcendentLevel, '초월체는 경험치를 더 살 수 없어요.');
  ensure(Number.isSafeInteger(player.starShards) && player.starShards >= 0, '별 파편 잔액을 확인해주세요.');
  ensure(Number.isSafeInteger(amount) && amount > 0, '구매할 경험치는 1 이상의 정수로 입력해주세요.');
  const requiredXp = requirement(player.avatar);
  const remainingXp = Math.max(0, requiredXp - player.avatar.xp);
  const maxBuy = hasUnlimitedShards(player) ? remainingXp : Math.min(remainingXp, player.starShards);
  ensure(maxBuy > 0, player.avatar.xp >= requiredXp ? '현재 단계의 경험치를 모두 채웠어요. 진화의 별로 가주세요.' : '별 파편이 부족해요.');
  ensure(amount <= maxBuy, '지금은 경험치를 최대 ' + maxBuy + '까지 살 수 있어요.');

  const nextAvatar = gainExperience(player.avatar, amount);
  player.starShards -= shardCost(player, amount);
  player.avatar = nextAvatar;
  return growthInfo(room, player);
}
