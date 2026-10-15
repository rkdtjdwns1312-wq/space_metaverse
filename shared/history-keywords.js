// Each lesson's key concepts, without changing its original wording.
export const HISTORY_KEYWORDS=Object.freeze({
 'history-01':['구석기','뗀석기','사냥','채집'],
 'history-02':['신석기','빗살무늬 토기','농사','정착'],
 'history-03':['청동기','농사','재산 차이','지위 차이'],
 'history-04':['고인돌','청동기','공동체','문화유산'],
 'history-05':['고조선','단군','전승','비파형 동검'],
 'history-06':['고구려','백제','신라','삼국'],
 'history-07':['가야','철','교류'],
 'history-08':['불교','교류','문화'],
 'history-09':['을지문덕','살수','수나라'],
 'history-10':['신라','발해','남북국 시대','대조영'],
 'history-11':['왕건','고려','후삼국'],
 'history-12':['광종','과거제','시험'],
 'history-13':['몽골','고려','강화도','삼별초'],
 'history-14':['팔만대장경','목판','해인사'],
 'history-15':['직지','금속 활자','인쇄'],
 'history-16':['이성계','조선','한양','유교'],
 'history-17':['세종','훈민정음','한글'],
 'history-18':['신분','양반','상민','노비'],
 'history-19':['임진왜란','이순신','의병'],
 'history-20':['정조','수원 화성','실학','상업'],
 'history-21':['강화도 조약','개항','불평등'],
 'history-22':['대한제국','고종','국권','을사늑약'],
 'history-23':['3·1 운동','대한민국 임시정부','독립'],
 'history-24':['독립운동','의병','교육','문화'],
 'history-25':['한국광복군','광복','1945년'],
 'history-26':['광복','38도선','분단','대한민국 정부'],
 'history-27':['6·25 전쟁','정전','이산가족','평화'],
 'history-28':['4·19','5·18','6월 민주 항쟁','민주주의'],
 'history-29':['산업화','노동자','경제','노동'],
 'history-30':['문화','과학기술','민주주의','다양성'],
});
export function historyTextParts(text,id){
 const words=[...new Set(HISTORY_KEYWORDS[id]||[])].sort((a,b)=>b.length-a.length),parts=[];
 let at=0;
 while(at<text.length){
  let next=-1,word='';
  for(const term of words){const index=text.indexOf(term,at);if(index>=0&&(next<0||index<next)){next=index;word=term;}}
  if(next<0){parts.push({text:text.slice(at),key:false});break;}
  if(next>at)parts.push({text:text.slice(at,next),key:false});
  parts.push({text:word,key:true});at=next+word.length;
 }
 return parts;
}
