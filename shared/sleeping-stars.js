// 별의 시작점과 같은 크기·문·바닥 구조를 쓰는 조용한 북쪽 여행길입니다.
// 기존 맵 ID와 저장 좌표는 바꾸지 않고 새 맵만 추가합니다.
export const SLEEPING_STARS_THEME='sleeping-stars';
export const sleepingStarsId=stage=>'sleeping-stars-'+stage;
export const isSleepingStars=id=>/^sleeping-stars-[1234]$/.test(id||'');
export const SLEEPING_STARS_SKY=Object.freeze([
  {stars:96,brightness:.76,background:'#07080d',floor:'#77787d'},
  {stars:58,brightness:.60,background:'#050609',floor:'#626469'},
  {stars:28,brightness:.43,background:'#030407',floor:'#4e5055'},
  {stars:8,brightness:.27,background:'#010203',floor:'#3f4146'}
].map(Object.freeze));

export function createSleepingStarsMaps(originMaps,streetLayout){
  return Object.freeze(originMaps.map((origin,index)=>{
    const stage=index+1;
    return Object.freeze({id:sleepingStarsId(stage),name:'별들이 잠드는 곳 '+stage,
      theme:SLEEPING_STARS_THEME,stage,width:origin.width,height:origin.height,
      spawn:Object.freeze({...origin.spawn}),
      objects:[...(stage===1?[Object.freeze({id:'dark-star-statue',name:'돌이 된 별 석상',kind:'dark-star-statue',x:origin.width/2,y:origin.height/2,radius:58})]:[]),...origin.objects.filter(object=>object.kind==='gate').map(gate=>{
        const back=gate.id==='gate-back',targetStage=stage+(back?-1:1);
        return Object.freeze({...gate,
          name:(back&&stage===1?'오색별빛 쉼터':'별들이 잠드는 곳 '+targetStage)+(back?' ↓':' ↑'),
          target:back&&stage===1?streetLayout.id:sleepingStarsId(targetStage),
          arrival:Object.freeze(back&&stage===1?{...streetLayout.northArrival}:{...gate.arrival}),
          color:'#a6a8b4'});
      })]});
  }));
}
