import { createClassroomServer } from './app.js';
import {studentHoursFromEnv} from './access-hours.js';
import {configuredAdminPassword} from './admin-password.js';
const game=createClassroomServer({teacherKey:process.env.TEACHER_KEY,adminPassword:configuredAdminPassword(process.env.ADMIN_PASSWORD),publicOrigin:process.env.PUBLIC_ORIGIN,dataDir:process.env.DATA_DIR||'data/classes',studentHours:studentHoursFromEnv(),maxActiveRooms:process.env.MAX_ACTIVE_ROOMS===undefined?undefined:Number(process.env.MAX_ACTIVE_ROOMS)});
const port=Number(process.env.PORT || 3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
await game.listen(port,process.env.HOST || '0.0.0.0');
console.log('Cyber Classroom ready on port '+port);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await game.close();process.exit(0);});
