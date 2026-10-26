import {isAbsolute} from 'node:path';
import {mkdirSync} from 'node:fs';
import {unlockStoppedStore} from '../server/store-lock.js';

const directory=process.env.DATA_DIR;
if(!directory||!isAbsolute(directory))throw new Error('DATA_DIR must be an absolute private directory.');
mkdirSync(directory,{recursive:true,mode:0o700});
// Refuses to unlock if its previous PID is alive or cannot be checked.
// The store itself then takes an exclusive lock before opening any classroom.
if(unlockStoppedStore(directory))console.log('Recovered the lock of a stopped classroom process.');
