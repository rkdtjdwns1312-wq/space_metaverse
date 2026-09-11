import { createClassroomServer } from './app.js';
const game=createClassroomServer({teacherKey:process.env.TEACHER_KEY,publicOrigin:process.env.PUBLIC_ORIGIN});
const port=Number(process.env.PORT || 3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
await game.listen(port,process.env.HOST || '0.0.0.0');
console.log('Cyber Classroom ready on port '+port);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await game.close();process.exit(0);});
