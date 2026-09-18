import {CONSTELLATION_ABILITIES} from './constellation-abilities.js';

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
export const constellationOf = id => BY_ID.get(id) || null;
