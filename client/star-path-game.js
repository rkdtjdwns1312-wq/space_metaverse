import {oneStrokePuzzle} from '../shared/one-stroke.js';
export {oneStrokePuzzle};
const labels={low:'하',medium:'중',high:'상'};

export function createStarPathGame({board,setScore,request,toast=()=>{}}={}){
  let difficulty='low',puzzle=null,current=null,used=new Set(),moves=[],finished=false,active=true,runId=null,busy=false,revision=0;
  const root=document.createElement('section');root.className='star-path-game';
  const levels=document.createElement('div');levels.className='star-path-levels';
  for(const [key,label] of Object.entries(labels)){
    const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.difficulty=key;
    button.onclick=()=>{if(busy)return;difficulty=key;start();};levels.append(button);
  }
  const help=document.createElement('p');help.className='star-path-help';help.textContent='같은 선을 두 번 지나지 않고 모든 선을 이어 보세요. 점은 다시 지나갈 수 있어요.';
  const field=document.createElement('div');field.className='star-path-field';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('aria-hidden','true');
  const nodes=document.createElement('div');nodes.className='star-path-nodes';field.append(svg,nodes);
  const controls=document.createElement('div');controls.className='star-path-actions';
  const undo=document.createElement('button');undo.textContent='한 선 되돌리기';undo.type='button';undo.onclick=()=>{
    if(!moves.length||finished||busy)return;const last=moves.pop();used.delete(last.edgeIndex);current=last.from;draw();update('한 선을 되돌렸어요');
  };
  const reset=document.createElement('button');reset.textContent='새 도형';reset.type='button';reset.onclick=start;
  const retry=document.createElement('button');retry.textContent='완료 확인 다시하기';retry.type='button';retry.hidden=true;retry.onclick=finish;
  controls.append(undo,reset,retry);root.append(levels,help,field,controls);board.append(root);
  const update=message=>setScore(`${labels[difficulty]} 난이도 · ${used.size}/${puzzle?.edges.length||0}개 선${message?' · '+message:''}`);
  function draw(){
    svg.replaceChildren();nodes.replaceChildren();
    puzzle.edges.forEach(([a,b],index)=>{
      const line=document.createElementNS('http://www.w3.org/2000/svg','line');
      const [x1,y1]=puzzle.points[a],[x2,y2]=puzzle.points[b];
      line.setAttribute('x1',x1*100);line.setAttribute('y1',y1*100);line.setAttribute('x2',x2*100);line.setAttribute('y2',y2*100);
      line.setAttribute('class',used.has(index)?'drawn':'');svg.append(line);
    });
    puzzle.points.forEach(([x,y],index)=>{
      const button=document.createElement('button');button.type='button';button.className='star-path-node';
      button.style.left=`${x*100}%`;button.style.top=`${y*100}%`;button.textContent=current===index?'✦':'•';
      button.setAttribute('aria-label',`${index+1}번 점${current===index?' 현재 위치':''}`);button.onclick=()=>choose(index);nodes.append(button);
    });
    undo.disabled=!moves.length||finished;
  }
  function choose(index){
    if(!active||finished||busy||!puzzle)return;
    if(current===null){current=index;draw();update('출발했어요');return;}
    const edgeIndex=puzzle.edges.findIndex(([a,b],id)=>!used.has(id)&&(a===current&&b===index||b===current&&a===index));
    if(edgeIndex<0){update('이어진 새 선을 골라요');return;}
    used.add(edgeIndex);moves.push({edgeIndex,from:current,to:index});current=index;
    draw();
    if(used.size===puzzle.edges.length){finished=true;void finish();}
    else update();
  }
  async function finish(){
    if(busy||!active)return;busy=true;retry.hidden=true;const rev=revision;
    try{await request('one-stroke:complete',{runId,path:[moves[0].from,...moves.map(m=>m.to)]});if(active&&rev===revision)setScore(`성공! ${labels[difficulty]} 난이도 한붓그리기 완성`);}
    catch(error){if(active&&rev===revision){setScore('완료 확인을 다시 눌러 주세요.');toast(error.message);retry.hidden=false;}}
    finally{if(active&&rev===revision)busy=false;}
  }
  async function start(){if(busy)return;busy=true;const rev=++revision;current=null;used=new Set();moves=[];finished=false;retry.hidden=true;puzzle=null;svg.replaceChildren();nodes.replaceChildren();setScore('새 도형을 준비하고 있어요…');
    for(const button of levels.children)button.setAttribute('aria-pressed',String(button.dataset.difficulty===difficulty));
    try{const result=await request('one-stroke:start',{difficulty});if(!active||rev!==revision)return;puzzle=result;runId=result.runId;draw();update('아무 점에서 시작해 보세요');}
    catch(error){if(active&&rev===revision){setScore('새 도형을 눌러 다시 시작해 주세요.');toast(error.message);}}
    finally{if(active&&rev===revision)busy=false;}}
  start();
  return {destroy(){active=false;revision++;root.remove();}};
}
