import test from 'node:test';
import assert from 'node:assert/strict';
import {CULTURE_STORIES} from '../shared/culture-stories.js';
test('all culture books provide original author or clearly identified tradition for reading drafts',()=>{
 assert.equal(CULTURE_STORIES.length,126);
 for(const book of CULTURE_STORIES){assert.equal(typeof book.author,'string',book.id);assert.ok(book.author.trim().length>0&&book.author.length<=100,book.id);assert.ok(Object.isFrozen(book),book.id);}
 const author=id=>CULTURE_STORIES.find(b=>b.id===id).author;
 assert.equal(author('aesop-01'),'이솝 (원전)');assert.equal(author('aesop-54'),'이솝 (원전)');
 assert.match(author('talmud-01'),/작자 미상.*탈무드/);
 assert.match(author('korea-heungbu-01'),/작자 미상/);
 assert.match(author('world-emperor-new-clothes-01'),/안데르센/);
 assert.match(author('world-three-little-pigs-01'),/작자 미상.*랭 편/);
 assert.match(author('myth-learning-01'),/오비디우스/);
 assert.match(author('myth-learning-07'),/작자 미상.*도서관/);
 assert.match(author('myth-learning-10'),/작자 미상.*호메로스 찬가/);
 assert.match(author('myth-learning-16'),/^호메로스.*오디세이아/);
 assert.ok(CULTURE_STORIES.every(b=>!b.author.includes('타운센드')),'translator is not the original author');
});
