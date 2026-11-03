import test from 'node:test';
import assert from 'node:assert/strict';
import {actCozy,cozyView} from '../server/cozy-activities.js';
import {STAR_CAREERS,STAR_ACTIVITIES} from '../shared/star-raising.js';
import {renderStarBook} from '../client/star-raising-ui.js';
const now=Date.parse('2026-11-03T03:00:00Z');
const fresh=props=>({role:'student',avatar:{level:2},cosmicEnergy:0,...props});
const view=p=>cozyView(p,'pet',now);
const render=(v,extra={})=>renderStarBook({pet:v.state,catalog:v.catalog.raising,...extra});
test('undiscovered careers expose only locked slots; all cozy response kinds protect names and guides',()=>{
 const p=fresh();
 for(const kind of ['pet','room','garden']){
  const c=cozyView(p,kind,now).catalog.raising;
  assert.equal(c.canBrowseAll,false);assert.equal(c.careers.length,48);
  for(const career of c.careers)assert.deepEqual(Object.keys(career).sort(),['id','locked','track']);
 }
 const v=view(p),home=render(v);assert.equal((home.match(/data-raising-category=/g)||[]).length,6);
 for(const a of STAR_ACTIVITIES){const category=render(v,{category:a.id,careerId:a.id+'-0'});assert.equal((category.match(/class="raising-career-card locked"/g)||[]).length,8);assert(!category.includes('data-raising-career='));for(const c of STAR_CAREERS)assert(!category.includes(c.name));}
});
test('completion immediately unlocks only its career and renders actionable education',()=>{
 const p=fresh();actCozy(p,{kind:'pet',action:'raising:begin',runId:null,step:0,species:'moon',name:'별',accessory:'none'},now);
 let done;for(let i=0;i<12;i++){const r=view(p).state.raising;done=actCozy(p,{kind:'pet',action:'raising:choose',runId:r.runId,step:r.step,activityId:'science',choiceId:'0'},now);}
 const found=done.catalog.raising.careers.filter(c=>!c.locked);assert.equal(found.length,1);assert.equal(found[0].id,done.state.raising.album[0].careerId);
 const html=render(done,{category:'science',careerId:found[0].id});
 for(const content of [found[0].name,found[0].guide.work,found[0].guide.activity,'함께 길러볼 힘','오늘의 작은 진로 체험','career.go.kr'])assert(html.includes(content));
 assert.equal((render(done,{category:'science'}).match(/class="raising-career-card locked"/g)||[]).length,7);
});
test('teacher and master can inspect all 48 original career guides without collection',()=>{
 for(const props of [{role:'teacher'},{accountKind:'master'}]){
  const v=view(fresh(props));assert.equal(v.catalog.raising.canBrowseAll,true);
  for(const c of v.catalog.raising.careers){assert.equal(c.locked,false);assert(c.guide.work&&c.guide.activity&&c.guide.reflection);assert.equal(c.guide.strengths.length,3);assert(c.guide.strengths.every(s=>s.name&&s.description));assert(render(v,{category:c.track,careerId:c.id}).includes(c.guide.work));}
 }
 assert.equal(new Set(STAR_CAREERS.map(c=>c.guide.work)).size,48);assert.equal(new Set(STAR_CAREERS.map(c=>c.guide.activity)).size,48);
});
