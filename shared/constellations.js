export const CONSTELLATION_LIMIT = 2;

export const CONSTELLATIONS = Object.freeze([
  ['aries', '양자리', '#f29b86', '♈'],
  ['taurus', '황소자리', '#d9a45f', '♉'],
  ['gemini', '쌍둥이자리', '#f2cf6b', '♊'],
  ['cancer', '게자리', '#8fc7db', '♋'],
  ['leo', '사자자리', '#ef9d55', '♌'],
  ['virgo', '처녀자리', '#a9c97f', '♍'],
  ['libra', '천칭자리', '#c4a6df', '♎'],
  ['scorpio', '전갈자리', '#b98aa9', '♏'],
  ['sagittarius', '사수자리', '#8faee2', '♐'],
  ['capricorn', '염소자리', '#92ad9b', '♑'],
  ['aquarius', '물병자리', '#72c9d5', '♒'],
  ['pisces', '물고기자리', '#86a5dc', '♓'],
  ['orion', '오리온자리', '#8d82d8', '✦'],
  ['lyra', '거문고자리', '#d18bc0', '♫'],
  ['cygnus', '백조자리', '#9fc8e8', '◇'],
  ['ursa-major', '큰곰자리', '#b28b6e', '✺']
].map(([id, name, color, icon]) => Object.freeze({ id, name, color, icon })));

const BY_ID = new Map(CONSTELLATIONS.map(value => [value.id, value]));
export const constellationOf = id => BY_ID.get(id) || null;
