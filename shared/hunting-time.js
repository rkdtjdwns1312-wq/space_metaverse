export const HUNTING_STATIONS=Object.freeze(['math','english','culture','history','science','art']);
export const HUNTING_STATION_LIMIT=3;
export const HUNTING_STATION_MS=20*60*1000;
export const HUNTING_PLAYGROUNDS=Object.freeze(['memory','path','baseball','signal','sudoku','tetris','dodge','duel-memory','duel-omok']);
export const HUNTING_PLAYGROUND_LIMIT=2;
export const HUNTING_PLAYGROUND_MS=10*60*1000;
export const HUNTING_MAX_MS=HUNTING_STATION_MS*HUNTING_STATION_LIMIT+HUNTING_PLAYGROUND_MS*HUNTING_PLAYGROUND_LIMIT;
export const isHuntingMap=id=>typeof id==='string'&&(/^(star-origin|sleeping-stars)-[1-4]$/.test(id)||/^(sun-paradise|moon-paradise)(-[1-3])?$/.test(id)||['moon-garden','star-paradise'].includes(id));
// A learning day ends at 22:00 in Korea (13:00 UTC), independently of midnight rewards.
export const huntingCycle=now=>Math.floor((now-13*3600000)/86400000);
export const huntingResetAt=now=>(huntingCycle(now)+1)*86400000+13*3600000;
