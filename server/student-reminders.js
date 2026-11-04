import {STUDENT_REMINDERS} from '../shared/student-reminders.js';
import {statGrowthInfo} from './stat-growth.js';
import {weekStart} from './temple.js';
import {missionViews} from './missions.js';
export function studentReminders(room,player,now=Date.now(),missions=null){
 if(player?.role!=='student')return [];
 const growth=statGrowthInfo(player,now),result=[];
 if(growth.eligible&&!growth.purchasedToday)result.push('stats');
 // Same three-week window and own archived tasks as the assignment archive,
 // without building other students' names for every personalized snapshot.
 const oldest=new Date(Date.parse(weekStart(now)+'T00:00:00Z')-14*86400000).toISOString().slice(0,10);
 const tasks=new Map((player.tasks||[]).map(task=>[task.assignmentId,task]));
 if((room.temple?.assignments||[]).some(a=>(a.week>=oldest||tasks.has(a.id))&&!a.completedIds.includes(player.id)&&tasks.get(a.id)?.status!=='submitted'))result.push('assignments');
 if((missions??missionViews(room,player,now)).some(m=>m.status==='active'))result.push('missions');
 return result;
}
export function reminderTarget(room,player,id,now=Date.now()){
 if(typeof id!=='string'||!Object.hasOwn(STUDENT_REMINDERS,id)||!studentReminders(room,player,now).includes(id))return null;
 return STUDENT_REMINDERS[id];
}
