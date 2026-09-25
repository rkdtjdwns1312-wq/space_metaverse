import {CONSTELLATION_ABILITIES, abilityForLevel} from './constellation-abilities.js';

export const CONSTELLATION_LIMIT = 2;
export const CONSTELLATION_TYPES = Object.freeze(['제작계','생산계','수호계','공격계','특수계']);
// 성격은 사용자 지정 분류이며 이후 몬스터 사냥 규칙에서도 이 값을 사용합니다.

export const CONSTELLATIONS = Object.freeze([
  ['gemini', '쌍둥이자리', '#f2cf6b', '♊', '제작계'],
  ['corvus', '까마귀자리', '#9294bc', '✦', '제작계'],
  ['aquarius', '물병자리', '#72c9d5', '♒', '생산계'],
  ['capricorn', '염소자리', '#92ad9b', '♑', '생산계'],
  ['taurus', '황소자리', '#d9a45f', '♉', '생산계'],
  ['hercules', '헤라클레스자리', '#e6aa7e', '✺', '수호계'],
  ['libra', '천칭자리', '#c4a6df', '♎', '수호계'],
  ['cetus', '고래자리', '#76b2c4', '◇', '수호계'],
  ['leo', '사자자리', '#ef9d55', '♌', '수호계'],
  ['ophiuchus', '뱀주인자리', '#8ab48c', '〰', '공격계'],
  ['sagittarius', '사수자리', '#8faee2', '♐', '공격계'],
  ['corona-borealis', '왕관자리', '#e1bd72', '♛', '공격계'],
  ['cancer', '게자리', '#8fc7db', '♋', '특수계'],
  ['cygnus', '백조자리', '#9fc8e8', '◇', '특수계'],
  ['aries', '양자리', '#f29b86', '♈', '특수계'],
  ['pisces', '물고기자리', '#86a5dc', '♓', '특수계']
].map(([id, name, color, icon, type]) => Object.freeze({ id, name, color, icon, type,
  art:'/assets/constellation-cards/'+id+'.png',sprite:'/assets/avatars/'+id+'.png',ability:CONSTELLATION_ABILITIES[id] })));

// 과거 저장 교실의 다섯 계보는 현재 학생이 진화·변경할 때까지 읽을 수 있게만 남깁니다.
export const LEGACY_CONSTELLATIONS=Object.freeze([
  ['virgo','처녀자리','#a9c97f','♍'],['scorpio','전갈자리','#b98aa9','♏'],
  ['orion','오리온자리','#8d82d8','✦'],['lyra','거문고자리','#d18bc0','♫'],
  ['ursa-major','큰곰자리','#b28b6e','✺']
].map(([id,name,color,icon])=>Object.freeze({id,name,color,icon,type:null,legacy:true})));
const BY_ID = new Map([...CONSTELLATIONS,...LEGACY_CONSTELLATIONS].map(value => [value.id, value]));
// 아래 목록의 원화는 왼쪽을 바라봅니다. 이동 방향과 곱해 그림의 기본 방향을 보정합니다.
// 다른 레벨은 서로 다른 원화이므로 계보 전체에 반전을 적용하지 않습니다.
const LV2_LEFT_FACING = new Set(['corvus','taurus','leo','ophiuchus','cancer','cygnus','aries']);
const LV3_LEFT_FACING = new Set(['taurus','leo','cancer']);
const LV4_LEFT_FACING = new Set(['ophiuchus','corvus']);
// 계보 ID는 그대로 저장하고, 그림과 능력만 단계별로 고릅니다.
// LV5 초월체는 별빛 원화를 사용하고, 새 능력은 정의될 때까지 기존 규칙을 유지합니다.
const STAGES = new Map(CONSTELLATIONS.map(value => [value.id, [2, 3, 4, 5].map(level =>
  Object.freeze({ ...value, assetLevel: level, celestial: level >= 5,
    spriteFacingX: (level === 2 && LV2_LEFT_FACING.has(value.id)) || (level === 3 && LV3_LEFT_FACING.has(value.id)) || (level === 4 && LV4_LEFT_FACING.has(value.id)) ? -1 : 1,
    art: level >= 5 ? `/assets/avatars/celestial/${value.id}.png` : level === 2 ? value.art : `/assets/constellation-cards/lv${level}/${value.id}.png`,
    sprite: level >= 5 ? `/assets/avatars/celestial/${value.id}.png` : level === 2 ? value.sprite : `/assets/avatars/lv${level}/${value.id}.png`,
    ability: abilityForLevel(value.id, level)
  }))]));
export function constellationOf(id, level = 2) {
  const value = BY_ID.get(id);
  if (!value || value.legacy) return value || null;
  const stage = Number.isInteger(level) ? Math.max(2, Math.min(5, level)) : 2;
  return STAGES.get(id)[stage - 2];
}
