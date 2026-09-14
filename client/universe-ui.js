import {mapOf,PLAZA_ID,STREET_ID,GARDEN_ID,VALLEY_ID,interiorIdOf,templateOf} from '/shared/config.js';

// 서버가 알려준 내 위치만 표시합니다. 지도를 고르는 동작은 실제 이동 요청을 보내지 않습니다.
export function createUniverseUI({getRoom,getSelfId,stop,onAreaView}) {
  const $=id=>document.getElementById(id),dialog=$('universe-dialog');
  let position=null,selected=null,signature='';
  const me=()=>getRoom()?.players.find(p=>p.id===getSelfId());
  const planets=()=>getRoom()?.planets||[];
  const map=id=>mapOf(id,planets());
  function close(){dialog.close();}
  $('universe-close').onclick=close;
  $('map-overview').onclick=()=>{
    if(!me())return;stop();selected=me().mapId;signature='';render();
    if(!dialog.open)dialog.showModal();draw($('universe-preview'),selected,true);
  };
  $('map-area-view').onclick=()=>{close();onAreaView();};
  function node(id,icon){
    const button=document.createElement('button');button.type='button';button.className='universe-node';button.dataset.mapId=id;
    const name=document.createElement('span');name.textContent=icon+' '+map(id).name;button.append(name);
    if(id===me()?.mapId){const badge=document.createElement('span');badge.className='location-badge';badge.textContent='내가 있는 곳';button.append(badge);button.classList.add('is-current');button.setAttribute('aria-current','location');}
    button.classList.toggle('is-selected',id===selected);button.setAttribute('aria-pressed',String(id===selected));
    button.onclick=()=>{selected=id;signature='';render();};return button;
  }
  // 지도는 같은 비율로 축소합니다. 화면 모양이 달라도 점의 좌표가 어긋나지 않습니다.
  function draw(canvas,mapId,detailed=false){
    const info=map(mapId),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,pad=detailed?28:12;
    const scale=Math.min((w-pad*2)/info.width,(h-pad*2)/info.height),ox=(w-info.width*scale)/2,oy=(h-info.height*scale)/2;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#f2edfc';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#e1daf2';ctx.fillRect(ox,oy,info.width*scale,info.height*scale);
    ctx.strokeStyle='#b9a9d7';ctx.lineWidth=2;ctx.strokeRect(ox,oy,info.width*scale,info.height*scale);
    for(const o of info.objects){
      const x=ox+o.x*scale,y=oy+o.y*scale;
      ctx.fillStyle=o.color||'#fff0b6';ctx.beginPath();ctx.arc(x,y,Math.max(detailed?5:2.5,o.radius*scale),0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#8978aa';ctx.lineWidth=1;ctx.stroke();
      if(detailed){ctx.fillStyle='#54456e';ctx.font='15px Jua, sans-serif';ctx.textAlign='center';const label=o.name||'행성';ctx.fillText(label,Math.max(65,Math.min(w-65,x)),Math.min(h-9,y+o.radius*scale+20),125);}
    }
    const p=position||me();canvas.dataset.mapId=mapId;
    if(p&&p.mapId===mapId){
      const x=ox+Math.max(0,Math.min(info.width,p.x))*scale,y=oy+Math.max(0,Math.min(info.height,p.y))*scale;
      ctx.fillStyle='#8754cf';ctx.beginPath();ctx.arc(x,y,detailed?9:5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=detailed?4:2;ctx.stroke();
      if(detailed){ctx.font='19px Jua, sans-serif';ctx.textAlign='center';ctx.fillStyle='#59318c';ctx.fillText('나',x,Math.max(23,y-17));}
      canvas.dataset.playerX=String(p.x);canvas.dataset.playerY=String(p.y);canvas.dataset.hasPlayer='true';
    }else{delete canvas.dataset.playerX;delete canvas.dataset.playerY;canvas.dataset.hasPlayer='false';}
    canvas.setAttribute('aria-label',info.name+(p?.mapId===mapId?' · 보라색 점은 내 현재 위치':' · 지도 미리보기'));
  }
  function render(){
    const p=me();if(!p)return;
    $('minimap-title').textContent=map(p.mapId).name;draw($('minimap'),p.mapId);
    if(!selected||!([PLAZA_ID,STREET_ID,GARDEN_ID,VALLEY_ID,...planets().map(p=>interiorIdOf(p.id))].includes(selected)))selected=p.mapId;
    const next=JSON.stringify([p.mapId,selected,planets().map(p=>[p.id,p.name,p.color])]);
    if(next!==signature){signature=next;
      $('universe-current').textContent='내가 있는 곳: '+map(p.mapId).name;
      $('universe-links').replaceChildren(node(GARDEN_ID,'☀'),node(PLAZA_ID,'★'),node(STREET_ID,'✦'),node(VALLEY_ID,'≋'));
      $('universe-planets').replaceChildren(...planets().map(p=>node(interiorIdOf(p.id),templateOf(p.templateId)?.icon||'●')));
      if(!planets().length)$('universe-planets').textContent='아직 만들어진 부서행성이 없어요.';
    }
    $('universe-preview-title').textContent=map(selected).name;
    if(dialog.open)draw($('universe-preview'),selected,true);
  }
  // showModal 직후에도 첫 프레임을 그립니다. 열린 동안에만 큰 지도를 갱신합니다.
  return {
    update(){position=me()?{...me()}:null;render();},
    positions(data){const own=data.positions.find(([id])=>id===getSelfId());if(own&&me()){position={mapId:me().mapId,x:own[1],y:own[2]};render();}},
    reset(){if(dialog.open)dialog.close();position=null;selected=null;signature='';$('minimap').getContext('2d').clearRect(0,0,300,180);}
  };
}
