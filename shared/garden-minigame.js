export const GARDEN_RULES=Object.freeze({seedTargets:[{x:20,y:50},{x:50,y:50},{x:80,y:50}],minimumSpacing:22,sunlightCount:8,inputGapMs:150,waterTargetMs:3500,waterMaxMs:12000});
export const GARDEN_ARROWS=['up','right','down','left'];
export function gardenGrade(score){const n=Number.isFinite(score)?score:0;return n>=90?{name:'아주 좋음',multiplier:1}:n>=75?{name:'좋음',multiplier:.85}:n>=55?{name:'보통',multiplier:.7}:n>=30?{name:'나쁨',multiplier:.5}:{name:'아주 나쁨',multiplier:.3};}
