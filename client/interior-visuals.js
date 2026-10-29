// Saved shape IDs are stable. Each choice selects a complete, independent painting.
const variants=(name,ids)=>Object.freeze(Object.fromEntries(ids.map(id=>[id,`/assets/interior/v2/${name}-${id}.webp`])));
export const INTERIOR_VARIANT_ART=Object.freeze({
  room:variants('floor',['default','star','grid','tier1','tier2','tier3']),
  mailbox:variants('mailbox',['default','star','moon','tier1','tier2','tier3']),
  board:variants('board',['default','tablet','scroll','tier1','tier2','tier3']),
  'report-board':variants('report',['default','hex','star','tier1','tier2','tier3']),
  'warning-rock':variants('warning',['default','crystal','meteor','tier1','tier2','tier3'])
});
export const interiorVisual=(kind,shapeId='default')=>INTERIOR_VARIANT_ART[kind]?.[shapeId]||INTERIOR_VARIANT_ART[kind]?.default;
export const INTERIOR_PROP_GEOMETRY=Object.freeze({
  board:{width:640,height:330,foot:180,content:{x:112,y:125,width:416,height:104}},
  mailbox:{width:120,height:160,foot:67},
  'report-board':{width:135,height:175,foot:65},
  'warning-rock':{width:130,height:160,foot:60},
  'interior-decor-machine':{width:170,height:190,foot:68}
});
