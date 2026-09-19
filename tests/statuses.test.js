import test from 'node:test';
import assert from 'node:assert/strict';
import {activeStatuses,STATUS_TYPES} from '../shared/statuses.js';
import {playerEffectsView} from '../server/rooms.js';
import {addCardMarker} from '../server/item-cards.js';
import {addItemBlock} from '../server/constellation-abilities.js';
import {itemOf} from '../shared/config.js';

test('상태창은 서버의 자외선·수면·달 보호·아이템 정지를 정확히 연결하고 사용자를 노출하지 않는다',()=>{
 const p={effects:[],avatar:{}},actor={id:'secret-actor',nickname:'비공개'};
 addCardMarker(p,itemOf('little-sun-card'),actor,2000);addCardMarker(p,itemOf('little-moon-card'),actor,2000);
 addItemBlock(p,'aries',actor,2000);addItemBlock(p,'ophiuchus',actor,2000);
 const effects=playerEffectsView(p,false,1000),badges=activeStatuses({...p,effects},1000);
 assert.deepEqual(badges.map(s=>s.id),['uv','sleep','moon','item-block']);
 assert.ok(!JSON.stringify(effects).includes('secret-actor'));assert.ok(!JSON.stringify(effects).includes('비공개'));
 assert.deepEqual(activeStatuses({...p,effects},2000),[]);
});
test('중복 상태는 한 칸이며 마지막 효과 종료/해제 후 사라지고 무기한 상태는 남는다',()=>{
 const p={effects:[{statusId:'sleep',until:1100},{statusId:'sleep',until:1300},{statusId:'pair',until:null}]};
 assert.equal(activeStatuses(p,1000)[0].count,2);assert.equal(activeStatuses(p,1200)[0].count,1);
 assert.deepEqual(activeStatuses(p,1300).map(s=>s.id),['pair']);
 p.effects=[];assert.deepEqual(activeStatuses(p,1300),[]);
});
test('미구현 중독·짝은 자동 적용되지 않고 명시적 효과만 표시한다',()=>{
 assert.ok(STATUS_TYPES.poison&&STATUS_TYPES.pair);
 assert.deepEqual(activeStatuses({effects:[{label:'중독 상태',style:'poison',until:null}]}),[]);
 assert.deepEqual(activeStatuses({effects:[{statusId:'unknown',until:null},{statusId:'sleep',until:NaN},{statusId:'sleep'}]}),[]);
 const projected=playerEffectsView({effects:[{statusId:'poison',until:2000},{statusId:'pair',until:null}]},false,1000);
 assert.deepEqual(activeStatuses({effects:projected},1000).map(s=>s.id),['poison','pair']);
});
test('검은별 상태는 서버 아바타 값에서 표시하고 해제되면 즉시 사라진다',()=>{
 assert.deepEqual(activeStatuses({avatar:{blackStar:true}}).map(s=>s.id),['black-star']);
 assert.deepEqual(activeStatuses({avatar:{blackStar:false}}),[]);
});
