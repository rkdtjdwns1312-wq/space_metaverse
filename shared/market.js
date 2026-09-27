import {PLAZA_LAYOUT} from './plaza-layout.js';

// 시장 위치와 크기는 광장 레이아웃의 시장 섬에서 파생합니다.
const zone=PLAZA_LAYOUT.islands.find(island=>island.id==='market');
const WALL_MARGIN=10;
export const MARKET=Object.freeze({id:'star-market',name:'별 시장',x:zone.x,y:zone.y,
  rx:zone.rx,ry:zone.ry,radius:zone.rx-WALL_MARGIN,kind:'market',passable:true});
export const MARKET_TRADE_TTL=5*60_000;
export function inMarket(player){
  if(!player||player.mapId!=='space-plaza'||!player.connected||player.away
    ||!Number.isFinite(player.x)||!Number.isFinite(player.y))return false;
  const xRadius=MARKET.rx-WALL_MARGIN,yRadius=MARKET.ry-WALL_MARGIN;
  return ((player.x-MARKET.x)/xRadius)**2+((player.y-MARKET.y)/yRadius)**2<=1;
}
