// 서버가 확정한 좌표 사이만 그립니다. 다음 위치를 잠깐 기다려 이어 그리면
// 100ms마다 목표를 쫓으며 가속/감속하던 현상을 줄일 수 있습니다.
// 충돌 밖으로 예측 이동하지 않으며 서버 좌표나 이동 속도를 수정하지 않습니다.
export const MOTION = Object.freeze({ delayMs: 150, intervalMs: 100, snapDistance: 240, maxSamples: 12 });

export function createMotionTrack() {
  let samples=[],mapId=null;
  return {
    push(x,y,map,now) {
      if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(now))return;
      const last=samples.at(-1);
      if(last&&now<last.time)return;
      if(!last||mapId!==map||Math.hypot(x-last.x,y-last.y)>MOTION.snapDistance){
        samples=[{x,y,time:now}];mapId=map;return;
      }
      if(x===last.x&&y===last.y)return; // 상태창/정지 중 반복 패킷은 이동 시간을 바꾸지 않습니다.
      if(now-last.time>MOTION.intervalMs*2){
        // 오래 정지한 뒤 출발할 때 정지한 시간 전체를 천천히 이동하는 것으로 해석하지 않습니다.
        samples=[{x:last.x,y:last.y,time:now-MOTION.intervalMs}];
      }
      if(samples.at(-1).time===now)samples.pop();
      samples.push({x,y,time:now});
      if(samples.length>MOTION.maxSamples)samples.splice(0,samples.length-MOTION.maxSamples);
    },
    at(now) {
      if(!samples.length)return null;
      const time=now-MOTION.delayMs;
      while(samples.length>2&&samples[1].time<=time)samples.shift();
      const a=samples[0],b=samples[1];
      if(!b||time<=a.time)return {x:a.x,y:a.y};
      const blend=Math.min(1,Math.max(0,(time-a.time)/(b.time-a.time)));
      return {x:a.x+(b.x-a.x)*blend,y:a.y+(b.y-a.y)*blend};
    }
  };
}
