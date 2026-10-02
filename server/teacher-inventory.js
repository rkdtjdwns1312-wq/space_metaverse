import {SHOP,itemOf} from '../shared/config.js';
import {recipeItemOf,recipeItemId} from '../shared/recipe-items.js';
import {ensure} from './rooms.js';

const catalog=SHOP.items.filter(item=>item.level>=1&&item.level<=4);
function teacherCatalog(room){
  const recipes=(room.recipeDropOutputIds||[]).map(outputId=>recipeItemOf(recipeItemId(outputId),SHOP.items))
    .filter(item=>item&&item.level>=2&&item.level<=4);
  return [...catalog,...recipes];
}
function teacherOnly(room,teacher){
  ensure(teacher?.role==='teacher'&&teacher.connected&&room.players.get(teacher.id)===teacher,'선생님만 학생 가방을 조정할 수 있어요.');
}
function studentOf(room,id){
  const student=room.players.get(id);ensure(student?.role==='student','같은 교실의 학생을 선택해주세요.');return student;
}
export function teacherInventoryView(room,teacher,playerId){
  teacherOnly(room,teacher);
  const students=[...room.players.values()].filter(p=>p.role==='student').map(p=>({id:p.id,nickname:p.nickname,connected:!!p.connected&&!p.away}));
  const id=playerId??students[0]?.id;
  const target=id===undefined?null:studentOf(room,id);
  return {students,playerId:target?.id??null,inventory:structuredClone(target?.inventory||[]),catalog:structuredClone(teacherCatalog(room))};
}
// 변경할 가방 사본을 완전히 검사한 뒤 한 번에 교체합니다. 저장은 action의 공통 트랜잭션이 담당합니다.
export function adjustTeacherInventory(room,teacher,data,mode){
  teacherOnly(room,teacher);const target=studentOf(room,data.playerId),bag=structuredClone(target.inventory);
  if(mode==='remove'){
    ensure(typeof data.itemId==='string','제거할 아이템을 선택해주세요.');
    const entry=bag.find(i=>i.id===data.itemId);ensure(entry?.quantity>0,'그 아이템은 가방에 없어요. 다시 확인해주세요.');
    entry.quantity--;
  }else{
    ensure(mode==='give','가방 조정 방식을 확인해주세요.');
    const ids=data.itemIds;
    ensure(Array.isArray(ids)&&ids.length>0&&ids.length<=40&&new Set(ids).size===ids.length&&ids.every(id=>typeof id==='string'),'서로 다른 아이템을 1~40종 선택해주세요.');
    const available=teacherCatalog(room);
    for(const id of ids){
      const item=available.find(i=>i.id===id);ensure(item,'LV1~LV4 아이템을 선택해주세요.');
      const entry=bag.find(i=>i.id===id),limit=Math.min(SHOP.maxStack,item.maxOwned??SHOP.maxStack);
      ensure((entry?.quantity||0)<limit,`${item.name}은 ${limit}개까지만 가질 수 있어요.`);
      if(entry)entry.quantity++;else bag.push({id,quantity:1});
    }
    ensure(bag.length<=SHOP.maxKinds,'학생 가방의 빈칸이 부족해요. 먼저 아이템을 정리해주세요.');
  }
  target.inventory=bag.filter(i=>i.quantity>0);
  return {target,message:mode==='give'?`${target.nickname}에게 선택한 아이템을 1개씩 지급했어요.`:`${itemOf(data.itemId)?.name||'아이템'} 1개를 제거했어요.`};
}
