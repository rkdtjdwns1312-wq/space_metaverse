export const HUNTING_STATIONS=Object.freeze(['math','english','culture','history','science']);
export const HUNTING_STATION_MS=20*60*1000;
export const HUNTING_MAX_MS=HUNTING_STATION_MS*HUNTING_STATIONS.length;
export const isHuntingMap=id=>typeof id==='string'&&(/^(star-origin|sleeping-stars)-[1-4]$/.test(id)||/^(sun-paradise|moon-paradise)(-[1-3])?$/.test(id)||['moon-garden','star-paradise'].includes(id));
// A learning day ends at 22:00 in Korea (13:00 UTC), independently of midnight rewards.
export const huntingCycle=now=>Math.floor((now-13*3600000)/86400000);
export const huntingResetAt=now=>(huntingCycle(now)+1)*86400000+13*3600000;
