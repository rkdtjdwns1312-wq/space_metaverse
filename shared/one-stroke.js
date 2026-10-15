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
