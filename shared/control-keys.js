export const DEFAULT_CONTROL_KEYS=Object.freeze({attack:'KeyQ',skill:'KeyE',interact:'KeyF'});
// Movement, party reroll and number-based abilities keep their established keys.
export const CONTROL_KEY_OPTIONS=Object.freeze('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(k=>!'WASDR'.includes(k)).map(k=>'Key'+k));
export const controlKeyLabel=code=>String(code).replace(/^Key/,'');
export function validateControlKeys(value){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const entries=Object.keys(DEFAULT_CONTROL_KEYS).map(action=>value[action]);
  return Object.keys(value).length===3&&entries.every(code=>CONTROL_KEY_OPTIONS.includes(code))&&new Set(entries).size===3;
}
