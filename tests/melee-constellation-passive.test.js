import test from 'node:test';
import assert from 'node:assert/strict';
import {attackPowerOf,defensePowerOf} from '../shared/combat.js';
import {TEACHER_AVATAR} from '../shared/teacher-avatar.js';
import {MASTER_BASE} from '../shared/master-account.js';

const LEVELS=[2,3,4,5];
const MELEE={
  hercules:{attack:[4,6,9,9],defense:[3,4,5,5]},
  capricorn:{attack:[5,7,10,10],defense:[1,2,3,3]},
  leo:{attack:[4,6,9,9],defense:[3,4,5,5]},
  'corona-borealis':{attack:[7,9,12,12],defense:[1,1,1,1]}
};
const player=(id,level)=>({role:'student',avatar:{level,constellationId:id},equipmentSlots:[],inventory:[]});

test('close melee Q constellations get exactly +1 attack and defense from LV2 through LV5 without mutating stored state',()=>{
  for(const [id,expected] of Object.entries(MELEE))for(const [index,level] of LEVELS.entries()){
    const p=player(id,level),attack=attackPowerOf(level,id,p),defense=defensePowerOf(level,id,p);
    assert.equal(attack,expected.attack[index],`${id} LV${level} attack`);
    assert.equal(defense,expected.defense[index],`${id} LV${level} defense`);
    assert.equal(attackPowerOf(level,id,p),attack,'repeated reads do not stack attack');
    assert.equal(defensePowerOf(level,id,p),defense,'repeated reads do not stack defense');
    assert.deepEqual(Object.keys(p),['role','avatar','equipmentSlots','inventory']);
  }
});

test('ranged projectile and arrow Q constellations do not receive the melee passive',()=>{
  const ranged={
    gemini:{attack:[4,6,9,9],defense:[0,1,2,2]},
    aquarius:{attack:[4,6,9,9],defense:[0,1,2,2]},
    sagittarius:{attack:[6,8,11,11],defense:[0,0,0,0]},
    cetus:{attack:[3,5,8,8],defense:[2,3,4,4]},
    pisces:{attack:[5,7,10,10],defense:[0,1,2,2]}
  };
  for(const [id,expected] of Object.entries(ranged))for(const [index,level] of LEVELS.entries()){
    const p=player(id,level);
    assert.equal(attackPowerOf(level,id,p),expected.attack[index],`${id} LV${level} attack`);
    assert.equal(defensePowerOf(level,id,p),expected.defense[index],`${id} LV${level} defense`);
  }
});

test('LV1, teacher and master values retain their existing stat contract',()=>{
  const student=player('leo',1);
  assert.equal(attackPowerOf(1,'leo',student),null);
  assert.equal(defensePowerOf(1,'leo',student),0);
  const teacher={role:'teacher',avatar:{level:4,constellationId:'leo'}};
  assert.equal(attackPowerOf(4,'leo',teacher),TEACHER_AVATAR.attackPower);
  assert.equal(defensePowerOf(4,'leo',teacher),TEACHER_AVATAR.defensePower);
  const master={...player('leo',5),accountKind:'master'};
  assert.equal(attackPowerOf(5,'leo',master),MASTER_BASE.attack);
  assert.equal(defensePowerOf(5,'leo',master),MASTER_BASE.defense);
});
