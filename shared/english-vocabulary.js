import {ENGLISH_VOCABULARY} from './english-word-data.js';

// 기본 목록은 2022 개정 교육과정의 초등 권장 대표어 800개입니다.
// 학년 배치는 공식 지정이 아닌 우주 교실의 연습 난이도입니다.
// 기존에 사용하던 teacher/student/leaf/ocean 4개도 보존합니다.
export const ENGLISH_SOURCES=Object.freeze({
  curriculum:'https://www.goe.go.kr/resource/old/BBSMSTR_000000030136/BBS_202307111028067791.pdf',
  gradeThemes:[2548,2549,2550,2551].map(id=>`https://book.toptutor.co.kr/book/book_view.jsp?id=${id}&sid=19&type=series`),
  earlyLearning:'https://ebook.ebs.co.kr/roadmap/english',
  checkedAt:'2026-10-11',
  note:'교육과정 초등 권장 어휘를 바탕으로 구성. 한국어 뜻은 직접 작성하고 학년은 연습 난이도로 분류했습니다. 1·2학년은 입문용입니다.'
});
const labels=['기초 1학년','기초 2학년','중급 3학년','중급 4학년','고급 5학년','고급 6학년'];
export const ENGLISH_LEVELS=Object.freeze(labels.map((label,index)=>Object.freeze({
  id:`grade-${index+1}`,label,
  words:Object.freeze(ENGLISH_VOCABULARY.filter(entry=>entry.grade===index+1).map(entry=>Object.freeze([entry.word,entry.meaning])))
})));
export const ENGLISH_WORDS=Object.freeze(ENGLISH_LEVELS.flatMap(level=>level.words));
