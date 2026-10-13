import {GameError} from './pin-auth.js';
import {stationReward} from '../shared/station-rewards.js';
import {cultureDay} from './culture-library.js';
const validDay=day=>day===null||typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day+'T00:00:00Z'))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;
export function validateLearningRewards(raw){
 if(raw===undefined)return {math:null,english:null};
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!validDay(raw.math)||!validDay(raw.english))throw Error('Invalid learning rewards record');
 return {math:raw.math,english:raw.english};
}
// Called inside the answer transaction, so the last answer, mission progress,
// energy and daily stamp are all restored together when saving fails.
export function awardLearningReward(player,subject,result,now=Date.now()){
 if(!result.done)return undefined;
 const skipped=message=>({awarded:false,amount:0,message});
 if(player.role==='teacher')return skipped('선생님은 연습할 수 있지만 우주에너지 보상은 받지 않아요.');
 if(player.role!=='student'||!['math','english'].includes(subject))throw new GameError('현재 접속을 확인해주세요.');
 if(result.correct<9)return skipped('9문제 이상 맞히면 오늘의 보상을 받을 수 있어요. 다시 도전해 보세요.');
 const saved=validateLearningRewards(player.learningRewards),day=cultureDay(now),label=subject==='math'?'수학':'영어';
 if(saved[subject]===day)return skipped(`오늘의 ${label} 발전소 보상은 이미 받았어요. 내일 다시 도전해 보세요.`);
 const amount=stationReward(player.avatar?.level),before=player.cosmicEnergy??0;
 if(amount<=0)throw new GameError('현재 레벨을 확인해주세요.');
 if(!Number.isSafeInteger(before)||before<0||!Number.isSafeInteger(before+amount))throw new GameError('우주에너지를 더 담을 수 없어요.');
 player.cosmicEnergy=before+amount;player.learningRewards={...saved,[subject]:day};
 return {awarded:true,amount,message:`${label} 9문제 이상 정답! 우주에너지 ${amount}을 받았어요.`};
}
