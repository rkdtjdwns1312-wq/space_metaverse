import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudio} from '../client/audio.js';

test('제공된 파일 배경음악은 로그인·쉼터·은하수계곡에서 반복하고 소리 설정을 따른다',async()=>{
  const players=new Map(),storage={getItem:()=>null,setItem:()=>{}};
  const audio=createAudio({storage,mediaFactory:(id,url)=>{
    const media={src:url,paused:true,currentTime:0,volume:1,muted:false,loop:false,
      async play(){this.paused=false;},pause(){this.paused=true;}};
    players.set(id,media);return media;
  }});
  try{
    assert.equal(await audio.playBgm('lobby'),true);
    const lobby=players.get('lobby');
    assert.equal(lobby.src,'/assets/audio/login-in-front-of-love.mp3');
    assert.equal(lobby.loop,true);assert.equal(lobby.paused,false);
    lobby.currentTime=10;
    assert.equal(await audio.playBgm('star-street'),true);
    const shelter=players.get('star-street');
    assert.equal(lobby.paused,true);assert.equal(lobby.currentTime,0);
    assert.equal(shelter.src,'/assets/audio/star-street-pposong.mp3');
    assert.equal(shelter.loop,true);assert.equal(shelter.paused,false);
    assert.equal(await audio.playBgm('milky-valley'),true);
    const valley=players.get('milky-valley');
    assert.equal(shelter.paused,true);
    assert.equal(valley.src,'/assets/audio/milky-valley-silent-morning.mp3');
    assert.equal(valley.loop,true);assert.equal(valley.paused,false);
    audio.setVolume(.6);audio.setMuted(true);
    assert.equal(lobby.volume,.6);assert.equal(shelter.volume,.6);assert.equal(valley.volume,.6);
    assert.equal(lobby.muted,true);assert.equal(shelter.muted,true);assert.equal(valley.muted,true);
    audio.setMuted(false);assert.equal(valley.muted,false);
    await audio.playBgm('space-plaza');
    assert.equal(valley.paused,true);
    assert.equal(await audio.playBgm('lobby'),true);
    assert.equal(lobby.paused,false);assert.equal(shelter.paused,true);assert.equal(valley.paused,true);
    audio.stopBgm();assert.equal(lobby.paused,true);
  }finally{audio.dispose();}
});
