// 재화나 제작에 쓰이는 기본 재료로, 별 상점 판매 목록에는 넣지 않습니다.
export const MISC_ITEMS = Object.freeze([
  Object.freeze({id:'star-crumb',name:'별 부스러기',description:'5개를 모아 조합하면 별 파편으로 바꾸어줍니다',special:'별빛 조합기에서 별 부스러기 5개를 별 파편 1개로 바꿀 수 있어요.',art:'/assets/items/star-crumb.png',icon:'✧',type:'tool',level:1,price:0,sellPrice:null,forSale:false,usable:false,targets:'self',secret:false,mode:'material'}),
  Object.freeze({id:'star-shard',name:'별 파편',description:'별빛 조합으로 바꾼 별 파편입니다.',icon:'✦',type:'tool',level:1,price:0,sellPrice:null,forSale:false,usable:false,targets:'self',secret:false,mode:'currency'}),
]);

export const miscItemOf = id => MISC_ITEMS.find(item => item.id === id);
