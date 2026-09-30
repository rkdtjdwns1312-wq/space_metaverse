// 접속 여부와 무관하게 같은 교실의 등록 학생을 지정할 수 있는 아이템입니다.
// 레벨·보호 효과·대상 수 검사는 별도로 그대로 적용합니다.
export const allowsOfflineItemTarget=item=>typeof item?.id==='string';
