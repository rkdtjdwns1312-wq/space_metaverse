
import {CORVUS_VFX} from '/shared/character-skills.js';
const names=['검은 깃털 투사체','어둠의 깃털 · LV2','그림자의 날개 · LV3','심연의 군황 · LV4'];
const views=Object.values(CORVUS_VFX).map((spec,i)=>{
 const card=document.createElement('article'),title=document.createElement('h2');title.textContent=names[i];
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;canvas.dataset.effect=spec.id;
 const image=new Image();image.src=spec.url;
 const info=document.createElement('small');info.textContent=`24F · ${spec.frameSize}×${spec.frameSize} · 中心 50%, 50%`;
 const link=document.createElement('a');link.href=spec.url;link.download=spec.id+'.png';link.textContent='PNG 시트 저장';
 const preview=document.createElement('a');preview.href=`/assets/skills/corvus/${spec.id}-preview.apng`;preview.textContent=' · APNG 재생';preview.target='_blank';
 card.append(title,canvas,info,link,preview);document.getElementById('effects').append(card);return{spec,image,canvas};
});
let playing=true,start=performance.now(),manual=0;const slider=document.getElementById('frame');
document.getElementById('play').onclick=e=>{playing=!playing;start=performance.now()-manual*1000/24;e.target.textContent=playing?'일시 정지':'재생';};
document.getElementById('background').onclick=()=>document.body.classList.toggle('light');
slider.oninput=()=>{playing=false;manual=+slider.value-1;document.getElementById('play').textContent='재생';};
function draw(now){
 const speed=+document.getElementById('speed').value;
 const frame=playing?Math.min(23,Math.floor(((now-start)*speed%1400)/1000*24)):manual;manual=frame;slider.value=frame+1;
 document.getElementById('counter').value=`${frame+1} / 24`;
 for(const {spec,image,canvas} of views){const c=canvas.getContext('2d');c.clearRect(0,0,512,512);if(image.complete&&image.naturalWidth)c.drawImage(image,frame%6*spec.frameSize,Math.floor(frame/6)*spec.frameSize,spec.frameSize,spec.frameSize,0,0,512,512);c.strokeStyle='#aca0c580';c.beginPath();c.moveTo(248,256);c.lineTo(264,256);c.moveTo(256,248);c.lineTo(256,264);c.stroke();canvas.dataset.frame=frame+1;}
 requestAnimationFrame(draw);
}requestAnimationFrame(draw);
