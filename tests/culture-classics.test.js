import test from 'node:test';
import assert from 'node:assert/strict';
import {CULTURE_STORIES} from '../shared/culture-stories.js';
import {CULTURE_STORIES_CLASSICS} from '../shared/culture-stories-classics.js';
import {validateCultureReading} from '../server/culture-library.js';

test('forty sourced classics extend the catalog without replacing or duplicating older books',()=>{
  assert.equal(CULTURE_STORIES_CLASSICS.length,40);
  assert.equal(CULTURE_STORIES.length,126);
  const older=CULTURE_STORIES.filter(s=>!CULTURE_STORIES_CLASSICS.includes(s));
  assert.equal(older.length,86);
  assert.equal(CULTURE_STORIES_CLASSICS.filter(s=>s.category==='그리스·로마 신화').length,20);
  assert.equal(CULTURE_STORIES_CLASSICS.filter(s=>s.category==='탈무드').length,20);
  for(const field of ['id','title'])assert.equal(new Set(CULTURE_STORIES.map(s=>s[field])).size,126,field);
  assert.equal(new Set(CULTURE_STORIES_CLASSICS.map(s=>s.source.title)).size,40,'distinct ancient episodes');
  const olderBodies=new Set(older.map(s=>s.paragraphs.join('')));
  const bodies=new Set();
  for(const story of CULTURE_STORIES_CLASSICS){
    const body=story.paragraphs.join('');
    assert(!olderBodies.has(body),story.id);
    assert(!bodies.has(body),story.id);bodies.add(body);
    assert(Object.isFrozen(story)&&Object.isFrozen(story.paragraphs)&&Object.isFrozen(story.source));
  }
});

test('each classic separates its retelling from modern reflection and has readable source metadata',()=>{
  const paragraphs=new Set();
  for(const story of CULTURE_STORIES_CLASSICS){
    assert.equal(story.paragraphs.length,4,story.id);
    for(const paragraph of story.paragraphs){
      assert(paragraph.length>=25&&paragraph.length<=220,`${story.id}: paragraph length ${paragraph.length}`);
      assert(!paragraphs.has(paragraph),`${story.id}: reused paragraph`);paragraphs.add(paragraph);
      assert.doesNotMatch(paragraph,/<[^>]+>|https?:|TODO|undefined|�/);
    }
    const length=story.paragraphs.join(' ').length;
    assert(length>=250&&length<=700,`${story.id}: total length ${length}`);
    assert.match(story.paragraphs[2],/^오늘의 생각: /);
    assert.match(story.paragraphs[3],/^함께 생각해요: .+\?$/);
    assert(story.lesson.length>=15&&story.lesson.length<=100);
    assert.match(story.adaptation,/현대 수업 해석/);
    assert.equal(story.source.checked,'2026-11-10');
    const url=new URL(story.source.url);
    assert.equal(url.protocol,'https:');
    assert(['www.sefaria.org','www.theoi.com','topostext.org','classics.mit.edu'].includes(url.hostname));
    assert.match(story.source.title,story.category==='탈무드'?/^바빌로니아 탈무드, /:/오비디우스|아폴로도로스|호메로스|헤로도토스/);
  }
});

test('all forty new IDs are accepted by daily reading persistence while the ten-book limit remains',()=>{
  const ids=CULTURE_STORIES_CLASSICS.map(s=>s.id);
  for(let i=0;i<ids.length;i+=10){
    const record={day:'2026-11-10',claimedIds:ids.slice(i,i+10)};
    assert.deepEqual(validateCultureReading(record),record);
  }
  assert.throws(()=>validateCultureReading({day:'2026-11-10',claimedIds:ids.slice(0,11)}));
  assert.throws(()=>validateCultureReading({day:'2026-11-10',claimedIds:['talmud-learning-99']}));
});
