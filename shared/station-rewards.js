// 다섯 발전소가 공유하는 현재 캐릭터 레벨별 우주에너지 보상.
export const STATION_REWARDS=Object.freeze({1:1,2:2,3:5,4:30,5:100});
export function stationReward(level){return Number.isInteger(level)?STATION_REWARDS[level]??0:0;}
