import {interiorDecorObject,interiorDecorColor} from '../shared/interior-decor.js';

// 오래된 교실은 꾸미기 필드가 없습니다. 있는 값이 손상되면 복원을 중단합니다.
export function validateInteriorDecor(raw){
  if(raw===undefined)return {};
  const bad=()=>{throw new Error('부서행성 꾸미기 저장 데이터가 올바르지 않습니다.');};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))bad();
  const result={};
  for(const [id,style] of Object.entries(raw)){
    const object=interiorDecorObject(id);
    if(!object||!style||typeof style!=='object'||Array.isArray(style)||
      Object.keys(style).length!==2||!Object.hasOwn(style,'colorId')||!Object.hasOwn(style,'shapeId')||
      !interiorDecorColor(style.colorId)||!object.shapes.some(shape=>shape.id===style.shapeId))bad();
    result[id]={colorId:style.colorId,shapeId:style.shapeId};
  }
  return result;
}
