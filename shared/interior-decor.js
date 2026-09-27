// 부서행성 내부 다섯 편집 대상을 제어장치에서 꾸밉니다. 위치·충돌 범위는 바뀌지 않습니다.
export const INTERIOR_DECOR_COLORS=Object.freeze([
  {id:'default',name:'기본 색',hex:null},
  {id:'rose',name:'장밋빛',hex:'#f3b8ce'},
  {id:'peach',name:'복숭아빛',hex:'#ffd3ae'},
  {id:'gold',name:'별빛 노랑',hex:'#f6df9f'},
  {id:'mint',name:'민트빛',hex:'#afe7d5'},
  {id:'sky',name:'하늘빛',hex:'#aedaf4'},
  {id:'lavender',name:'라벤더빛',hex:'#d5c4f3'}
]);
const SHAPES=Object.freeze({
  room:[{id:'default',name:'은빛 석판'},{id:'star',name:'별무늬 석판'},{id:'grid',name:'은빛 격자'}],
  mailbox:[{id:'default',name:'우체통'},{id:'star',name:'별 장식'},{id:'moon',name:'달 장식'}],
  board:[{id:'default',name:'둥근 게시판'},{id:'tablet',name:'우주 석판'},{id:'scroll',name:'별빛 두루마리'}],
  'report-board':[{id:'default',name:'작은 문서'},{id:'hex',name:'육각 보드'},{id:'star',name:'별 보드'}],
  'warning-rock':[{id:'default',name:'거친 돌'},{id:'crystal',name:'수정 결정'},{id:'meteor',name:'작은 운석'}],
  door:[{id:'default',name:'아치 문'},{id:'portal',name:'둥근 포털'},{id:'star',name:'별빛 문'}]
});
export const INTERIOR_DECOR_TARGETS=Object.freeze(['room','mailbox','board','report-board','warning-rock']);
// door는 기존 저장값 검증과 표시 복구에만 허용합니다.
export const INTERIOR_DECOR_OBJECTS=Object.freeze([
  {id:'room',name:'내부공간',shapes:SHAPES.room},
  {id:'mailbox',name:'우체통',shapes:SHAPES.mailbox},
  {id:'board',name:'게시판',shapes:SHAPES.board},
  {id:'report-board',name:'실적작성표',shapes:SHAPES['report-board']},
  {id:'warning-rock',name:'경고제어돌',shapes:SHAPES['warning-rock']},
  {id:'door',name:'광장으로 나가는 문',shapes:SHAPES.door}
]);
export const interiorDecorObject=id=>INTERIOR_DECOR_OBJECTS.find(object=>object.id===id)||null;
export const interiorDecorTarget=id=>INTERIOR_DECOR_TARGETS.includes(id)?interiorDecorObject(id):null;
export const interiorDecorColor=id=>INTERIOR_DECOR_COLORS.find(color=>color.id===id)||null;
export function interiorDecorStyle(styles,id){
  const object=interiorDecorObject(id),style=styles?.[id];
  return {colorId:interiorDecorColor(style?.colorId)?.id||'default',
    shapeId:object?.shapes.find(shape=>shape.id===style?.shapeId)?.id||'default'};
}
