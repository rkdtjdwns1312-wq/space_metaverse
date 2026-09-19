// 교사 전용 값은 레벨 숫자가 아니라 서버가 인증한 role로만 적용합니다.
export const TEACHER_AVATAR = Object.freeze({level:6,name:'별의수호자',nickname:'선생님',sprite:'/assets/avatars/teacher/star-sovereign.png',color:'#e9c77b',form:'star-guardian',attackPower:99999,defensePower:3,hp:99999,mp:40});
export const isTeacher = player => player?.role === 'teacher';
