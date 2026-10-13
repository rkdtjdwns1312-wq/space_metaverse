import {JOURNEY_ITEM_IDS} from './tutorial-journey.js';

export const JOURNEY_ITEMS=Object.freeze([
  Object.freeze({id:JOURNEY_ITEM_IDS.consumable,name:'연습용 별빛',icon:'✦',art:'/assets/equipment/starlight-flask.png',level:1,mode:'journey-practice',practiceKind:'consumable',
    description:'1분 동안 사용 중인 아이템 기둥에 표시됩니다. 재화나 능력치는 바뀌지 않으며 다시 사용할 수 있어요.',shopHidden:true,forSale:false,sellPrice:null}),
  Object.freeze({id:JOURNEY_ITEM_IDS.equipment,name:'연습용 배지',icon:'☆',art:'/assets/equipment/asteroid-badge.png',level:1,mode:'journey-practice',practiceKind:'equipment',
    description:'아무 쓸모없는 아이템 입니다',shopHidden:true,forSale:false,sellPrice:null})
]);
export const journeyItemOf=id=>JOURNEY_ITEMS.find(item=>item.id===id)||null;
