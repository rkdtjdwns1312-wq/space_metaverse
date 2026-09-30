export const REWARD_WEEK_MS=7*86400000;
// 1970-01-05 00:00 KST. 정수 계산으로 시스템 시간대와 일광절약시간에 영향받지 않습니다.
const FIRST_MONDAY_KST=313200000;
const weekFloor=at=>Math.floor((at-FIRST_MONDAY_KST)/REWARD_WEEK_MS)*REWARD_WEEK_MS+FIRST_MONDAY_KST;

// 월요일 0시 정각에 획득해도 첫 보상은 다음 월요일입니다.
export const nextRewardMonday=now=>weekFloor(now)+REWARD_WEEK_MS;
// 기존 7일 간격 예정일을 해당 주 월요일로 이관합니다. 이미 정렬된 값은 그대로입니다.
// 저장 형식이 음수 시각을 허용하지 않으므로 초기 epoch 값은 첫 유효 월요일로 정렬합니다.
export const alignRewardMonday=at=>Math.max(FIRST_MONDAY_KST,weekFloor(at));
