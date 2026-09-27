// 원화의 가운데 종이 영역에 붙는 읽기 전용 HTML입니다.
// Canvas와 동일한 카메라/배율을 사용하고, 긴 규칙은 글자를 줄이지 않고 스크롤합니다.
export function createInteriorBoardUI(canvas){
  const panel=document.createElement('section');panel.id='interior-board-content';panel.hidden=true;panel.setAttribute('aria-label','부서행성 규칙 게시판');
  const title=document.createElement('h3'),list=document.createElement('ol');list.id='interior-board-rules';list.tabIndex=0;list.setAttribute('aria-label','행성 규칙 전체 내용');
  panel.append(title,list);canvas.parentElement.append(panel);let contentKey='';
  const stop=()=>window.dispatchEvent(new Event('game-ui-focus'));
  panel.addEventListener('pointerdown',stop);panel.addEventListener('focusin',stop);
  panel.addEventListener('keydown',event=>event.stopPropagation());
  panel.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
  return {update({map,planet,view,rect,visible}){
    const board=map.objects.find(o=>o.kind==='board');
    panel.hidden=!visible||!planet||!board;if(panel.hidden)return;
    const rules=planet.rules||[],key=JSON.stringify([planet.id,planet.name,rules]);
    if(key!==contentKey){
      contentKey=key;title.textContent=planet.name+' 규칙';
      list.replaceChildren(...(rules.length?rules:['아직 등록된 규칙이 없어요.']).map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));list.scrollTop=0;
    }
    // 640×330 원화의 중앙 종이 안쪽. 아래 장식과 좌우 기둥을 침범하지 않습니다.
    const left=rect.left+(board.x-222-view.x)*view.scale;
    // 작은 화면에서도 오른쪽 스크롤 손잡이가 화면 밖으로 밀리지 않게 합니다.
    const top=rect.top+(board.y-39-view.y)*view.scale;
    const visibleLeft=Math.max(rect.left+8,left),visibleRight=Math.min(rect.right-8,left+444*view.scale);
    panel.style.width=Math.max(0,(visibleRight-visibleLeft)/view.scale)+'px';
    panel.style.transform=`translate3d(${visibleLeft}px,${top}px,0) scale(${view.scale})`;
  }};
}
