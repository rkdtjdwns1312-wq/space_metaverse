// 그림·상호작용·서버 권한이 같은 경계를 사용합니다.
export const MARKET=Object.freeze({id:'star-market',name:'별 시장',x:1000,y:3500,radius:190,kind:'market',passable:true});
export const MARKET_TRADE_TTL=5*60_000;
export function inMarket(player){
  return !!player&&player.mapId==='space-plaza'&&player.connected&&!player.away
    &&Math.hypot(player.x-MARKET.x,player.y-MARKET.y)<=MARKET.radius;
}
