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
    const name=document.createElement('span');name.textContent=icon+' '+map(id).name;button.append(name);
    if(map(id).minLevel){const level=document.createElement('span');level.className='map-level';level.textContent='LV'+map(id).minLevel+' 이상';button.append(level);}
    if(id===me()?.mapId){const badge=document.createElement('span');badge.className='location-badge';badge.textContent='내가 있는 곳';button.append(badge);button.classList.add('is-current');button.setAttribute('aria-current','location');}
    button.classList.toggle('is-selected',id===selected);button.setAttribute('aria-pressed',String(id===selected));
    button.onclick=()=>{selected=id;signature='';render();};return button;
  }
  // 작은 지도에서도 실제 월드의 종류와 위치가 보이도록 간단한 실루엣을 사용합니다.
  // 애니메이션이나 월드 캔버스 재사용 없이, 미니맵을 그릴 때만 한 번씩 그립니다.
  function drawSilhouette(ctx,o,x,y,r,theme){
    const color=o.color|| (theme==='black-hole'?'#a995d8':'#fff0b6');
    const kind=o.kind||'planet';
    ctx.save();ctx.translate(x,y);ctx.fillStyle=color;ctx.strokeStyle='#665784';ctx.lineWidth=Math.max(1,r*.08);
    if(kind==='pillar'){
      ctx.beginPath();ctx.roundRect(-r*.35,-r*1.15,r*.7,r*1.8,r*.18);ctx.fill();ctx.stroke();
      ctx.fillRect(-r*.55,-r*1.25,r*1.1,r*.2);ctx.fillRect(-r*.55,r*.62,r*1.1,r*.2);
    }else if(kind==='gate'||kind==='door'){
      ctx.beginPath();ctx.arc(0,0,r*.8,Math.PI,0);ctx.lineTo(r*.8,r*.75);ctx.lineTo(-r*.8,r*.75);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#ffffff88';ctx.fillRect(-r*.42,-r*.05,r*.84,r*.75);
    }else if(kind==='shop'){
      ctx.fillRect(-r*.8,-r*.35,r*1.6,r*1.1);ctx.strokeRect(-r*.8,-r*.35,r*1.6,r*1.1);
      ctx.beginPath();ctx.moveTo(-r,-r*.35);ctx.lineTo(0,-r*1.05);ctx.lineTo(r,-r*.35);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#fff8';ctx.fillRect(-r*.25,r*.05,r*.5,r*.7);
    }else if(kind==='energy-shop'){
      ctx.beginPath();ctx.roundRect(-r,-r*.6,r*2,r*1.3,r*.4);ctx.fill();ctx.stroke();
      ctx.fillStyle='#dff9ff';ctx.beginPath();ctx.ellipse(0,-r*.55,r,r*.35,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#559eea';ctx.beginPath();ctx.moveTo(0,-r*1.2);ctx.lineTo(r*.3,-r*.8);ctx.lineTo(0,-r*.4);ctx.lineTo(-r*.3,-r*.8);ctx.closePath();ctx.fill();
    }else if(kind==='crafting'){
      ctx.beginPath();ctx.ellipse(0,r*.15,r*.85,r*.6,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#e6fff5';ctx.beginPath();ctx.ellipse(0,-r*.2,r*.85,r*.22,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.fillStyle='#ffe298';ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=(i%2?.22:.48)*r;const px=Math.cos(a)*s,py=-r*.65+Math.sin(a)*s;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();
    }else if(kind==='arcade'){
      ctx.beginPath();ctx.roundRect(-r*.65,-r,r*1.3,r*2,r*.18);ctx.fill();ctx.stroke();
      ctx.fillStyle='#ffffffb8';ctx.fillRect(-r*.4,-r*.55,r*.8,r*.55);ctx.fillStyle='#665784';ctx.fillRect(-r*.2,r*.2,r*.4,r*.12);
    }else if(kind==='star'||kind==='growth'||kind==='evolution'||kind==='black-star'){
      ctx.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,s=i%2?r*.42:r;const px=Math.cos(a)*s,py=Math.sin(a)*s;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();ctx.fill();ctx.stroke();
    }else if(kind==='board'||kind==='report-board'){
      ctx.fillRect(-r*.9,-r*.65,r*1.8,r*1.15);ctx.strokeRect(-r*.9,-r*.65,r*1.8,r*1.15);ctx.beginPath();ctx.moveTo(0,r*.5);ctx.lineTo(0,r*1.1);ctx.stroke();
      ctx.strokeStyle='#ffffffaa';for(let i=-1;i<=1;i++){ctx.beginPath();ctx.moveTo(-r*.55,i*r*.25);ctx.lineTo(r*.55,i*r*.25);ctx.stroke();}
    }else if(kind==='black-hole'){
      ctx.beginPath();ctx.arc(0,0,r*.85,0,Math.PI*2);ctx.fillStyle='#080610';ctx.fill();ctx.stroke();ctx.beginPath();ctx.arc(0,0,r*1.15,.2,Math.PI*1.35);ctx.stroke();
    }else if(kind==='andromeda'){
      // 실제 광장 그림의 부드러운 성운 대신, 작은 지도에서는 중심과 나선 팔만 남깁니다.
      ctx.fillStyle='#dff5ff99';ctx.beginPath();ctx.ellipse(0,0,r*.9,r*.55,-.25,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#ffffffcc';ctx.lineWidth=Math.max(1,r*.08);ctx.beginPath();
      for(let i=0;i<28;i++){const a=i*.42,rr=r*(.08+i/30);const px=Math.cos(a)*rr,py=Math.sin(a)*rr*.58;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.stroke();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,r*.18,0,Math.PI*2);ctx.fill();
    }else if(kind==='lamp'){
      ctx.strokeStyle='#665784';ctx.lineWidth=Math.max(1,r*.12);ctx.beginPath();ctx.moveTo(0,r*.9);ctx.lineTo(0,-r*.45);ctx.stroke();
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,-r*.65,r*.42,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(-r*.38,-r*.2);ctx.lineTo(r*.38,-r*.2);ctx.stroke();
    }else if(kind==='warning-rock'){
      ctx.beginPath();ctx.moveTo(-r*.8,r*.45);ctx.lineTo(-r*.95,-r*.15);ctx.lineTo(-r*.35,-r*.8);ctx.lineTo(r*.35,-r*.7);ctx.lineTo(r*.9,-r*.15);ctx.lineTo(r*.65,r*.65);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle='#d8c8e8';ctx.lineWidth=Math.max(1,r*.09);ctx.beginPath();ctx.moveTo(-r*.12,-r*.35);ctx.lineTo(r*.12,r*.2);ctx.moveTo(r*.12,-r*.35);ctx.lineTo(-r*.12,r*.2);ctx.stroke();
    }else{
      // 부서행성은 원 대신 실제 월드의 행성처럼 타원과 소속 고리를 사용합니다.
      ctx.beginPath();ctx.ellipse(0,0,r*.9,r*.68,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle='#ffffffaa';ctx.beginPath();ctx.ellipse(0,0,r*1.25,r*.35,-.35,0,Math.PI*2);ctx.stroke();
    }
    ctx.restore();
  }
  function mapBackground(ctx,info,x,y,w,h){
    // 고정 맵 네 곳은 config에 theme을 두지 않으므로 실제 id로 배경을 선택합니다.
    const theme=info.theme||({
      [PLAZA_ID]:'plaza',[STREET_ID]:'rainbow-space',[GARDEN_ID]:'paradise-crossroads',[VALLEY_ID]:'valley'
    }[info.id]||'default');
    ctx.fillStyle=theme==='black-hole'?'#05040a':theme==='star-origin'?'#090b17':theme==='rainbow-space'?'#726aa4':theme==='sun-paradise'?'#f4d4c5':theme==='moon-paradise'?'#aaaed9':theme==='valley'?'#c7c9e5':'#e1daf2';
    ctx.fillRect(x,y,w,h);
    if(theme==='plaza'){
      // 본 맵과 같은 신전 바닥 중심을 사용합니다.
      const sx=w/info.width,sy=h/info.height,cx=x+(info.templeCenter?.x??1080)*sx,cy=y+(info.templeCenter?.y??700)*sy;
      ctx.fillStyle='#bda9d688';ctx.beginPath();ctx.ellipse(cx,cy+26*sy,443*sx,257*sy,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fbf4fccc';ctx.beginPath();ctx.ellipse(cx,cy-10*sy,419*sx,229*sy,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#bfaed766';ctx.lineWidth=Math.max(1,2*sx);
      for(const r of [120,235,342]){ctx.beginPath();ctx.ellipse(cx,cy-16*sy,r*sx,r*.52*sy,0,0,Math.PI*2);ctx.stroke();}
    }
    if(theme==='star-origin'){ctx.fillStyle='#cfd9ff99';for(let i=0;i<24;i++){ctx.fillRect(x+(i*83%Math.max(1,w)),y+(i*47%Math.max(1,h)),1.5,1.5);}}
    // scenery.js의 고정 지형만 같은 좌표계로 축약합니다. 은하수의 움직임은 생략합니다.
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.translate(x,y);ctx.scale(w/info.width,h/info.height);
    if(theme==='paradise-crossroads'){
      ctx.fillStyle='#f3eefb';ctx.beginPath();ctx.ellipse(600,375.25,375.25,166.25,0,0,Math.PI*2);ctx.fill();
    }
    if(theme==='sun-paradise'||theme==='moon-paradise'){
      const moon=theme==='moon-paradise',v=info.vista;
      ctx.fillStyle=moon?'#e8e9fc':'#fff2db';ctx.beginPath();ctx.ellipse(670,466,425,190,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=moon?'#cdd8f0':'#f9dfbe';ctx.beginPath();ctx.ellipse(670,461,390,168,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=moon?'#f4f2ff':'#fff2ad';ctx.beginPath();ctx.arc(v.bodyX,v.bodyY,v.bodyRadius,0,Math.PI*2);ctx.fill();
      if(moon){ctx.fillStyle='#bcc3e5';ctx.beginPath();ctx.arc(v.bodyX+v.bodyRadius*.3,v.bodyY+v.bodyRadius*.29,v.bodyRadius*.2,0,Math.PI*2);ctx.fill();}
    }
    if(theme==='star-paradise'){
      const glow=ctx.createLinearGradient(0,0,1200,760);glow.addColorStop(0,'#f6dbb7');glow.addColorStop(.5,'#e0cce6');glow.addColorStop(1,'#b4c9e9');ctx.fillStyle=glow;ctx.fillRect(0,0,1200,760);
      ctx.fillStyle='#f9eff9';ctx.beginPath();ctx.ellipse(600,425,355,174,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#fff0b1';ctx.beginPath();ctx.arc(220,180,68,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#f4f4ff';ctx.beginPath();ctx.arc(970,530,80,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b9c8e1';ctx.beginPath();ctx.arc(994,511,65,0,Math.PI*2);ctx.fill();
    }
    if(theme==='valley'){
      for(const [width,color] of [[135,'#dceafd80'],[40,'#fff8ffaa']]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(-120,780);ctx.bezierCurveTo(450,780,340,210,1320,290);ctx.stroke();}
    }
    if(theme==='rainbow-space'){
      for(const [i,color] of ['#ffbbd9','#ffdba2','#bceacc','#b9deff','#ddc0ff'].entries()){ctx.strokeStyle=color+'90';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(-50,560+i*20);ctx.bezierCurveTo(300,80+i*42,720,720-i*38,1250,180+i*30);ctx.stroke();}
    }
    ctx.restore();
  }
  // 지도는 같은 비율로 축소합니다. 화면 모양이 달라도 좌표가 어긋나지 않습니다.
  function draw(canvas,mapId,detailed=false){
    const info=map(mapId),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,pad=detailed?28:12;
    const scale=Math.min((w-pad*2)/info.width,(h-pad*2)/info.height),ox=(w-info.width*scale)/2,oy=(h-info.height*scale)/2;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#f2edfc';ctx.fillRect(0,0,w,h);
    mapBackground(ctx,info,ox,oy,info.width*scale,info.height*scale);
    ctx.strokeStyle='#b9a9d7';ctx.lineWidth=2;ctx.strokeRect(ox,oy,info.width*scale,info.height*scale);
    for(const o of info.objects){
      const x=ox+o.x*scale,y=oy+o.y*scale;
      drawSilhouette(ctx,o,x,y,Math.max(detailed?5:2.5,o.radius*scale),info.theme);
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
