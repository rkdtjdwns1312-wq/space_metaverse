// 부서행성의 네 고정 오브젝트만 꾸밀 수 있습니다. 위치와 충돌 범위는 바꾸지 않습니다.
export const INTERIOR_DECOR_COLORS=Object.freeze([
  {id:'default',name:'기본 색',hex:null},
  {id:'rose',name:'장밋빛',hex:'#f3b8ce'},
  {id:'peach',name:'복숭아빛',hex:'#ffd3ae'},
  {id:'gold',name:'별빛 노랑',hex:'#f6df9f'},
  {id:'mint',name:'민트빛',hex:'#afe7d5'},
  {id:'sky',name:'하늘빛',hex:'#aedaf4'},
  {id:'lavender',name:'라벤더빛',hex:'#d5c4f3'}
]);
export const INTERIOR_DECOR_OBJECTS=Object.freeze([
  {id:'board',name:'행성 규칙 게시판',shapes:[{id:'default',name:'둥근 게시판'},{id:'tablet',name:'우주 석판'},{id:'scroll',name:'별빛 두루마리'}]},
  {id:'report-board',name:'부서실적 작성판',shapes:[{id:'default',name:'작은 문서'},{id:'hex',name:'육각 보드'},{id:'star',name:'별 보드'}]},
  {id:'warning-rock',name:'경고 돌덩이',shapes:[{id:'default',name:'거친 돌'},{id:'crystal',name:'수정 결정'},{id:'meteor',name:'작은 운석'}]},
  {id:'door',name:'광장으로 나가는 문',shapes:[{id:'default',name:'아치 문'},{id:'portal',name:'둥근 포털'},{id:'star',name:'별빛 문'}]}
]);
export const interiorDecorObject=id=>INTERIOR_DECOR_OBJECTS.find(object=>object.id===id)||null;
export const interiorDecorColor=id=>INTERIOR_DECOR_COLORS.find(color=>color.id===id)||null;
export function interiorDecorStyle(styles,id){
  const object=interiorDecorObject(id),style=styles?.[id];
  return {colorId:interiorDecorColor(style?.colorId)?.id||'default',
    shapeId:object?.shapes.find(shape=>shape.id===style?.shapeId)?.id||'default'};
}
