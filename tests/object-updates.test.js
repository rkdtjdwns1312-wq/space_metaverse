import test from 'node:test';
import assert from 'node:assert/strict';
import {objectSignals} from '../server/object-signals.js';
import {createObjectUpdates} from '../client/object-updates.js';

test('내용 변화만 알리고 물체를 확인하면 느낌표가 사라지며 학생별로 구분된다',()=>{
  const values=new Map();globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  const student={id:'a',role:'student',avatar:{departmentId:'dept'}},other={id:'b',role:'student',avatar:{departmentId:null}};
  const planet={id:'dept',name:'독서행성',description:'책을 읽어요',rules:['조용히 읽어요'],joinRequests:[],work:{report:{status:'draft',text:''}},warnings:[]};
  const room={code:'SAMPLE',temple:{notices:[],schedule:[],weeks:[]},players:new Map([['a',student]]),planets:new Map([['dept',planet]]),exploration:{energy:0,results:[]}};
  const tracker=createObjectUpdates();
  const first=objectSignals(room,student);assert.equal(tracker.update({code:room.code,objectSignals:first},student.id).size,0);
  planet.joinRequests.push({playerId:'b',at:1});room.temple.notices.push({date:'2026-10-03',text:'오늘의 알림'});
  student.cardMarkers=[{id:'used-1',itemId:'star-card',until:Date.now()+10000}];
  const changed=objectSignals(room,student),pending=tracker.update({code:room.code,objectSignals:changed},student.id);
  assert.ok(pending.has('planet:dept:mailbox'));assert.ok(pending.has('space-plaza:pillar-notice'));
  assert.ok(pending.has('space-plaza:pillar-effects'));
  tracker.acknowledge('planet:dept','mailbox');assert.equal(tracker.pending().has('planet:dept:mailbox'),false);
  assert.equal(createObjectUpdates().update({code:room.code,objectSignals:changed},student.id).has('space-plaza:pillar-notice'),true);
  assert.equal(createObjectUpdates().update({code:room.code,objectSignals:changed},other.id).size,0);
  assert.equal(Object.hasOwn(objectSignals(room,other),'planet:dept:mailbox'),false);
  delete globalThis.localStorage;
});
