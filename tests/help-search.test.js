import test from 'node:test';
import assert from 'node:assert/strict';
import {searchHelp} from '../client/help-search.js';
import {STUDENT_QUESTIONS} from '../client/student-help-data.js';
test('children find relevant answers using questions, aliases and joined Korean words',()=>{
 for(const [query,id] of [
  ['숙제는 어떻게 내요?','homework'],['레벨은 어떻게 올려요?','level'],['렙업','level'],
  ['장비는 어떻게 껴요?','equipment'],['별부스러기','crumbs'],['미션 보상','mission-reward'],
  ['조합법 없어도','craft'],['조합 실패','craft-failed'],['키변경','keys'],['키','keys'],['Q','keys'],['E','keys'],['F','keys'],['게임이 버벅거려요','connection'],['비번','password'],['그림 로딩 실패','monster-picture']
 ])assert(searchHelp(STUDENT_QUESTIONS,query).slice(0,3).some(a=>a.id===id),query);
});
test('unknown and generic questions do not fabricate an answer',()=>{
 for(const query of ['','   ','어떻게 해요?','퀀텀바나나','<script>alert(42)</script>'])assert.deepEqual(searchHelp(STUDENT_QUESTIONS,query),[],query);
});
