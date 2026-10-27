export const DEFAULT_CONTROL_KEYS=Object.freeze({attack:'KeyQ',skill:'KeyE',interact:'KeyF'});
// Movement and party reroll keep their established keys. Assigned number keys take priority over auxiliary shortcuts.
export const CONTROL_KEY_OPTIONS=Object.freeze([...('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(k=>!'WASDR'.includes(k)).map(k=>'Key'+k)),...'123456'.split('').map(n=>'Digit'+n)]);
export const controlKeyLabel=code=>String(code).replace(/^(?:Key|Digit)/,'');
export function validateControlKeys(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const entries=Object.keys(DEFAULT_CONTROL_KEYS).map(action=>value[action]);
  return Object.keys(value).length===3&&entries.every(code=>CONTROL_KEY_OPTIONS.includes(code))&&new Set(entries).size===3;
}
