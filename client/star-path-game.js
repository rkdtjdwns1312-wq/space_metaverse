const PUZZLES={
  low:[
    {points:[[.18,.2],[.82,.2],[.82,.8],[.18,.8],[.5,.5]],edges:[[0,1],[1,2],[2,3],[3,0],[0,4]]},
    {points:[[.15,.25],[.5,.13],[.85,.25],[.75,.8],[.25,.8]],edges:[[0,1],[1,2],[2,3],[3,4],[4,0],[1,3]]}
  ],
  medium:[
    {points:[[.15,.2],[.5,.12],[.85,.2],[.85,.72],[.5,.88],[.15,.72],[.5,.5],[.26,.5]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,3],[0,6],[6,7],[7,0]]},
    {points:[[.18,.18],[.5,.1],[.82,.18],[.88,.5],[.82,.82],[.5,.9],[.18,.82],[.12,.5]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[0,4],[4,2],[2,6]]}
  ],
  high:[
    {points:[[.14,.18],[.5,.12],[.86,.18],[.9,.5],[.86,.82],[.5,.88],[.14,.82],[.1,.5],[.5,.5]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[0,4],[4,2],[2,6],[0,8],[8,2],[2,0]]},
    {points:[[.13,.18],[.5,.12],[.87,.18],[.9,.5],[.87,.82],[.5,.88],[.13,.82],[.1,.5],[.5,.5]],edges:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0],[0,8],[8,4],[4,2],[2,6],[6,8],[8,2]]}
  ]
};
const labels={low:'하',medium:'중',high:'상'};
export function oneStrokePuzzle(difficulty,random=Math.random){
  const choices=PUZZLES[difficulty];if(!choices)throw new Error('난이도를 골라 주세요.');
  const template=choices[Math.floor(random()*choices.length)],turn=Math.floor(random()*4),flip=random()>.5;
  const points=template.points.map(([initialX,initialY])=>{
    let x=flip?1-initialX:initialX,y=initialY;
    for(let i=0;i<turn;i++)[x,y]=[1-y,x];
    return [x,y];
  });
  return {points,edges:template.edges.map(edge=>[...edge])};
}

export function createStarPathGame({board,setScore}={}){
  let difficulty='low',puzzle=null,current=null,used=new Set(),moves=[],finished=false,active=true;
  const root=document.createElement('section');root.className='star-path-game';
  const levels=document.createElement('div');levels.className='star-path-levels';
  for(const [key,label] of Object.entries(labels)){
    const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.difficulty=key;
    button.onclick=()=>{difficulty=key;start();};levels.append(button);
  }
  const help=document.createElement('p');help.className='star-path-help';help.textContent='같은 선을 두 번 지나지 않고 모든 선을 이어 보세요. 점은 다시 지나갈 수 있어요.';
  const field=document.createElement('div');field.className='star-path-field';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('aria-hidden','true');
  const nodes=document.createElement('div');nodes.className='star-path-nodes';field.append(svg,nodes);
  const controls=document.createElement('div');controls.className='star-path-actions';
  const undo=document.createElement('button');undo.textContent='한 선 되돌리기';undo.type='button';undo.onclick=()=>{
    if(!moves.length||finished)return;const last=moves.pop();used.delete(last.edgeIndex);current=last.from;draw();update('한 선을 되돌렸어요');
  };
  const reset=document.createElement('button');reset.textContent='새 도형';reset.type='button';reset.onclick=start;
  controls.append(undo,reset);root.append(levels,help,field,controls);board.append(root);
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
    if(!active||finished)return;
    if(current===null){current=index;draw();update('출발했어요');return;}
    const edgeIndex=puzzle.edges.findIndex(([a,b],id)=>!used.has(id)&&(a===current&&b===index||b===current&&a===index));
    if(edgeIndex<0){update('이어진 새 선을 골라요');return;}
    used.add(edgeIndex);moves.push({edgeIndex,from:current,to:index});current=index;
    draw();
    if(used.size===puzzle.edges.length){finished=true;setScore(`성공! ${labels[difficulty]} 난이도 한붓그리기 완성`);}
    else update();
  }
  function start(){puzzle=oneStrokePuzzle(difficulty);current=null;used=new Set();moves=[];finished=false;
    for(const button of levels.children)button.setAttribute('aria-pressed',String(button.dataset.difficulty===difficulty));
    draw();update('아무 점에서 시작해 보세요');}
  start();
  return {destroy(){active=false;root.remove();}};
}
