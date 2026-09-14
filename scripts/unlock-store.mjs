import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { unlockStoppedStore } from '../server/store-lock.js';
process.chdir(fileURLToPath(new URL('..',import.meta.url)));
if(existsSync('.env'))process.loadEnvFile('.env');
try{
  const unlocked=unlockStoppedStore(process.env.DATA_DIR||'data/classes');
  console.log(unlocked?'종료된 서버의 잠금을 해제했어요. 교실-시작.cmd를 다시 실행하세요.':'남은 잠금이 없어요. 교실-시작.cmd를 실행하세요.');
}catch(error){console.error(error.message);process.exitCode=1;}
