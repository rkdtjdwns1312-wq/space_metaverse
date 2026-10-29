// Independent shelter activities. No purchases or cross-activity materials.
export const COZY_SPECIES=[{id:'moon',name:'달별이'},{id:'cloud',name:'구름별이'},{id:'flower',name:'꽃별이'}];
export const COZY_THEMES=[{id:'moon',name:'달빛 방'},{id:'cloud',name:'구름 방'},{id:'study',name:'책 읽는 방'}];
export const COZY_FURNITURE=['bed','desk','chair','sofa','rug','lamp','shelf','plant','window','clock','cushion','telescope'].map((id,i)=>({id,name:['달 침대','작은 책상','별 의자','구름 소파','동그란 러그','별빛 조명','책장','화분','창문','달 시계','쿠션','망원경'][i]}));
export const COZY_SEEDS=[{id:'stardaisy',name:'별 데이지',minutes:5},{id:'moonbell',name:'달빛 초롱꽃',minutes:10},{id:'cloudtulip',name:'구름 튤립',minutes:15},{id:'sunrose',name:'햇살 장미',minutes:20},{id:'galaxylily',name:'은하 백합',minutes:30}];
export const COZY_ACCESSORIES=[{id:'none',name:'꾸밈 없음',care:0},{id:'ribbon',name:'별 리본',care:3},{id:'crown',name:'달 왕관',care:9},{id:'halo',name:'은하 고리',care:18}];
export const COZY_CARE=['feed','pet','play'];
// A generous daily alternative: levels 2–4 roughly three normal-monster mean drops;
// level 5 five level-4 mean drops. This is not a measured combat-speed estimate.
export const COZY_REWARDS=Object.freeze({1:10,2:30,3:100,4:250,5:400});
export const cozyRewardUnit=level=>Number.isInteger(level)?COZY_REWARDS[level]??0:0;
export const COZY_GRID={width:6,height:4,maxItems:12,palettes:4};
export const COZY_CATALOG={species:COZY_SPECIES,themes:COZY_THEMES,furniture:COZY_FURNITURE,seeds:COZY_SEEDS,accessories:COZY_ACCESSORIES,grid:COZY_GRID};
export function cozyPreset(theme='moon') {return ['bed','desk','chair','lamp'].map((id,i)=>({id,x:[0,3,3,5][i],y:[0,1,2,0][i],rotation:0,palette:theme==='cloud'?1:theme==='study'?2:0}));}
