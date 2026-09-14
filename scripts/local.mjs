import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { spawn } from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
if(!existsSync('.env'))writeFileSync('.env','TEACHER_KEY='+randomBytes(32).toString('hex')+'\nPORT=3000\nHOST=127.0.0.1\nPUBLIC_ORIGIN=\n',{mode:0o600});
process.loadEnvFile('.env');
const secret=process.env.TEACHER_KEY;
if(!secret||secret.length<16||secret.startsWith('replace-'))throw new Error('Please set a private TEACHER_KEY in .env (at least 16 characters).');
const port=Number(process.env.PORT || 3000);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid PORT');
const {createClassroomServer}=await import('../server/app.js');
const game=createClassroomServer({teacherKey:secret,dataDir:process.env.DATA_DIR||'data/classes'});
const address='http://127.0.0.1:'+port;
try{await game.listen(port,'127.0.0.1');}
catch(error){
 await game.close();
 if(error.code!=='EADDRINUSE')throw error;
 console.error('Port '+port+' is already in use. Keep the existing classroom open, or close it before starting again.');
 process.exit(1);
}
// 이 파일은 교사 확인 정보를 담으므로 .local 전체를 Git과 HTTP 공개 대상에서 제외합니다.
mkdirSync('.local',{recursive:true});
const teacherUrl=address+'/#teacher='+encodeURIComponent(secret);
writeFileSync('.local/teacher.html','<!doctype html><html lang="ko"><meta charset="utf-8"><title>교사용 사이버 교실 시작</title><meta http-equiv="refresh" content="0;url='+teacherUrl+'"><p>교실을 여는 중입니다. <a href="'+teacherUrl+'">교사용 입장 화면 열기</a></p></html>',{mode:0o600});
console.log('Cyber Classroom: '+address);
console.log('Teacher start file: .local/teacher.html (private; do not share)');
let tunnel=null;
let closing=false;
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{closing=true;await tunnel?.stop();await game.close();process.exit(0);});
if(process.argv.includes('--public')){
  console.log('무료 외부 접속 연결을 준비합니다. 처음에는 연결 프로그램을 내려받습니다.');
  try{
    const {startTunnel}=await import('./tunnel.mjs');
    tunnel=await startTunnel({port,onReady:url=>{
      game.setPublicOrigin(url);
      writeFileSync('.local/student-link.txt',url+'\n학생 이용 시간: 한국 시간 07:00~21:00\n연결 프로그램을 다시 시작하면 주소가 바뀝니다.\n');
      console.log('공개 접속 주소: '+url);
      console.log('교사 화면의 메뉴 > 학생 입장 링크 복사를 눌러 교실 정보가 포함된 링크를 배부하세요.');
      console.log('학생 이용 시간: 한국 시간 오전 7시 ~ 오후 9시 전');
      console.log('무료 테스트 주소입니다. 재시작하면 새 주소를 알려주세요.');
    }});
    tunnel.child.once('exit',()=>{if(!closing)console.error('외부 접속 연결이 종료되었습니다. 서버를 재시작해 새 주소를 확인해주세요.');});
  }catch(error){console.error('외부 접속을 열지 못했습니다: '+error.message);await game.close();process.exitCode=1;throw error;}
}
if(process.argv.includes('--open')){
 const file=resolve('.local/teacher.html');
 if(process.platform==='win32'){
   const quoted="'"+file.replaceAll("'","''")+"'";
   const child=spawn('powershell.exe',['-NoProfile','-Command','Start-Process -FilePath '+quoted],{windowsHide:true,stdio:'ignore'});
   child.on('error',()=>console.error('Open .local/teacher.html in your browser.'));
 }else console.log('Open .local/teacher.html in your browser.');
}
