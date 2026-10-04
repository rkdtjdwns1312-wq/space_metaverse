import {drawParadiseFloor} from './paradise-floor.js';
import {drawParadiseBackdrop,onParadiseArtReady} from './paradise-art.js';
import {drawPlazaGround} from './plaza-art.js';
import {drawValleyGround} from './valley-art.js';
import {drawOriginArt,onOriginArtReady} from './origin-art.js';
import {drawStreetGround,onStreetArtReady} from './street-art.js';
import {drawBlackHoleGround} from './black-hole-art.js';
import {drawInteriorFloor} from './interior-art.js';
import {DEPARTMENT_ART} from './department-art.js';
import {PAINTED_PROPS} from './painted-props.js';
import {mapOf,PLAZA_ID,STREET_ID,GARDEN_ID,VALLEY_ID,BLACK_HOLE_ID,ORIGIN_MAPS,PARADISE_MAPS,MOON_PARADISE_MAPS,STAR_PARADISE,STATIC_MAPS,interiorIdOf,templateOf} from '/shared/config.js';

// 서버가 알려준 내 위치만 표시합니다. 지도를 고르는 동작은 실제 이동 요청을 보내지 않습니다.
export function createUniverseUI({getRoom,getSelfId,stop,onAreaView}) {
  const $=id=>document.getElementById(id),dialog=$('universe-dialog');
  let position=null,selected=null,signature='';
  let minimapOpen=true;
  function setMinimapOpen(open){
    minimapOpen=open;
    $('world-navigation').classList.toggle('minimap-collapsed',!open);
    $('minimap-title').hidden=!open;
    $('minimap').hidden=!open;
    $('map-overview').hidden=!open;
    $('minimap-toggle').textContent=open?'맵 닫기':'지도 보기';
    $('minimap-toggle').setAttribute('aria-expanded',String(open));
  }
  const me=()=>getRoom()?.players.find(p=>p.id===getSelfId());
  const planets=()=>getRoom()?.planets||[];
  const map=id=>mapOf(id,planets());
  const pictures=new Map();
  const picture=src=>{
    if(!src)return null;
    if(!pictures.has(src)){
      const image=new Image();image.onload=refreshArt;image.src=src;pictures.set(src,image);
    }
    const image=pictures.get(src);return image.complete&&image.naturalWidth?image:null;
  };
  // 원화가 늦게 도착해도 열려 있는 지도와 지도 선택 그림을 함께 갱신합니다.
  function refreshArt(){
    if(me())draw($('minimap'),me().mapId);
    if(dialog.open)draw($('universe-preview'),selected||me()?.mapId,true);
    for(const canvas of $('universe-links').querySelectorAll('canvas[data-map-id]'))draw(canvas,canvas.dataset.mapId);
    for(const canvas of $('universe-planets').querySelectorAll('canvas[data-map-id]'))draw(canvas,canvas.dataset.mapId);
  }
  onParadiseArtReady(refreshArt);onOriginArtReady(refreshArt);onStreetArtReady(refreshArt);
  function close(){dialog.close();}
  $('universe-close').onclick=close;
  $('minimap-toggle').onclick=()=>setMinimapOpen(!minimapOpen);
  $('map-overview').onclick=()=>{
    if(!me())return;stop();selected=me().mapId;signature='';render();
    if(!dialog.open)dialog.showModal();draw($('universe-preview'),selected,true);
  };
  $('map-area-view').onclick=()=>{close();onAreaView();};
  function node(id,icon){
    const button=document.createElement('button');button.type='button';button.className='universe-node';button.dataset.mapId=id;
    const thumbnail=document.createElement('canvas');thumbnail.width=144;thumbnail.height=84;thumbnail.className='universe-thumbnail';thumbnail.setAttribute('aria-hidden','true');
    const name=document.createElement('span');name.textContent=map(id).name;button.append(thumbnail,name);draw(thumbnail,id);
    if(id===me()?.mapId){const badge=document.createElement('span');badge.className='location-badge';badge.textContent='내가 있는 곳';button.append(badge);button.classList.add('is-current');button.setAttribute('aria-current','location');}
    button.classList.toggle('is-selected',id===selected);button.setAttribute('aria-pressed',String(id===selected));
    button.onclick=()=>{selected=id;signature='';render();};return button;
  }
  // 물체는 게임 화면에서 쓰는 원화의 작은 판을 사용합니다. 축소 지도용 도형을 따로
  // 유지하면 실제 상점·행성·문과 모양이 달라져 아이들이 위치를 알아보기 어렵습니다.
  function drawSilhouette(ctx,o,x,y,r,theme,scale){
    const kind=o.kind||'planet';
    const src=kind==='planet'?DEPARTMENT_ART[o.templateId]?.src:
      PAINTED_PROPS[kind]?'/assets/maps/'+PAINTED_PROPS[kind].file:
      ['gate','door'].includes(kind)?'/assets/maps/star-gate.png':
      kind==='pillar'?'/assets/maps/plaza-pillar.png':
      kind==='market'?'/assets/maps/plaza-bazaar.png':
      kind==='exploration'?'/assets/maps/plaza-exploration-flask.png':
      kind==='andromeda'?'/assets/maps/plaza-andromeda.png':
      kind==='black-hole'?'/assets/maps/plaza-black-hole.png':
      kind==='evolution'?'/assets/maps/evolution-altar.png':
      kind==='growth'?'/assets/maps/growth-altar.png':
      kind==='black-star'?'/assets/maps/black-star-sanctuary.png':
      ['board','mailbox','report-board','warning-rock','interior-decor-machine'].includes(kind)?'/assets/interior/'+({board:'board',mailbox:'mailbox','report-board':'report','warning-rock':'warning','interior-decor-machine':'control'}[kind])+'.png':null;
    const image=picture(src);
    if(image&&kind==='market'){
      // 시장은 구역 자체가 상호작용 범위이므로 radius로 그리면 지도 밖까지 커집니다.
      const width=o.rx*1.7*scale,height=o.ry*1.75*scale;
      ctx.drawImage(image,x-width/2,y-height/2,width,height);return;
    }
    if(image){const height=Math.max(8,r*(kind==='planet'?3.5:kind==='market'?4:2.8)),width=Math.min(height*image.naturalWidth/image.naturalHeight,Math.max(12,r*4));ctx.drawImage(image,x-width/2,y+r*.65-height,width,height);return;}
    // 아직 그림이 도착하지 않은 순간에도 목적지를 찾을 수 있게 부드러운 빛만 남깁니다.
    ctx.save();const glow=ctx.createRadialGradient(x,y,0,x,y,Math.max(4,r*1.5));glow.addColorStop(0,kind==='black-hole'?'#584779':'#fff7d7');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(x-r*1.5,y-r*1.5,r*3,r*3);ctx.restore();
  }
  function mapBackground(ctx,info,x,y,w,h){
    // 고정 맵 네 곳은 config에 theme을 두지 않으므로 실제 id로 배경을 선택합니다.
    const theme=info.theme||({
      [PLAZA_ID]:'plaza',[STREET_ID]:'rainbow-space',[GARDEN_ID]:'paradise-crossroads',[VALLEY_ID]:'valley'
    }[info.id]||'default');
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.translate(x,y);ctx.scale(w/info.width,h/info.height);
    if(theme==='plaza')drawPlazaGround(ctx,info);
    else if(theme==='starlight-street'||theme==='rainbow-space')drawStreetGround(ctx,info);
    else if(theme==='star-origin')drawOriginArt(ctx,info);
    else if(theme==='valley')drawValleyGround(ctx,info,0);
    else if(['sun-paradise','moon-paradise','star-paradise','paradise-crossroads'].includes(theme)){
      drawParadiseBackdrop(ctx,info);drawParadiseFloor(ctx,info);
    }else if(theme==='black-hole')drawBlackHoleGround(ctx,info);
    else if(info.planetId){drawInteriorFloor(ctx,info,planets().find(p=>p.id===info.planetId));}
    else{ctx.fillStyle='#d7d0eb';ctx.fillRect(0,0,info.width,info.height);}
    ctx.restore();
  }
  // 지도는 같은 비율로 축소합니다. 화면 모양이 달라도 좌표가 어긋나지 않습니다.
  function draw(canvas,mapId,detailed=false){
    const info=map(mapId),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,pad=detailed?28:12;
    const scale=Math.min((w-pad*2)/info.width,(h-pad*2)/info.height),ox=(w-info.width*scale)/2,oy=(h-info.height*scale)/2;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#f2edfc';ctx.fillRect(0,0,w,h);
    mapBackground(ctx,info,ox,oy,info.width*scale,info.height*scale);
    // 실세계에는 사각 테두리가 없습니다. 지도에서도 인공적인 외곽선을 덧그리지 않습니다.
    for(const o of info.objects){
      if(o.kind==='street-sign')continue; // 길목 글씨는 실물이 아니므로 작은 지도에 푯말을 남기지 않습니다.
      const x=ox+o.x*scale,y=oy+o.y*scale;
      drawSilhouette(ctx,o,x,y,Math.max(detailed?5:2.5,o.radius*scale),info.theme,scale);
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
    if(!selected||!([...Object.keys(STATIC_MAPS),...planets().map(p=>interiorIdOf(p.id))].includes(selected)))selected=p.mapId;
    const next=JSON.stringify([p.mapId,selected,planets().map(p=>[p.id,p.name,p.color])]);
    if(next!==signature){signature=next;
      $('universe-current').textContent='내가 있는 곳: '+map(p.mapId).name;
      const layout=[...ORIGIN_MAPS.map((m,i)=>[m.id,'✧',3-i,4]).reverse(),[BLACK_HOLE_ID,'◉',3,5],
        ...PARADISE_MAPS.map((m,i)=>[m.id,'☀',3,3-i]),...MOON_PARADISE_MAPS.map((m,i)=>[m.id,'☾',5,3-i]),
        [STAR_PARADISE.id,'✵',4,1],[GARDEN_ID,'✧',4,3],[PLAZA_ID,'★',4,4],[STREET_ID,'✦',4,5],[VALLEY_ID,'≋',5,4]];
      $('universe-links').replaceChildren(...layout.map(([id,icon,row,column])=>{const button=node(id,icon);button.style.gridRow=String(row);button.style.gridColumn=String(column);return button;}));
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
