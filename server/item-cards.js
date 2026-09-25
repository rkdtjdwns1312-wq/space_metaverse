import {randomUUID} from 'node:crypto';
import {itemOf} from '../shared/config.js';

const KST_MS=9*60*60*1000;
const DAY_MS=24*60*60*1000;

export function nextKoreaMidnight(now=Date.now()){
  return (Math.floor((now+KST_MS)/DAY_MS)+1)*DAY_MS-KST_MS;
}

export function activeCardMarkers(player,now=Date.now()){
  return (player.cardMarkers||[]).filter(marker=>marker.until===null||marker.until>now);
}

export function hasCardStatus(player,itemId,now=Date.now()){
  return activeCardMarkers(player,now).some(marker=>marker.itemId===itemId);
}

export function hasItemImmunity(player,now=Date.now()){
  return activeCardMarkers(player,now).some(m=>m.itemId==='black-hole-card');
}

export function addCardMarker(player,item,actor,until=null,note=''){
  player.cardMarkers??=[];
  const marker={id:randomUUID(),itemId:item.id,until,fromId:actor.id,fromNickname:actor.nickname,note};
  player.cardMarkers.push(marker);
  return marker;
}

export function cardMarkerViews(player,viewerIsTeacher,now=Date.now()){
  return activeCardMarkers(player,now).map(marker=>{
    const item=itemOf(marker.itemId);
    const view={itemId:item.id,icon:item.icon,label:item.effect.label,style:item.effect.style,until:marker.until,...(item.mode==='uv'?{statusId:'uv'}:item.mode==='moon'?{statusId:'moon'}:{})};
    if(Number.isSafeInteger(marker.remainingUses)&&marker.remainingUses>=0)view.remainingUses=marker.remainingUses;
    if(viewerIsTeacher){view.markerId=marker.id;view.fromId=marker.fromId;view.fromNickname=marker.fromNickname;view.note=marker.note||'';}
    return view;
  });
}

export function validateCardMarkers(value){
  if(value===undefined)return [];
  if(!Array.isArray(value))throw new Error('아이템 사용 기록이 올바르지 않습니다.');
  const ids=new Set();
  for(const marker of value){
    const item=marker&&itemOf(marker.itemId);
    if(!item?.mode||typeof marker.id!=='string'||ids.has(marker.id)||
      (marker.until!==null&&(!Number.isSafeInteger(marker.until)||marker.until<0))||
      (item.mode==='lv4'?false:item.mode==='lv2'?marker.until===null:['uv','moon'].includes(item.mode)?marker.until===null:marker.until!==null)||
      typeof marker.fromId!=='string'||typeof marker.fromNickname!=='string'||marker.fromNickname.length>12||
      (marker.note!==undefined&&(typeof marker.note!=='string'||marker.note.length>80))||
      (marker.remainingUses!==undefined&&(!Number.isSafeInteger(marker.remainingUses)||marker.remainingUses<0||marker.remainingUses>99))||
      (marker.at!==undefined&&(!Number.isSafeInteger(marker.at)||marker.at<0))||
      (marker.fromLevel!==undefined&&(!Number.isInteger(marker.fromLevel)||marker.fromLevel<1||marker.fromLevel>6))||
      (marker.pendingGrant!==undefined&&typeof marker.pendingGrant!=='boolean'))
      throw new Error('아이템 사용 기록이 올바르지 않습니다.');
    ids.add(marker.id);
  }
  return structuredClone(value).filter(marker=>marker.until===null||marker.until>Date.now()||marker.itemId==='sun-rabbit-card');
}
