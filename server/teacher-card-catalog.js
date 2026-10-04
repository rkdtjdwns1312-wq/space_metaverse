import {STAR_CARD_CATALOG} from '../shared/star-cards.js';
import {STAR_CARD_AUTOMATION} from '../shared/star-card-automation.js';
import {rabbitDrawEntries} from './rabbit-draw.js';
import {ensure} from './rooms.js';
import {displayStarCard} from './star-card-text.js';

export function teacherCardCatalog(room,player){
  ensure(room.players.get(player?.id)===player&&player.role==='teacher','선생님만 카드 목록을 볼 수 있어요.');
  const silver=rabbitDrawEntries(room.rabbitDrawCounts);
  return {gold:STAR_CARD_CATALOG.map(base=>{const card=displayStarCard(room,base.id),policy=STAR_CARD_AUTOMATION[card.id]||base;return {
    id:card.id,name:card.name,description:card.description,effect:card.effect,durationDays:card.durationDays,
    automatic:[...policy.automatic],manual:[...policy.manual]};}),silver,silverTotal:silver.reduce((sum,entry)=>sum+entry.count,0)};
}
