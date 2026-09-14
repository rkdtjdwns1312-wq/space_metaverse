import { createClassroomServer } from '../../server/app.js';
const game=createClassroomServer({studentHours:false,unattended:false,teacherManagedAccounts:false,teacherKey:'crash-test-private-teacher-key',dataDir:process.env.TEST_DATA_DIR});
const address=await game.listen();process.send({port:address.port});
