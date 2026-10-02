import {starCardOf} from '../shared/star-cards.js';

// 교실마다 카드의 표시 문구만 바꿉니다. 실제 자동 보상·기간·선택 규칙은 카드 ID 기반으로 유지됩니다.
export const STAR_CARD_TEXT_LIMITS=Object.freeze({name:80,description:500,effect:500});
const fields=Object.keys(STAR_CARD_TEXT_LIMITS);
export function validateStarCardText(value){
  if(value===undefined)return {};
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('별카드 문구 저장 데이터가 올바르지 않습니다.');
  const result={};
  for(const [id,entry] of Object.entries(value)){
    if(!starCardOf(id)||!entry||typeof entry!=='object'||Array.isArray(entry)||
      Object.keys(entry).some(key=>!fields.includes(key))||fields.some(key=>typeof entry[key]!=='string'||entry[key].length>STAR_CARD_TEXT_LIMITS[key]||entry[key].includes('\0'))||
      !entry.name.trim()||!entry.effect.trim())throw new Error('별카드 문구 저장 데이터가 올바르지 않습니다.');
    result[id]=Object.fromEntries(fields.map(key=>[key,entry[key]]));
  }
  return result;
}
export function displayStarCard(room,id){
  const card=starCardOf(id);
  return card?{...card,...room.starCardText?.[id]}:null;
}
