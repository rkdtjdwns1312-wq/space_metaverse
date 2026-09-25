import {itemOf, TRADE} from '/shared/config.js';
import {inMarket} from '/shared/market.js';

const number = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const amount = value => number(value).toLocaleString('ko-KR');
const offerOf = side => ({shards:number(side?.shards), energy:number(side?.energy),
  items:(side?.items || []).map(({id,quantity}) => ({id,quantity}))});
const offerKey = side => JSON.stringify({...offerOf(side), items:offerOf(side).items.sort((a,b) => a.id.localeCompare(b.id))});
const itemName = id => itemOf(id)?.name || id;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, action, className = '') {
  const node = element('button', 'market-button ' + className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
function itemContent(node, id, quantity) {
  const item = itemOf(id);
  if (item?.art) {
    const image = element('img', 'market-item-art');
    image.src = item.art;
    image.alt = '';
    image.loading = 'lazy';
    node.append(image);
  } else node.append(element('span', 'market-item-icon', item?.icon || '✦'));
  node.append(element('span', 'market-item-name', itemName(id)), element('strong', '', '× ' + amount(quantity)));
}

/** Call update after both room snapshots and player position changes. No local trade authority. */
export function createMarketUI({getRoom, getSelfId, request, stop, toast}) {
  if (!document.querySelector('link[data-market-style]')) {
    const link = element('link');
    link.rel = 'stylesheet';
    link.href = '/market.css';
    link.dataset.marketStyle = '';
    document.head.append(link);
  }
  const dialog = element('dialog', 'market-dialog');
  dialog.id = 'market-dialog';
  dialog.setAttribute('aria-labelledby', 'market-title');
  const header = element('header', 'market-header');
  const title = element('h2', '', '✦ 별 시장');
  title.id = 'market-title';
  const close = button('닫기', dismiss, 'market-secondary');
  close.id = 'market-close';
  header.append(title, close);
  const content = element('div', 'market-content');
  const error = element('p', 'market-error');
  error.setAttribute('role', 'alert');
  dialog.append(header, content, error);
  document.body.append(dialog);

  const pending = element('aside', 'market-pending');
  pending.setAttribute('aria-label', '별 시장 거래 안내');
  const pendingText = element('p');
  pendingText.setAttribute('role', 'status');
  const pendingActions = element('div', 'market-actions');
  const pendingOpen = button('거래창 열기', open);
  const pendingYes = button('예', () => respond(true));
  const pendingNo = button('아니오', () => respond(false), 'market-secondary');
  pending.id = 'market-pending';
  pendingOpen.id = 'market-pending-open';
  pendingYes.id = 'market-pending-accept';
  pendingNo.id = 'market-pending-decline';
  pendingActions.append(pendingOpen, pendingYes, pendingNo);
  pending.append(pendingText, pendingActions);

  let generation = 0, sessionId = getSelfId(), action = null;
  let viewKey = '', refs = {}, draft = null, draftTradeId = null, dirty = false;
  let previousTradeId = null, dismissedId = null, historyTicket = 0;
  let historyEntries = [], historyBusy = false, historyLoaded = false;
  const announced = new Set();
  const players = () => getRoom()?.players || [];
  const self = () => players().find(player => player.id === getSelfId());
  const trades = () => getRoom()?.trades || [];
  const active = () => trades().find(trade => (trade.fromId === getSelfId() || trade.toId === getSelfId())
    && (trade.status === 'proposed' || trade.status === 'negotiating'));
  const ownOffer = trade => trade.fromId === getSelfId() ? trade.give : trade.want;
  const otherOffer = trade => trade.fromId === getSelfId() ? trade.want : trade.give;
  const otherName = trade => (trade.fromId === getSelfId() ? trade.toNickname : trade.fromNickname) || '친구';
  const incoming = trade => trade?.status === 'proposed' && trade.toId === getSelfId();
  const eligible = () => !!self() && self().connected !== false && inMarket(self());
  const otherDialog = () => [...document.querySelectorAll('dialog[open]')].filter(node => node !== dialog).at(-1);

  function message(text) { error.textContent = text; }
  function dismiss() {
    dismissedId = active()?.id || null;
    historyTicket++;
    historyBusy = false;
    if (dialog.open) dialog.close();
    update();
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); });
  // Do not let movement shortcuts consume keys used in this dialog or pending notice.
  for (const node of [dialog, pending]) {
    node.addEventListener('keydown', event => event.stopPropagation());
    node.addEventListener('keyup', event => event.stopPropagation());
  }

  function show() {
    stop();
    if (!dialog.open) dialog.showModal();
    pending.remove();
  }
  function newView(key, heading) {
    if (viewKey === key) return false;
    viewKey = key;
    refs = {};
    title.textContent = heading;
    content.replaceChildren();
    message('');
    return true;
  }

  // A successful ack alone must never unlock confirm against the old room revision.
  // Keep the action locked until the corresponding authoritative snapshot is visible.
  async function perform(event, data, observed, success) {
    if (action || !eligible()) return;
    const ticket = {generation, selfId:getSelfId(), tradeId:data.tradeId, ack:false, observed};
    action = ticket;
    message('');
    update();
    try {
      const reply = await request(event, data);
      if (action !== ticket || ticket.generation !== generation || ticket.selfId !== getSelfId()) return;
      if (reply?.ok === false) throw new Error(reply.error || '거래를 처리하지 못했어요.');
      ticket.ack = true;
      success?.(reply);
    } catch (e) {
      if (action !== ticket || ticket.generation !== generation || ticket.selfId !== getSelfId()) return;
      action = null;
      message(e.message || '연결을 확인한 뒤 다시 시도해 주세요.');
      toast(e.message || '거래를 처리하지 못했어요.');
    } finally {
      if (ticket.generation === generation && ticket.selfId === getSelfId()) update();
    }
  }

  function respond(accept) {
    const trade = active();
    if (!incoming(trade)) return;
    const id = trade.id;
    if (accept) dismissedId = null;
    void perform('trade:respond', {tradeId:id, accept}, () => {
      const current = active();
      return current?.id !== id || current.status !== 'proposed';
    });
  }
  function cancel() {
    const trade = active();
    if (!trade) return;
    const id = trade.id;
    void perform('trade:cancel', {tradeId:id}, () => active()?.id !== id);
  }

  function renderFriends() {
    if (newView('friends', '✦ 별 시장 · 친구 찾기')) {
      content.append(element('p', 'market-hint', '시장 안에 있는 친구에게 거래를 걸어 보세요. 서로 수락하면 물건을 올릴 수 있어요.'));
      const label = element('label', 'market-target-label', '거래할 친구');
      label.htmlFor = 'market-target';
      refs.list = element('select', 'market-target');
      refs.list.id = 'market-target';
      refs.request = button('거래걸기', () => {
        const targetId = refs.list.value;
        const current = players().find(person => person.id === targetId);
        if (!current || !inMarket(current) || current.connected === false || active()) return;
        void perform('trade:propose', {targetId}, () => !!active());
      });
      refs.request.id = 'market-request';
      const actions = element('div', 'market-actions'); actions.append(refs.request);
      refs.empty = element('p', 'market-empty', '아직 시장 안에 거래할 친구가 없어요.');
      refs.rows = new Map();
      content.append(label, refs.list, refs.empty, actions);
    }
    const friends = players().filter(player => player.id !== getSelfId() && player.role === 'student'
      && player.connected !== false && inMarket(player));
    const ids = new Set(friends.map(player => player.id));
    for (const [id, row] of refs.rows) if (!ids.has(id)) { row.remove(); refs.rows.delete(id); }
    for (const player of friends) {
      let row = refs.rows.get(player.id);
      if (!row) {
        row = element('option'); row.value = player.id;
        refs.rows.set(player.id, row); refs.list.append(row);
      }
      row.textContent = player.nickname;
    }
    refs.list.disabled = !!action || !friends.length;
    refs.request.disabled = !!action || !friends.length;
    refs.empty.hidden = friends.length > 0;
  }

  function renderProposal(trade) {
    if (newView('proposed:' + trade.id, '✦ 별 시장 · 거래 요청')) {
      refs.description = element('p', 'market-proposal');
      refs.state = element('p', 'market-hint');
      refs.yes = button('예', () => respond(true));
      refs.no = button('아니오', () => respond(false), 'market-secondary');
      refs.cancel = button('거래 취소', cancel, 'market-secondary');
      refs.yes.id = 'market-incoming-accept';
      refs.no.id = 'market-incoming-decline';
      refs.cancel.id = 'market-cancel';
      const actions = element('div', 'market-actions');
      actions.append(refs.yes, refs.no, refs.cancel);
      content.append(refs.description, refs.state, actions);
    }
    const isIncoming = incoming(trade);
    refs.description.textContent = isIncoming ? otherName(trade) + '님이 거래를 걸었어요. 함께 거래할까요?'
      : otherName(trade) + '님의 응답을 기다리고 있어요.';
    refs.state.textContent = action ? '응답을 확인하고 있어요…' : '아직 물건과 재화는 이동하지 않았어요.';
    refs.yes.hidden = refs.no.hidden = !isIncoming;
    refs.cancel.hidden = isIncoming;
    for (const node of [refs.yes, refs.no, refs.cancel]) node.disabled = !!action;
  }

  function currencyInput(key, label, max) {
    const wrapper = element('label', 'market-currency-input', label);
    const input = element('input');
    input.id = 'market-' + key;
    input.type = 'number'; input.min = '0'; input.max = String(max); input.step = '1'; input.inputMode = 'numeric';
    input.dataset.currency = key;
    input.value = String(draft[key]);
    input.addEventListener('input', () => {
      if (action) return;
      dirty = true;
      message('');
      renderNegotiation(active());
    });
    wrapper.append(input);
    return {wrapper, input};
  }
  function readDraft() {
    const shards = refs.shards.value.trim(), energy = refs.energy.value.trim();
    if (!/^\d+$/.test(shards) || !/^\d+$/.test(energy)) return null;
    const result = {shards:Number(shards), energy:Number(energy), items:draft.items.map(entry => ({...entry}))};
    if (!Number.isSafeInteger(result.shards) || result.shards > TRADE.maxShards || !Number.isSafeInteger(result.energy)) return null;
    return result;
  }
  function draftProblem(value) {
    if (!value) return '재화는 0 이상의 정수로 입력해 주세요. 별 파편은 ' + TRADE.maxShards + '개까지 올릴 수 있어요.';
    const player = self();
    if (value.shards > number(player?.starShards) || value.energy > number(player?.cosmicEnergy)) return '가지고 있는 재화보다 많이 올릴 수 없어요.';
    if (value.items.length > TRADE.maxItemKinds) return '아이템은 ' + TRADE.maxItemKinds + '종류까지 올릴 수 있어요.';
    if (value.items.some(entry => !Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 99
      || entry.quantity > number(player?.inventory?.find(item => item.id === entry.id)?.quantity))) return '아이템 수량을 확인해 주세요. 종류마다 보유량 안에서 최대 99개까지 올릴 수 있어요.';
    return '';
  }
  function adjustItem(id, delta) {
    const trade = active();
    if (action || !trade || trade.id !== draftTradeId || trade.status !== 'negotiating') return;
    const entry = draft.items.find(item => item.id === id), quantity = (entry?.quantity || 0) + delta;
    const owned = number(self()?.inventory?.find(item => item.id === id)?.quantity);
    if (quantity < 0 || quantity > Math.min(owned, 99)) return;
    if (!entry && draft.items.length >= TRADE.maxItemKinds) {
      message('한 번에 ' + TRADE.maxItemKinds + '종류까지 올릴 수 있어요.'); return;
    }
    if (entry && quantity === 0) draft.items = draft.items.filter(item => item.id !== id);
    else if (entry) entry.quantity = quantity;
    else if (quantity > 0) draft.items.push({id, quantity});
    dirty = true;
    message('');
    renderNegotiation(trade);
  }
  function saveOffer() {
    const trade = active(), value = readDraft();
    if (!trade || trade.id !== draftTradeId || trade.status !== 'negotiating' || !dirty) return;
    const problem = draftProblem(value);
    if (problem) { message(problem); return; }
    // Capture exactly the visible version; the server rejects concurrent stale edits.
    const id = trade.id, revision = refs.renderedRevision;
    if (trade.revision !== revision) { update(); message('거래 내용이 바뀌었어요. 확인한 뒤 다시 올려 주세요.'); return; }
    void perform('trade:offer', {tradeId:id, revision, offer:value}, () => {
      const current = active();
      return current?.id !== id || current.revision > revision;
    }, () => {
      // Inputs stay frozen until the ack AND a newer authoritative revision arrive.
      if (action) action.savedOffer = value;
    });
  }
  function confirmOffer() {
    const trade = active();
    if (!trade || trade.id !== draftTradeId || trade.status !== 'negotiating' || dirty || action) return;
    const value = readDraft();
    if (!value || draftProblem(value) || offerKey(value) !== offerKey(ownOffer(trade)) || trade.confirmed?.includes(getSelfId())) return;
    if (![trade.give, trade.want].some(side => side?.shards > 0 || side?.energy > 0 || side?.items?.length)) return;
    const id = trade.id, revision = refs.renderedRevision;
    if (trade.revision !== revision) { update(); message('거래 내용이 바뀌었어요. 확인한 뒤 다시 수락해 주세요.'); return; }
    void perform('trade:confirm', {tradeId:id, revision}, () => {
      const current = active();
      return current?.id !== id || current.revision !== revision || current.confirmed?.includes(getSelfId());
    });
  }

  function offerPanel(label, own) {
    const panel = element('section', 'market-offer' + (own ? ' market-own-offer' : ''));
    const heading = element('h3', '', label), name = element('p', 'market-person');
    const currencies = element('p', 'market-currencies');
    const items = element('div', 'market-items');
    const state = element('p', 'market-confirmation');
    panel.append(heading, name, currencies, items, state);
    return {panel, name, currencies, items, state, signature:null};
  }
  function displayOffer(panel, offer, editable) {
    panel.currencies.textContent = '✦ 별 파편 ' + amount(offer.shards) + ' · ◈ 우주에너지 ' + amount(offer.energy);
    const signature = JSON.stringify(offer.items);
    if (panel.signature !== signature) {
      panel.signature = signature;
      panel.items.replaceChildren();
      if (!offer.items.length) panel.items.append(element('p', 'market-empty', '올린 아이템이 없어요.'));
      for (const entry of offer.items) {
        const node = editable ? button('', () => adjustItem(entry.id, -1), 'market-item') : element('div', 'market-item');
        node.dataset.itemId = entry.id;
        itemContent(node, entry.id, entry.quantity);
        if (editable) node.setAttribute('aria-label', itemName(entry.id) + ' ' + entry.quantity + '개, 하나 빼기');
        panel.items.append(node);
      }
    }
    for (const node of panel.items.querySelectorAll('button')) node.disabled = !!action;
  }

  function renderNegotiation(trade) {
    if (!trade || trade.status !== 'negotiating') return;
    if (draftTradeId !== trade.id) {
      draftTradeId = trade.id; draft = offerOf(ownOffer(trade)); dirty = false;
    }
    if (newView('negotiating:' + trade.id, '✦ 별 시장 · 함께 거래하기')) {
      refs.revision = element('p', 'market-hint');
      refs.revision.dataset.marketRevision = '';
      const columns = element('div', 'market-offers');
      refs.own = offerPanel('내가 줄 물건', true);
      refs.other = offerPanel('친구가 줄 물건', false);
      refs.own.panel.id = 'market-own-offer'; refs.other.panel.id = 'market-other-offer';
      columns.append(refs.own.panel, refs.other.panel);
      const editor = element('section', 'market-editor');
      editor.append(element('h3', '', '내 물건 고르기'));
      refs.wallet = element('p', 'market-hint');
      refs.bag = element('div', 'market-bag'); refs.bagRows = new Map();
      refs.bag.id = 'market-inventory';
      refs.bag.setAttribute('aria-label', '내 인벤토리 · 누르면 하나 추가');
      refs.bagEmpty = element('p', 'market-empty', '가방이 비어 있어요.');
      const fields = element('div', 'market-currency-fields');
      const shards = currencyInput('shards', '별 파편', TRADE.maxShards);
      const energy = currencyInput('energy', '우주에너지', Number.MAX_SAFE_INTEGER);
      refs.shards = shards.input; refs.energy = energy.input;
      fields.append(shards.wrapper, energy.wrapper);
      refs.save = button('올리기', saveOffer);
      refs.save.id = 'market-apply';
      refs.discard = button('수정 되돌리기', () => {
        if (action) return;
        dirty = false; draft = offerOf(ownOffer(active())); renderNegotiation(active());
      }, 'market-secondary');
      const editActions = element('div', 'market-actions'); editActions.append(refs.save, refs.discard);
      refs.draftState = element('p', 'market-draft-state'); refs.draftState.setAttribute('role', 'status');
      editor.append(refs.wallet, element('p', 'market-hint', '가방을 누르면 하나 추가, 내 물건을 누르면 하나 빼요. 레벨 제한 없이 5종류 · 종류마다 99개까지!'),
        refs.bag, refs.bagEmpty, fields, editActions, refs.draftState);
      refs.confirm = button('수락', confirmOffer);
      refs.cancel = button('거래 취소', cancel, 'market-secondary');
      refs.confirm.id = 'market-confirm'; refs.cancel.id = 'market-cancel';
      const actions = element('footer', 'market-actions'); actions.append(refs.cancel, refs.confirm);
      content.append(refs.revision, columns, editor,
        element('p', 'market-hint', '올리기를 누르면 양쪽의 수락이 해제돼요. 같은 내용에 두 사람이 모두 수락하면 바로 교환돼요.'), actions);
    }
    // Keep the form and inputs in place across position ticks and counterpart edits.
    if (!dirty && !action) {
      draft = offerOf(ownOffer(trade));
      if (refs.shards.value !== String(draft.shards)) refs.shards.value = String(draft.shards);
      if (refs.energy.value !== String(draft.energy)) refs.energy.value = String(draft.energy);
    }
    refs.revision.textContent = '서로 올린 물건과 재화를 확인해 주세요.';
    refs.renderedRevision = trade.revision;
    refs.revision.dataset.marketRevision = String(trade.revision);
    refs.own.name.textContent = (self()?.nickname || '나') + (dirty ? ' · 수정 중' : '');
    refs.other.name.textContent = otherName(trade);
    const preview = readDraft();
    displayOffer(refs.own, {...draft, shards:preview?.shards ?? draft.shards, energy:preview?.energy ?? draft.energy}, true);
    displayOffer(refs.other, offerOf(otherOffer(trade)), false);
    const confirmed = trade.confirmed || [], mine = confirmed.includes(getSelfId());
    const otherId = trade.fromId === getSelfId() ? trade.toId : trade.fromId;
    refs.own.state.textContent = dirty ? '수정 중 · 아직 올리지 않았어요' : mine ? '✓ 수락했어요' : '수락 전';
    refs.other.state.textContent = confirmed.includes(otherId) ? '✓ 수락했어요' : '수락 전';
    refs.own.state.dataset.confirmed = String(mine && !dirty);
    refs.other.state.dataset.confirmed = String(confirmed.includes(otherId));
    refs.wallet.textContent = '내 보유량 · 별 파편 ' + amount(self()?.starShards) + ' · 우주에너지 ' + amount(self()?.cosmicEnergy);
    const inventory = (self()?.inventory || []).filter(entry => entry.quantity > 0);
    const ids = new Set(inventory.map(entry => entry.id));
    for (const [id, row] of refs.bagRows) if (!ids.has(id)) { row.remove(); refs.bagRows.delete(id); }
    for (const entry of inventory) {
      let row = refs.bagRows.get(entry.id);
      const selected = draft.items.find(item => item.id === entry.id)?.quantity || 0;
      const remaining = Math.max(0, entry.quantity - selected);
      if (!row) {
        row = button('', () => adjustItem(entry.id, 1), 'market-item'); row.dataset.itemId = entry.id;
        refs.bagRows.set(entry.id, row); refs.bag.append(row);
      }
      if (row.dataset.remaining !== String(remaining)) {
        row.dataset.remaining = String(remaining); row.replaceChildren(); itemContent(row, entry.id, remaining);
        row.setAttribute('aria-label', itemName(entry.id) + ' 하나 추가, 남은 ' + remaining + '개');
      }
      row.disabled = !!action || !remaining || selected >= 99 || (!selected && draft.items.length >= TRADE.maxItemKinds);
    }
    refs.bagEmpty.hidden = inventory.length > 0;
    refs.shards.readOnly = refs.energy.readOnly = !!action;
    refs.save.disabled = !!action || !dirty;
    refs.discard.disabled = !!action || !dirty;
    const hasOffer = [trade.give, trade.want].some(side => side?.shards > 0 || side?.energy > 0 || side?.items?.length);
    const problem = draftProblem(preview);
    refs.confirm.disabled = !!action || dirty || mine || !hasOffer || !!problem;
    refs.confirm.textContent = mine ? '수락 완료' : '수락';
    refs.cancel.disabled = !!action;
    refs.draftState.textContent = action ? '서버에서 거래 내용을 확인하고 있어요…'
      : dirty ? '수정한 내용은 아직 친구에게 보이지 않아요. 올리기를 눌러 주세요.'
      : problem || (!hasOffer ? '교환할 아이템이나 재화를 올려 주세요.' : '친구에게 보이는 최신 내용이에요.');
  }

  function historyOffer(side) {
    const value = offerOf(side);
    return '별 파편 ' + amount(value.shards) + ' · 우주에너지 ' + amount(value.energy)
      + (value.items.length ? ' · ' + value.items.map(entry => itemName(entry.id) + ' × ' + amount(entry.quantity)).join(', ') : ' · 아이템 없음');
  }
  function renderHistory() {
    if (newView('history', '✦ 별 시장 · 거래 내역')) {
      content.append(element('p', 'market-hint', '최근 거래 최대 100건을 최신순으로 볼 수 있어요.'));
      refs.refresh = button('새로고침', loadHistory, 'market-secondary');
      refs.refresh.id = 'market-history-refresh';
      refs.status = element('p', 'market-hint'); refs.status.setAttribute('role', 'status');
      refs.list = element('ol', 'market-history'); refs.signature = null;
      refs.list.id = 'market-history';
      content.append(refs.refresh, refs.status, refs.list);
    }
    refs.refresh.disabled = historyBusy;
    refs.status.textContent = historyBusy ? '내역을 불러오는 중이에요…' : historyLoaded ? (historyEntries.length ? historyEntries.length + '건의 거래 내역' : '거래 내역이 없어요.') : '내역을 새로고침해 주세요.';
    const signature = JSON.stringify(historyEntries);
    if (refs.signature === signature) return;
    refs.signature = signature; refs.list.replaceChildren();
    const results = {completed:'교환 완료', failed:'실패', cancelled:'취소', canceled:'취소', declined:'거절',
      expired:'만료', approved:'이전 거래 승인', rejected:'이전 거래 거절', legacyapproved:'이전 거래 승인', legacyrejected:'이전 거래 거절'};
    for (const entry of historyEntries) {
      const row = element('li', 'market-history-entry');
      const names = element('strong', '', (entry.fromNickname || entry.from || '보낸 친구') + ' ↔ ' + (entry.toNickname || entry.to || '받는 친구'));
      const date = new Date(entry.at);
      const result = String(entry.result || entry.status || '기록');
      const detail = element('p', 'market-hint', (Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ko-KR') + ' · ') + (results[result] || result));
      row.append(names, detail, element('p', '', '보낸 쪽 → ' + historyOffer(entry.give)), element('p', '', '받는 쪽 → ' + historyOffer(entry.want)));
      if (entry.reason) row.append(element('p', 'market-hint', entry.reason));
      refs.list.append(row);
    }
  }
  async function loadHistory() {
    if (!eligible() || self()?.role !== 'teacher' || historyBusy) return;
    const ticket = ++historyTicket, epoch = generation, id = getSelfId();
    historyBusy = true; message(''); renderHistory();
    try {
      const reply = await request('trade:history', {});
      if (ticket !== historyTicket || epoch !== generation || id !== getSelfId() || !dialog.open || !eligible() || self()?.role !== 'teacher') return;
      if (reply?.ok === false) throw new Error(reply.error || '내역을 불러오지 못했어요.');
      historyEntries = (reply?.entries || []).slice(0, 100); historyLoaded = true;
    } catch (e) {
      if (ticket === historyTicket && epoch === generation && id === getSelfId()) message(e.message || '내역을 불러오지 못했어요.');
    } finally {
      if (ticket === historyTicket && epoch === generation && id === getSelfId()) {
        historyBusy = false;
        if (dialog.open && eligible() && self()?.role === 'teacher') renderHistory();
      }
    }
  }

  function renderPending(trade) {
    if (!trade || dialog.open) { pending.remove(); return; }
    const host = otherDialog() || document.body;
    if (pending.parentNode !== host) host.append(pending);
    pending.classList.toggle('market-pending-floating', host === document.body);
    pendingText.textContent = incoming(trade) ? otherName(trade) + '님이 거래를 걸었어요. 거래할까요?'
      : trade.status === 'proposed' ? otherName(trade) + '님의 응답을 기다리고 있어요.' : otherName(trade) + '님과 거래 중이에요.';
    pendingYes.hidden = pendingNo.hidden = !incoming(trade);
    for (const node of [pendingOpen, pendingYes, pendingNo]) node.disabled = !!action;
  }
  function update() {
    if (sessionId !== getSelfId()) { reset(); sessionId = getSelfId(); }
    if (!eligible()) {
      // Server cancels trades on its tick. Never send repeated cancel requests on movement updates.
      if (dialog.open || pending.isConnected || action || draft || historyEntries.length) reset();
      return;
    }
    if (self()?.role === 'teacher') {
      pending.remove();
      if (dialog.open) renderHistory();
      return;
    }
    const trade = active();
    // The trade may end or be replaced before its ack. Ignore that ack completely.
    if (action?.tradeId && action.tradeId !== trade?.id) action = null;
    if (action && action.observed()) action.observedOnce = true;
    if (action?.ack && action.observedOnce) {
      if (action.savedOffer && trade?.id === draftTradeId && offerKey(ownOffer(trade)) === offerKey(action.savedOffer)) {
        dirty = false;
      }
      action = null;
    }
    if (trade && incoming(trade) && !announced.has(trade.id)) {
      announced.add(trade.id);
      toast(otherName(trade) + '님이 별 시장 거래를 요청했어요.');
    }
    if (!trade && previousTradeId) {
      if (dialog.open) dialog.close();
      pending.remove();
      draft = null; draftTradeId = null; dirty = false; dismissedId = null;
      viewKey = ''; content.replaceChildren(); message('');
      toast('거래가 종료되었어요. 가방과 재화 잔액을 확인해 주세요.');
    }
    previousTradeId = trade?.id || null;
    if (trade && !dialog.open && dismissedId !== trade.id && !otherDialog()) show();
    if (dialog.open) {
      if (!trade) renderFriends();
      else if (trade.status === 'proposed') renderProposal(trade);
      else renderNegotiation(trade);
    }
    renderPending(trade);
  }
  function open() {
    update();
    if (!eligible()) { toast('별 시장 안에서 이용할 수 있어요.'); return; }
    dismissedId = null;
    show();
    update();
    if (self()?.role === 'teacher') void loadHistory();
  }
  function reset() {
    generation++; historyTicket++;
    action = null; historyBusy = false; historyLoaded = false; historyEntries = [];
    draft = null; draftTradeId = null; dirty = false; previousTradeId = null; dismissedId = null;
    announced.clear();
    if (dialog.open) dialog.close();
    pending.remove(); pendingText.textContent = '';
    content.replaceChildren(); message(''); viewKey = ''; refs = {};
    sessionId = getSelfId();
  }
  return {open, update, reset};
}
