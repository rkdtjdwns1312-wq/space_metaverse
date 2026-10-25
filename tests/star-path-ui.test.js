import test from 'node:test';
import assert from 'node:assert/strict';
import {createStarPathGame} from '../client/star-path-game.js';

class Element {
  constructor(){this.children=[];this.dataset={};this.style={};this.attributes={};this.hidden=false;}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  setAttribute(name,value){this.attributes[name]=String(value);}
  getAttribute(name){return this.attributes[name];}
  remove(){}
}

test('한붓그리기는 표시된 시작 점에서만 출발한다',async()=>{
  const originalDocument=globalThis.document;
  globalThis.document={createElement:()=>new Element(),createElementNS:()=>new Element()};
  try{
    const board=new Element(),scores=[];
    const puzzle={runId:'test',points:[[.15,.25],[.5,.13],[.85,.25],[.75,.8],[.25,.8]],edges:[[0,1],[1,2],[2,3],[3,4],[4,0],[1,3]]};
    createStarPathGame({board,setScore:message=>scores.push(message),request:async()=>puzzle});
    await new Promise(resolve=>setImmediate(resolve));
    const nodes=board.children[0].children[2].children[1];
    assert.equal(nodes.children[1].textContent,'시작');
    assert.match(nodes.children[1].getAttribute('aria-label'),/시작 점/);

    nodes.children[0].onclick();
    assert.match(scores.at(-1),/‘시작’ 점을 골라요/);
    assert.equal(nodes.children.some(node=>node.dataset.current),false);

    nodes.children[1].onclick();
    assert.equal(nodes.children[1].textContent,'시작');
    assert.equal(nodes.children[1].dataset.current,'true');
    nodes.children[0].onclick();
    assert.equal(nodes.children[0].dataset.current,'true');
    assert.match(scores.at(-1),/1\/6개 선/);
  }finally{globalThis.document=originalDocument;}
});
