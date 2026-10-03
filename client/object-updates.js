// 한 학생이 물체를 마지막으로 본 시점의 내용 지문을 브라우저에 기억합니다.
// 새 교실·다른 학생 계정에는 서로 다른 기준을 사용하며, 원문은 저장하지 않습니다.
export function createObjectUpdates(){
  let storageKey='',seen={},signals={},pending=new Set();
  const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(seen));}catch{}};
  function update(room,selfId){
    const key='space-classroom:objects:'+room.code+':'+selfId;
    if(key!==storageKey){storageKey=key;try{seen=JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{seen={};}}
    signals=room.objectSignals||{};pending=new Set();let fresh=false;
    for(const [id,version] of Object.entries(signals)){
      if(!Object.hasOwn(seen,id)){seen[id]=version;fresh=true;}
      else if(seen[id]!==version)pending.add(id);
    }
    if(fresh)save();return pending;
  }
  function acknowledge(mapId,id){
    const key=mapId+':'+id;if(!Object.hasOwn(signals,key))return;
    seen[key]=signals[key];pending.delete(key);save();
  }
  function reset(){storageKey='';seen={};signals={};pending=new Set();}
  return {update,acknowledge,reset,pending:()=>pending};
}
