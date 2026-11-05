export const STEADY_WALK_KEY='woozooclass-steady-walk-v1';

// A short walk inside the central window leaves the scenery still. Past its
// edge the camera follows immediately, without drifting after the player stops.
export function walkCameraAxis(focus,extent,world,previous,pixelsPerUnit){
  if(extent>=world)return (world-extent)/2;
  const centered=focus-extent/2,margin=extent*.12;
  const origin=Number.isFinite(previous)&&Math.abs(previous-centered)<extent/2
    ?Math.max(centered-margin,Math.min(centered+margin,previous)):centered;
  return Math.max(0,Math.min(world-extent,Math.round(origin*pixelsPerUnit)/pixelsPerUnit));
}
