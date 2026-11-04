// Audited handlers only mutate the current session's classroom. Reads that
// advance journeys/daily missions deliberately keep atomic persistence.
export const INTERACTION_SAVE_ACTIONS=Object.freeze([
 'temple:read','assignment:read','arcade:open','mission:board:read','star-card:read',
 'shop:energy:stat-buy','culture:recommend','culture:claim','history:claim',
 'science:open','science:claim','cozy:act','archive:save','archive:sign','archive:reply'
]);
