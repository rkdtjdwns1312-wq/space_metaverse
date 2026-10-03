import {randomUUID} from 'node:crypto';
import {itemOf} from '../shared/config.js';

const KST_MS=9*60*60*1000;
const DAY_MS=24*60*60*1000;

export function nextKoreaMidnight(now=Date.now()){
  return (Math.floor((now+KST_MS)/DAY_MS)+1)*DAY_MS-KST_MS;
}

export function activeCardMarkers(player,now=Date.now()){
  return (player.cardMarkers||[]).filter(marker=>marker.itemId!=='moon-rabbit-card'&&(marker.until===null||marker.until>now));
}

export function hasCardStatus(player,itemId,now=Date.now()){
  return activeCardMarkers(player,now).some(marker=>marker.itemId===itemId);
}

// 달빛은 다른 사용자가 보낸 아이템만 막습니다. 사용자 id는 서버 세션에서 가져옵니다.
export function hasMoonProtectionFrom(player,actor,now=Date.now()){
  return player.id!==actor.id && hasCardStatus(player,'little-moon-card',now);
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
    if(Number.isSafeInteger(marker.startsAt))view.startsAt=marker.startsAt;
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
      (marker.holdingAbility===true?item.id!=='alien-creature-card'||marker.until===null:item.mode==='lv4'?false:item.mode==='lv2'?marker.until===null:item.id==='alien-creature-card'&&marker.startsAt!==undefined?marker.until===null:['uv','moon'].includes(item.mode)?marker.until===null:marker.until!==null)||
      (marker.holdingAbility!==undefined&&marker.holdingAbility!==true)||
      typeof marker.fromId!=='string'||typeof marker.fromNickname!=='string'||marker.fromNickname.length>12||
      (marker.note!==undefined&&(typeof marker.note!=='string'||marker.note.length>80))||
      (marker.remainingUses!==undefined&&(!Number.isSafeInteger(marker.remainingUses)||marker.remainingUses<0||marker.remainingUses>99))||
      (marker.at!==undefined&&(!Number.isSafeInteger(marker.at)||marker.at<0))||
      (marker.startsAt!==undefined&&(marker.itemId!=='alien-creature-card'||marker.holdingAbility||!Number.isSafeInteger(marker.startsAt)||marker.startsAt<0||marker.until===null||marker.startsAt>=marker.until))||
      (marker.fromLevel!==undefined&&(!Number.isInteger(marker.fromLevel)||marker.fromLevel<1||marker.fromLevel>6))||
      (marker.seatTargetIds!==undefined&&(marker.itemId!=='nebula-card'||!Array.isArray(marker.seatTargetIds)||marker.seatTargetIds.length!==3||new Set(marker.seatTargetIds).size!==3||marker.seatTargetIds.some(id=>typeof id!=='string'||id.length<1||id.length>80)))||
      (marker.seatingConfirmed!==undefined&&(marker.itemId!=='nebula-card'||typeof marker.seatingConfirmed!=='boolean'||!marker.seatTargetIds))||
      (marker.lunchOrderIds!==undefined&&(marker.itemId!=='solar-system-card'||!Array.isArray(marker.lunchOrderIds)||marker.lunchOrderIds.length!==7||new Set(marker.lunchOrderIds).size!==7||marker.lunchOrderIds.some(id=>typeof id!=='string'||id.length<1||id.length>80)))||
      (marker.lunchOrderConfirmed!==undefined&&(marker.itemId!=='solar-system-card'||typeof marker.lunchOrderConfirmed!=='boolean'||!marker.lunchOrderIds))||
      (marker.pendingGrant!==undefined&&typeof marker.pendingGrant!=='boolean'))
      throw new Error('아이템 사용 기록이 올바르지 않습니다.');
    ids.add(marker.id);
  }
  return structuredClone(value).filter(marker=>marker.until===null||marker.until>Date.now()||marker.itemId==='sun-rabbit-card');
}
