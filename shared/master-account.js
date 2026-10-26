// An account profile, never a teacher/admin permission. Trust server-loaded players only.
export const isMaster = player => player?.role === 'student' && player.accountKind === 'master';
export const MASTER_BASE = Object.freeze({level:5,attack:20,defense:5,hp:500,mp:500});
