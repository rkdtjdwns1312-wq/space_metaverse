// 상태의 이름·그림·설명만 정의합니다. 등록만으로 능력이나 제약이 발동하지 않습니다.
// 새 능력/아이템은 서버 effects 뷰에 statusId와 until을 넣으면 이 창에 연결됩니다.
export const STATUS_TYPES=Object.freeze({
  uv:{name:'자외선 상태',icon:'☀️',tone:'warm',description:'아이템을 사용할 수 없어요. 꼬마 달로 해제할 수 있어요.'},
  sleep:{name:'수면 상태',icon:'💤',tone:'cool',description:'잠든 동안 아이템을 사용할 수 없어요.'},
  poison:{name:'중독 상태',icon:'🧪',tone:'violet',description:'연결된 능력이나 아이템의 중독 효과가 적용 중이에요.'},
  pair:{name:'짝 상태',icon:'🤝',tone:'mint',description:'짝과 함께하는 능력이 적용 중이에요.'},
  moon:{name:'달빛 보호',icon:'🌙',tone:'cool',description:'꼬마 달의 보호를 받고 있어요.'},
  'item-block':{name:'아이템 정지',icon:'🔒',tone:'violet',description:'별자리 능력으로 아이템 사용이 잠시 멈췄어요.'},
  'black-star':{name:'검은별 상태',icon:'✦',tone:'dark',description:'검은별이 붙어 있어요. 선생님의 해제가 필요해요.'},
  'capricorn-blessing':{name:'염소의 축복',icon:'♑',tone:'warm',description:'체력과 마나를 회복하고 한 번 부활할 수 있어요.'},
  'leo-courage':{name:'사자의 용기',icon:'♌',tone:'warm',description:'공격력이 잠시 높아져요.'},
  'libra-reflect':{name:'천칭의 보호',icon:'⚖',tone:'warm',description:'받는 피해를 공격자에게 돌려줘요.'},
  'hercules-shield':{name:'헤라클레스 방패',icon:'🛡',tone:'warm',description:'방패가 피해를 대신 받아요.'},
  'taurus-immunity':{name:'황소의 무적',icon:'♉',tone:'warm',description:'돌진 중에는 피해를 받지 않아요.'},
  'whale-defense':{name:'고래의 방어',icon:'🐋',tone:'cool',description:'푸른 기운으로 방어력이 높아져요.'},
  'crab-empowerment':{name:'게의 힘',icon:'♋',tone:'cool',description:'일반 공격이 강화돼요.'},
  'crown-aura':{name:'왕관의 힘',icon:'♛',tone:'warm',description:'검이 길어지고 붉은 칼이 떨어져요.'},
  'swan-wings':{name:'백조의 날개',icon:'🪽',tone:'cool',description:'깃털을 더 많이 날려요.'},
  stun:{name:'기절',icon:'✦',tone:'violet',description:'잠시 움직일 수 없어요.'},
  curse:{name:'염소의 저주',icon:'♑',tone:'violet',description:'주기적으로 피해를 받아요.'}
});
export const knownStatus=id=>typeof id==='string'&&Object.hasOwn(STATUS_TYPES,id);
export function activeStatuses(player,now=Date.now()){
  const grouped=new Map();
  for(const effect of player?.effects||[]){
    // 무기한은 null. 잘못된 시간이나 끝난 효과는 상태를 남기지 않습니다.
    if(!knownStatus(effect.statusId)||(effect.until!==null&&(!Number.isFinite(effect.until)||effect.until<=now)))continue;
    const old=grouped.get(effect.statusId);
    grouped.set(effect.statusId,{id:effect.statusId,...STATUS_TYPES[effect.statusId],count:(old?.count||0)+1,
      until:effect.until===null||old?.until===null?null:Math.max(old?.until||0,effect.until)});
  }
  if(player?.avatar?.blackStar)grouped.set('black-star',{id:'black-star',...STATUS_TYPES['black-star'],count:1,until:null});
  return Object.keys(STATUS_TYPES).filter(id=>grouped.has(id)).map(id=>grouped.get(id));
}
