// Lv2 카드 원문을 짧게 정리한 표시 문구. 현실 교실 확인이 필요한 효과는 선생님 처리형입니다.
export const CONSTELLATION_ABILITIES=Object.freeze({
  gemini:{mode:'shop-copy',description:'Lv2 이하 아이템을 살 때 같은 아이템 1개를 복사해요.'},
  corvus:{mode:'dice-item',description:'주사위 눈의 절반(소수점 버림) 이하 Lv 아이템 1개를 만들어요.'},
  aquarius:{mode:'grant-one',description:'별 파편 1개를 만들어요.'},
  capricorn:{mode:'dice-shards',description:'주사위 1은 별 0개, 6은 2개, 2~5는 1개를 만들어요.'},
  taurus:{mode:'dice-risk',description:'주사위 홀수면 별 3개를 만들고 짝수면 별 1개를 반납해요.'},
  hercules:{mode:'manual',description:'경고 1회를 방어하거나, 친구 대신 경고를 받고 별 2개를 만들어요.'},
  libra:{mode:'manual',description:'주차에 따라 경험치를 얻어요: 1주 +0, 2~3주 +1, 4~5주 +2.'},
  cetus:{mode:'manual',description:'Lv2 이하 다른 별자리를 칭찬해 효과를 2배로 하고 보상을 협의해요.'},
  leo:{mode:'manual',description:'훌륭한 발표를 할 때 별 1개를 만들어요. 한 주 최대 2개예요.'},
  ophiuchus:{mode:'ban-two-days',description:'친구 1명의 아이템 사용을 2일 멈추게 하고, 해제일에 별 1개를 보상해요.'},
  sagittarius:{mode:'warning-one',description:'부서를 하나 골라 내가 받은 활성 경고 1개를 삭제해요.'},
  'corona-borealis':{mode:'manual',description:'급식 또는 종례 우선권 1회를 받고, 모두에게 양보하면 별 1개를 얻어요.'},
  cancer:{mode:'manual',description:'친구와 별 1개를 걸고 가위바위보를 해요. 패배하면 별 1개를 보상받아요.'},
  cygnus:{mode:'manual',description:'봉사를 증명해 별 1개를 만들어요. 한 주 최대 2개예요.'},
  aries:{mode:'sleep',description:'나와 친구가 각각 별 1개를 얻고 하루 동안 수면 상태가 되어 아이템을 못 써요.'},
  pisces:{mode:'manual',description:'친구 1명과 하루 동안 짝이 되어 자리를 함께하고 실적·경고 1회를 공유해요.'}
});
