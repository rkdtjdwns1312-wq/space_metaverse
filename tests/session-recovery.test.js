import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionRecoveryAction} from '../client/session-recovery.js';

test('transport loss during session acknowledgement preserves the token for automatic reconnect',()=>{
  assert.equal(sessionRecoveryAction(new Error('socket has been disconnected'),{connected:false,id:undefined,attemptId:'old'}),'wait');
  assert.equal(sessionRecoveryAction(new Error('operation has timed out'),{connected:false,id:undefined,attemptId:'old'}),'wait');
});
test('an old socket acknowledgement cannot reset or disconnect a newer connection',()=>{
  for(const message of ['socket has been disconnected','operation has timed out','먼저 교실에 입장해주세요.'])
    assert.equal(sessionRecoveryAction(new Error(message),{connected:true,id:'new',attemptId:'old'}),'resume');
});
test('a same-connection timeout reconnects while explicit session rejection still resets',()=>{
  const connection={connected:true,id:'same',attemptId:'same'};
  assert.equal(sessionRecoveryAction(new Error('operation has timed out'),connection),'reconnect');
  assert.equal(sessionRecoveryAction(new Error('재접속 시간이 지났어요. 다시 입장해주세요.'),connection),'reset');
  assert.equal(sessionRecoveryAction(new Error('이 접속은 다른 창에서 사용 중이에요.'),connection),'reset');
});

test('explicit temporary server rejection retries session recovery without erasing the classroom',()=>{
  const error=Object.assign(new Error('요청이 잠시 몰렸어요.'),{retryable:true});
  assert.equal(sessionRecoveryAction(error,{connected:true,id:'same',attemptId:'same'}),'retry');
  assert.equal(sessionRecoveryAction(error,{connected:false,id:undefined,attemptId:'same'}),'wait');
  assert.equal(sessionRecoveryAction(error,{connected:true,id:'new',attemptId:'same'}),'resume');
});
