// 사용자 제공 Lv3/Lv4 카드의 문구를 정리한 단계별 능력입니다.
// 조합·동의·현실 수업 판정은 교사 확인형으로 보존하며 자동 적용으로 표시하지 않습니다.
export const STAGE_ABILITIES = Object.freeze({
  3: {
    gemini: {mode:'shop-copy', maxPrice:4, description:'별 파편 4개 이하 아이템을 구매하거나 합성할 때 같은 아이템 1개를 복사해요.', note:'상점 구매는 자동 적용해요. 합성은 아직 준비 중이에요.'},
    corvus: {mode:'value-item', maxItemLevel:2, picks:1, multiplier:1, description:'주사위 눈 이하의 가치인 아이템 1개를 만들어요. Lv2 아이템까지 만들 수 있어요.'},
    aquarius: {mode:'grant-one', reward:2, description:'별 파편 2개를 만들어요.'},
    capricorn: {mode:'dice-shards', rewards:[0,0,2,2,4,4], description:'주사위 1·2는 별 0개, 3·4는 2개, 5·6은 4개를 만들어요.'},
    taurus: {mode:'dice-risk', win:6, loss:2, description:'주사위 홀수면 별 6개를 만들고 짝수면 별 2개를 반납해요.'},
    hercules: {mode:'manual', description:'하루를 골라 경고 2회를 방어하거나, 하루 동안 지정한 친구의 경고를 대신 받고 별 4개를 만들어요.'},
    libra: {mode:'dice-difference', description:'주사위 2개의 차이만큼 별을 만들어요. 차이가 0이면 별 2개를 내고 다시 도전할 수 있어요.'},
    cetus: {mode:'manual', target:true, targetMaxLevel:3, description:'아직 능력을 사용하지 않은 Lv3 이하 별자리를 삼켜 2일 보관해요. 3에서 그 카드의 Lv을 뺀 만큼 별을 얻고, 삼켜진 카드의 능력은 2배가 돼요.'},
    leo: {mode:'manual', description:'모둠 전체에 용기를 줘요. 용기를 받은 다른 친구가 발표하면 별 1개를 얻어요. 한 사람당 1번만 가능해요.'},
    ophiuchus: {mode:'manual', description:'랜덤한 번호의 친구를 중독시켜 아이템 사용을 1일 멈춰요. 중독은 1주일 동안 다음 번호로 옮겨간 뒤 사라져요.'},
    sagittarius: {mode:'manual', description:'사용 중인 Lv3 이하 아이템을 사냥하여 삭제하고, 그 가치의 절반씩 카드 주인과 나눠요. 주인 몫은 올림해요.'},
    'corona-borealis': {mode:'manual', description:'급식·자리 우선권을 각 1회 얻어요. 사용하지 않은 우선권만큼 별을 만들어요.'},
    cancer: {mode:'manual', target:true, description:'친구와 별 2개를 걸고 홀짝 맞추기를 해요. 패배하면 별 2개를 만들어요.'},
    cygnus: {mode:'manual', description:'캠페인 활동을 증명하면 별 3개를 만들어요. 증명하지 못하면 1개를 만들어요.'},
    aries: {mode:'manual', description:'원하는 날만큼 수면 상태를 유지해요. 일어날 때 수면한 날만큼, 최대 4개의 별을 얻어요.'},
    pisces: {mode:'manual', target:true, description:'짝과 함께 별을 얻어요. 원본 카드의 두 역할: Lv2 아이템 생성 시 별 1개·Lv3 생성 시 2개·경험치 10칸마다 1개 / Lv3 합성 시도·별 카드 획득·사용 시 짝과 자신에게 별을 부여해요.', note:'두 역할의 선택과 후자의 지급량은 선생님이 원본 카드를 확인해 정해요.'}
  },
  4: {
    gemini: {mode:'manual', description:'Lv2 아이템 조합 시 뽑기 카드 1회, Lv3 이상 아이템 조합 시 별 카드를 만들어요.'},
    corvus: {mode:'value-item', maxItemLevel:5, picks:2, multiplier:2, description:'주사위 눈의 2배 이하 가치로 아이템을 만들어요. 가치를 나눠 서로 다른 2가지 아이템을 만들 수도 있어요.'},
    aquarius: {mode:'grant-one', reward:4, description:'별 파편 4개를 만들어요.'},
    capricorn: {mode:'dice-shards', rewards:[0,2,2,4,4,10], description:'주사위 1은 별 0개, 2·3은 2개, 4·5는 4개, 6은 10개를 만들어요.'},
    taurus: {mode:'dice-risk', win:9, loss:4, description:'주사위 홀수면 별 9개를 만들고 짝수면 별 4개를 반납해요.'},
    hercules: {mode:'manual', description:'5개 부서에서 경고를 1개씩 받거나, 검은별 1회를 대신 받는 시련을 골라요. 보상은 별 9개예요.'},
    libra: {mode:'dice-triple', description:'주사위를 3번 굴려 모두 같으면 별 카드, 모두 다르면 뽑기 카드, 나머지는 별 2개를 만들어요.', note:'별 카드·뽑기 카드는 선생님 확인으로 지급해요.'},
    cetus: {mode:'manual', target:true, description:'동의받은 별자리 카드를 원하는 동안 삼켜요. 매일 함께 별을 1개씩 얻지만 둘 중 경고를 받으면 능력이 끝나요.'},
    leo: {mode:'manual', target:true, targetMaxLevel:3, description:'Lv3 이하 별자리에 경험치 1을 기부해요. 제공한 수 6개마다 별 카드를 만들어요.'},
    ophiuchus: {mode:'manual', description:'특별한 효과를 지닌 뱀을 소환해요. 독뱀은 1일 영역·능력 봉인, 땅뱀은 주사위 대결·능력 빼앗기, 물뱀은 깊이 12에서 주사위로 올라오는 효과예요.', note:'원본에는 랜덤 1마리와 3마리 소환 문구가 함께 있어요. 세부 적용은 선생님 확인 방식이에요.'},
    sagittarius: {mode:'manual', description:'검은별 1개를 사냥하고 상대에게 주사위 수만큼 별 1~5개를 받아요. 주사위 6이면 연속 사냥 1회를 얻어요.'},
    'corona-borealis': {mode:'manual', description:'동등한 상황에서 항상 우선권을 지녀요. 왕위 계승 카드를 삭제하고 3주 뒤 다음 레벨로 진화해요.', note:'기간 진화는 자동 실행하지 않고 선생님이 확인해요.'},
    cancer: {mode:'manual', target:true, description:'주사위 큰 눈 내기를 해요. 승리하면 별 1개를 가져와요(일 1회). 패배하면 별 1개를 주고 1개를 만들며, 1일 카드 사용이 멈춰요.'},
    cygnus: {mode:'manual', description:'아름다운 말로 칭찬하고 증명하면 별 1개를 만들어요. 최대 6개까지 만들어요.'},
    aries: {mode:'manual', description:'최대 6명을 하루 동안 수면 상태로 만들어요. 즉시 깨어나려면 별 1개를 줘야 해요.'},
    pisces: {mode:'manual', target:true, description:'짝과 함께 반 전체의 활동을 살펴요. 바다의 포용: 레벨업한 캐릭터의 이름 글자수만큼 별을 나눠요. 바다의 사랑: 합성한 아이템의 Lv만큼 별을 나눠요.', note:'원본의 두 역할 중 적용할 역할과 분배는 선생님이 확인해요.'}
  }
});
