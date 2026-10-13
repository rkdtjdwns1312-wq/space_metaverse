// Only public rules live here. The shuffled deck never leaves the server.
import {STREET_LAYOUT} from './street-layout.js';
export const DUEL_MAP_ID='star-street';
export const DUEL_ARCADES=Object.freeze([
  Object.freeze({id:'duel-memory',kind:'duel-arcade',gameId:'memory',name:'별 그림 짝 맞추기 경쟁 게임',x:500,y:STREET_LAYOUT.lower.y-195,radius:65,color:'#edbddd'}),
  Object.freeze({id:'duel-omok',kind:'duel-arcade',gameId:'omok',name:'별 오목 경쟁 게임',x:1300,y:STREET_LAYOUT.lower.y-195,radius:65,color:'#b9d8f6'})
]);
export const DUEL_RULES=Object.freeze({near:180,inviteMs:30000,disconnectMs:30000,revealMs:1000,proposalMs:30000,size:15});
export const DUEL_PICTURES=Object.freeze(['⭐','🌙','☀️','🪐','🚀','🌈','🍀','💎','🍎','🐳','🦋','🌻','🐸','🎈','🎁']);
export const DUEL_MEMORY_SIZES=Object.freeze([
  Object.freeze({id:'3x4',rows:3,columns:4,pairs:6}),
  Object.freeze({id:'4x5',rows:4,columns:5,pairs:10}),
  Object.freeze({id:'5x6',rows:5,columns:6,pairs:15})
]);
export const duelMemorySize=id=>DUEL_MEMORY_SIZES.find(size=>size.id===id);
export const duelMachine=id=>DUEL_ARCADES.find(machine=>machine.id===id);
export function nearDuelMachine(player,machine){
  return !!player&&!!machine&&player.mapId===DUEL_MAP_ID&&Number.isFinite(player.x)&&Number.isFinite(player.y)&&
    Math.hypot(player.x-machine.x,player.y-machine.y)<=DUEL_RULES.near;
}
export function omokLine(board,index){
  const stone=board[index],size=DUEL_RULES.size;
  if(!stone)return [];
  const x=index%size,y=Math.floor(index/size);
  for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
    const line=[index];
    for(const sign of [-1,1])for(let step=1;step<size;step++){
      const nx=x+dx*step*sign,ny=y+dy*step*sign;
      if(nx<0||ny<0||nx>=size||ny>=size||board[ny*size+nx]!==stone)break;
      line.push(ny*size+nx);
    }
    if(line.length>=5)return line;
  }
  return [];
}

// The new black stone must belong to each three. A three is open only if a
// legal extension can make four consecutive black stones with TWO empty ends.
// This handles broken threes and rejects edge/blocked pseudo-threes. Only 3-3
// is forbidden: double fours and overlines are legal, and five takes priority.
export function isOmokDoubleThree(board,index){
  if(board[index]!==1)return false;
  const memo=new Map(),size=DUEL_RULES.size;
  function forbidden(at){
    if(omokLine(board,at).length)return false;
    const key=at+':'+board.join('');
    if(memo.has(key))return memo.get(key);
    const x=at%size,y=Math.floor(at/size),directions=[];
    for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
      const cell=offset=>{const nx=x+dx*offset,ny=y+dy*offset;return nx<0||ny<0||nx>=size||ny>=size?-1:ny*size+nx;};
      const extensions=new Set();
      for(let start=-3;start<=0;start++){
        const left=cell(start-1),right=cell(start+4);
        if(left<0||right<0||board[left]!==0||board[right]!==0)continue;
        const segment=Array.from({length:4},(_,i)=>cell(start+i));
        if(segment.some(i=>i<0||board[i]===2))continue;
        const empty=segment.filter(i=>board[i]===0);
        if(empty.length===1)extensions.add(empty[0]);
      }
      if(extensions.size)directions.push(extensions);
    }
    if(directions.length<2){memo.set(key,false);return false;}
    let valid=0;
    for(const extensions of directions){
      for(const next of extensions){
        board[next]=1;const legal=!forbidden(next);board[next]=0;
        if(legal){valid++;break;}
      }
      if(valid>=2){memo.set(key,true);return true;}
    }
    memo.set(key,false);return false;
  }
  return forbidden(index);
}
