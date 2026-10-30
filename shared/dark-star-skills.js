import {avatarSizeOf} from './avatar-size.js';

export const DARK_STAR_SKILLS=Object.freeze({
  basic:Object.freeze({aimMs:2000,speed:420,radius:14,durationMs:5000}),
  rainbow:Object.freeze({mana:5,cooldownMs:10000,durationMs:30000,length:avatarSizeOf({avatar:{level:5},transformation:{active:true}})*3,width:36,contactMs:1000}),
  puzzle:Object.freeze({mana:20,cooldownMs:60000,durationMs:30000,count:5,radius:22,revealMs:3000}),
  absorption:Object.freeze({thresholds:Object.freeze([8000,6000,4000,2000]),colors:Object.freeze(['red','purple','indigo','green']),warningMs:3000,radius:480,satelliteRadius:96,contactMs:1000})
});
// Deliberately omit adjacent hues such as purple/indigo and blue/indigo.
export const DARK_STAR_COLOR_PAIRS=Object.freeze([['red','blue'],['red','green'],['purple','green']].map(Object.freeze));
