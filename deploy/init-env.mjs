import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {isAbsolute,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Run once on the new server. Never prints credentials or overwrites a file.
export function createPrivateEnvironment(destination){
  if(!isAbsolute(destination))throw new Error('Use an absolute environment-file path.');
  const contents=[
    'NODE_ENV=production',
    'TZ=Asia/Seoul',
    `TEACHER_KEY=${randomBytes(32).toString('hex')}`,
    `ADMIN_PASSWORD=${randomBytes(24).toString('base64url')}`,
    'HOST=127.0.0.1',
    'PORT=3000',
    'PUBLIC_ORIGIN=https://woozooclass.kr',
    'DATA_DIR=/var/lib/woozooclass/classes',
    'CRAFTING_RECIPES_FILE=/etc/woozooclass/crafting-recipes.json',
    'MAX_ACTIVE_ROOMS=1',
    'STUDENT_HOURS=true',
    ''
  ].join('\n');
  writeFileSync(destination,contents,{encoding:'utf8',mode:0o600,flag:'wx'});
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const destination=process.argv[2]||'/etc/woozooclass/app.env';
  createPrivateEnvironment(destination);
  console.log('Created private configuration. View credentials only in the private server console.');
}
