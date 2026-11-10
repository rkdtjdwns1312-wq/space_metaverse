import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudio,MUSIC_TRACKS} from '../client/audio.js';

function setup({deferId}={}){
  const players=new Map();let resolvePlay;
  const audio=createAudio({storage:null,mediaFactory:(id,url)=>{
    const listeners=new Map(),media={paused:true,currentTime:0,playCount:0,
      play(){this.paused=false;this.playCount++;return id===deferId?new Promise(resolve=>{resolvePlay=resolve;}):Promise.resolve();},
      pause(){this.paused=true;},addEventListener(name,fn){listeners.set(name,fn);},emit(name){listeners.get(name)?.();}};
    players.set(id,media);return media;
  }});
  return {audio,players,resolve:()=>resolvePlay()};
}
test('music catalogue deduplicates shared files and preserves distinct boss recordings',()=>{
  assert.equal(new Set(MUSIC_TRACKS.map(t=>t.source)).size,MUSIC_TRACKS.length);
  assert.equal(MUSIC_TRACKS.find(t=>t.id==='star-origin-1').name,'별의 시작점');
  assert.equal(MUSIC_TRACKS.find(t=>t.id==='sleeping-stars-1').name,'별들이 잠드는 곳');
  assert.ok(MUSIC_TRACKS.some(t=>t.id==='serena-battle'));
  assert.ok(MUSIC_TRACKS.some(t=>t.id==='sun-paradise-3'));
});
test('listening owns playback across room refresh, stop, repeat, volume and close',async()=>{
  const {audio,players}=setup();
  try{
    await audio.playBgm('space-plaza');audio.beginMusic();
    assert.equal(players.get('space-plaza').paused,true);
    await audio.playMusic('star-origin-1',{repeat:false});
    const song=players.get('star-origin-1');assert.equal(song.loop,false);
    await audio.playBgm('space-plaza');assert.equal(song.paused,false);assert.equal(players.get('space-plaza').paused,true);
    audio.setMusicRepeat(true);assert.equal(song.loop,true);
    audio.setVolume(.7);audio.setMuted(true);assert.equal(song.volume,.7);assert.equal(song.muted,true);
    audio.stopMusic();await audio.playBgm('space-plaza');assert.equal(song.paused,true);assert.equal(players.get('space-plaza').paused,true);
    await audio.playMusic('star-origin-1');await audio.endMusic();
    assert.equal(song.paused,true);assert.equal(players.get('space-plaza').paused,false);assert.equal(players.get('space-plaza').loop,true);
  }finally{audio.dispose();}
});
test('song end stays stopped until user acts and navigation cancels listening',async()=>{
  const {audio,players}=setup();let ended=0;
  try{
    await audio.playBgm('space-plaza');audio.beginMusic({onEnded:()=>ended++});
    await audio.playMusic('star-origin-1',{repeat:false});players.get('star-origin-1').emit('ended');assert.equal(ended,1);
    await audio.playBgm('space-plaza');assert.ok([...players.values()].every(p=>p.paused));
    await audio.playBgm('milky-valley');assert.equal(players.get('milky-valley').paused,false);
    assert.equal(await audio.playMusic('star-origin-1'),false);
    await audio.endMusic();assert.equal(players.get('milky-valley').paused,false);
  }finally{audio.dispose();}
});
test('late login playback cannot start violin after stop or map transition',async()=>{
  for(const navigate of [false,true]){
    const {audio,players,resolve}=setup({deferId:'lobby'});
    try{
      await audio.playBgm('space-plaza');audio.beginMusic();const pending=audio.playMusic('lobby');
      if(navigate)await audio.playBgm('milky-valley');else await audio.endMusic({restore:false});
      resolve();assert.equal(await pending,false);assert.equal(players.get('lobby').paused,true);assert.equal(players.has('lobby-violin'),false);
    }finally{audio.dispose();}
  }
});
