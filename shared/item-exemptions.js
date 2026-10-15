export const ITEM_EXEMPTIONS=Object.freeze({diary:'일기',reading:'독서록'});
export const exemptionName=value=>typeof value==='string'&&Object.hasOwn(ITEM_EXEMPTIONS,value)?ITEM_EXEMPTIONS[value]:'';
