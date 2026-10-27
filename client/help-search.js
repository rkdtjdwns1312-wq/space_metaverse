// Local help search: only documented answers, no remote service or student data.
const GROUPS=[
 ['과제','숙제','제출','과제내기'],['진화','레벨','레벨업','렙업','경험치','성장','업그레이드'],
 ['장비','장착','끼기','껴요','끼워','착용'],['조합','합성','만들기'],['조합법','레시피','조합레시피'],
 ['별파편','돈','재화','자원'],['별부스러기','부스러기'],['우주에너지','에너지'],
 ['아이템','물건','카드'],['이동','움직','걷기','걸어','조작'],['지도','맵','길찾기','빠른이동'],
 ['친구','소통','채팅','대화','파티'],['비밀번호','비번','암호','로그인','계정'],
 ['느려','느린','느림','렉','버벅','끊겨','끊김','접속','재접속','연결'],
 ['공격','전투','사냥','몬스터'],['스킬','능력'],['마비','자외선','상태','못움직','안움직'],
 ['도우미','도움말','설명'],['미션','임무'],['보상','받아','받는'],['키설정','단축키','키변경','톱니바퀴']
];
export const compactHelpText=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ko').replace(/[^\p{L}\p{N}]/gu,'');
const FILLERS=['어떻게','어디에서','어디서','무엇을','뭐예요','뭔가요','알려주세요','알려줘','할수있나요','하는방법','하는법','방법','하나요','해요','돼요','되나요','할까요','하고싶어요'];
export function helpQueryTerms(query){
 const compact=compactHelpText(query),terms=new Set();
 if(['키','q','e','f'].includes(compact)){terms.add('키설정');terms.add('단축키');}
 let meaningful=compact;for(const word of FILLERS)meaningful=meaningful.split(word).join('');
 for(const part of String(query).split(/[\s?!.,]+/)){let value=compactHelpText(part);for(const word of FILLERS)value=value.split(word).join('');value=value.replace(/(에서는|으로|에서|에게|에는|은|는|을|를|이|가|도|요)$/u,'');if(value.length>=2)terms.add(value);}
 for(const group of GROUPS)if(group.some(alias=>compact.includes(alias)))for(const alias of group)terms.add(alias);
 if(meaningful.length>=2)terms.add(meaningful);
 return {compact,terms:[...terms]};
}
export function searchHelp(answers,query){
 const {compact,terms}=helpQueryTerms(query);if(!compact||!terms.length)return [];
 return answers.map((answer,index)=>{
  const title=compactHelpText(answer.title),keywords=compactHelpText((answer.keywords||[]).join(' '));
  const body=compactHelpText([answer.text,...(answer.steps||[]),answer.note].filter(Boolean).join(' '));
  let score=title.includes(compact)?100:0,matched=0;
  for(const term of terms){const weight=title.includes(term)?12:keywords.includes(term)?9:body.includes(term)?2:0;score+=weight;if(weight)matched++;}
  // Exact words in the question outweigh broad synonyms (e.g. mission reward vs shopping).
  const words=String(query).split(/\s+/).map(compactHelpText).filter(w=>w.length>=2&&!FILLERS.includes(w));
  for(const word of words)if(title.includes(word)||keywords.includes(word))score+=18;
  return {answer,index,score,matched};
 }).filter(hit=>hit.matched>0).sort((a,b)=>b.score-a.score||a.index-b.index).map(hit=>hit.answer);
}
