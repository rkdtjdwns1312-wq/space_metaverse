import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

class Element{
  children=[];hidden=false;disabled=false;textContent='';value='';
  classList={add(){},remove(){}};
  replaceChildren(...children){this.children=children;}
  querySelector(){return new Element();}
  insertAdjacentElement(){}before(){}focus(){}showModal(){}close(){}addEventListener(){}
}
test('math and English correct counts update immediately after every answer, including the tenth',async()=>{
  const previous=globalThis.document,els=new Map(),created=[];
  const get=id=>{if(!els.has(id))els.set(id,new Element());return els.get(id);};
  globalThis.document={getElementById:get,createElement:()=>{const element=new Element();created.push(element);return element;}};
  try{
    let source=await readFile(new URL('../client/learning-station.js',import.meta.url),'utf8');
    source=source.replace("'/shared/english-vocabulary.js'",JSON.stringify(new URL('../shared/english-vocabulary.js',import.meta.url).href));
    const {createLearningStation}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
    let correct=0,round=0,answerButton;
    const ui=createLearningStation({request:async event=>{
      if(event.endsWith(':start')){correct=0;round=0;}
      if(event.endsWith(':answer')){round++;const right=round!==2;if(right)correct++;return {right,answer:1,correct};}
      return {questionId:'q',prompt:'1 + 0 = ?',choices:[1,2]};
    }});
    for(const subject of ['math-station','english-station']){
      ui.open(subject);
      // These dynamically created controls are captured below by the DOM factory.
      await created.find(e=>e.id==='learning-start').onclick();
      for(let i=1;i<=10;i++){
        answerButton=get('learning-choices').children[0];await answerButton.onclick();
        assert.equal(get('learning-progress').textContent,`${i} / 10 · 맞힌 문제 ${i===1?1:i-1}`);
        if(i<10)await get('learning-next').onclick();
      }
    }
  }finally{globalThis.document=previous;}
});
