import { LV4_ITEMS } from '../shared/lv4-items.js';

const byId = new Map(LV4_ITEMS.map(item => [item.id, item]));

export function createLv4ItemUI({ request, getPlayer, stop, toast }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'lv4-item-dialog';dialog.id='lv4-item-dialog';
  dialog.setAttribute('aria-label', 'Lv4 아이템');
  document.body.append(dialog);

  let busy = false;
  let generation = 0;
  let closed = true;
  let roster = { players: [], planets: [], cards: [], holding: {}, teacher: false };
  let holdingButtons = [];
  const holdingRequestIds = new Map();

  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const button = (label, handler, className = 'secondary') => {
    const node = el('button', label, className);
    node.type = 'button';
    node.addEventListener('click', handler);
    return node;
  };
  const field = (label, control) => {
    const wrap = el('label', label, 'lv4-field');
    wrap.append(control);
    return wrap;
  };
  const select = (label, values, placeholder) => {
    const node = document.createElement('select');
    node.setAttribute('aria-label', label);
    const first = el('option', placeholder);
    first.value = '';
    node.append(first);
    for (const value of values) {
      const option = el('option', value.label);
      option.value = String(value.value);
      node.append(option);
    }
    return node;
  };
  const textInput = (label, placeholder, maxLength = 80) => {
    const node = document.createElement('input');
    node.type = 'text';
    node.setAttribute('aria-label', label);
    node.placeholder = placeholder;
    node.maxLength = maxLength;
    return node;
  };
  const checkList = (title, values, name) => {
    const group = el('fieldset', undefined, 'lv4-check-group');
    group.append(el('legend', title));
    for (const value of values) {
      const label = el('label', undefined, 'lv4-check-option');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = name;
      input.value = String(value.value);
      label.append(input, el('span', value.label));
      group.append(label);
    }
    return group;
  };
  const checked = name => [...dialog.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
  const appendLines = (parent, heading, lines) => {
    if (!Array.isArray(lines) || !lines.length) return;
    parent.append(el('h3', heading));
    const list = el('ul');
    for (const line of lines) list.append(el('li', String(line)));
    parent.append(list);
  };
  const close = () => {
    if (closed) return;
    closed = true;
    generation++;
    dialog.close();
    stop?.();document.getElementById('world')?.focus();
  };
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
  dialog.addEventListener('close', () => { if (!closed) close(); });

  const submitUse = async (item, extra = {},confirmed=false) => {
    if(!confirmed&&roster?.useFeeText){
      dialog.querySelector('.lv4-eclipse-confirm')?.remove();
      const box=el('div',undefined,'lv4-eclipse-confirm');
      box.append(el('p','현재 개기 일식 상태입니다. 별 1개를 지급 후 사용하시겠습니까?'),
        button('예 · 지급 후 사용',()=>{box.remove();void submitUse(item,extra,true);},'primary'),
        button('아니오',()=>box.remove(),'secondary'));
      dialog.querySelector('.lv4-controls')?.append(box);return;
    }
    if (busy) return;
    busy = true;
    setBusy(true);
    try {
      const reply = await request('item:use', { itemId: item.id, ...extra });
      toast?.(reply?.message || '아이템 사용이 완료됐어요.');
      close();
      window.dispatchEvent(new CustomEvent('player:updated'));
    } catch (error) {
      toast?.(error?.message || '아이템을 사용하지 못했어요. 다시 확인해 주세요.');
    } finally {
      busy = false;
      setBusy(false);
    }
  };

  function setBusy(value) {
    for (const control of dialog.querySelectorAll('button, input, select')) control.disabled = value;
    updateHoldingButtons();
  }
  function updateHoldingButtons(){
    const stacks=Number(roster.holding?.stacks||0);
    for(const entry of holdingButtons)entry.button.disabled=busy||stacks<entry.cost;
  }

  const personOptions = () => roster.players.map(player => ({
    value: player.id,
    label: `${player.nickname || player.id} (Lv${player.level ?? '?'})${player.connected===false?' · 미접속':''}`
  }));

  function buildItem(item, body) {
    const header = el('header', undefined, 'lv4-header');
    const title = el('h2', `${item.name} Lv4`);
    header.append(title, button('닫기', close));
    body.append(header);
    const card = el('section', undefined, 'lv4-card');
    const art = document.createElement('img');
    art.src = item.art;
    art.alt = `${item.name} 카드 그림`;
    art.loading = 'lazy';
    card.append(art, el('p', item.description));
    if(item.special)card.append(el('p',item.special,'lv4-note'));
    body.append(card);
    appendLines(body, '자동 효과', item.automatic);
    appendLines(body, '선생님 확인', item.manual);
    if (typeof roster.useFeeText === 'string' && roster.useFeeText.trim()) {
      body.append(el('p', roster.useFeeText, 'lv4-use-fee'));
    }
  }

  function buildUseControls(item, body) {
    const form = el('section', undefined, 'lv4-controls');
    if (item.id === 'solar-system-card') {
      const inputs=Array.from({length:7},(_,i)=>{const node=select((i+1)+'번째 친구',personOptions().filter(p=>p.value!==getPlayer?.()?.id),'친구 선택');form.append(field((i+1)+'번째 친구',node));return node;});
      form.append(el('p','선택한 1~7번 순서대로 급식 순서를 영구 변경해요. 일곱 친구에게 소행성 아이템을 각각 1개씩 지급합니다.','lv4-note'));
      form.append(button('태양계 사용',()=>{const targetIds=inputs.map(n=>n.value);if(targetIds.some(id=>!id)||new Set(targetIds).size!==7){toast('서로 다른 친구 7명을 선택해 주세요.');return;}void submitUse(item,{targetIds});},'primary'));
    } else if (item.id === 'black-hole-card') {
      const planets = checkList('검은별을 정리할 부서 행성 정확히 3개 선택', (roster.planets || []).map(p => ({ value: p.id, label: p.name })), 'lv4-planet');
      form.append(planets);
      const confirmation=el('div',undefined,'lv4-confirm'),summaryText=el('p');
      let pendingPlanetIds=[];
      confirmation.hidden=true;
      confirmation.append(summaryText,button('확인하고 사용',()=>void submitUse(item,{planetIds:pendingPlanetIds}),'primary'),button('취소',()=>{confirmation.hidden=true;}));
      planets.addEventListener('change',()=>{confirmation.hidden=true;});
      const readyAt=Number(roster.blackHoleReadyAt||0);
      if(readyAt>Date.now())form.append(el('p',`다시 사용 가능: ${new Date(readyAt).toLocaleString('ko-KR')}`,'lv4-note'));
      const previewButton=button('비용 미리보기', async () => {
        if (busy) return;
        const planetIds = checked('lv4-planet');
        if (planetIds.length !== 3 || new Set(planetIds).size !== 3) { toast?.('서로 다른 행성 3개를 선택해 주세요.'); return; }
        busy = true; setBusy(true);
        try {
          const preview = await request('lv4:black-hole:preview', { planetIds });
          if (!dialog.open) return;
          const costs = Array.isArray(preview?.costs) ? preview.costs : [];
          const breakdown = costs.map(row => `${row.nickname || row.playerId || '대상'}: 별 파편 ${row.amount}개`).join('\n');
          const total = Number(preview?.total);
          const summary = `${breakdown ? `${breakdown}\n` : ''}합계: 별 파편 ${Number.isFinite(total) ? total : '확인되지 않은'}개를 사용자에게 옮겨요.\n선택한 세 부서의 모든 경고와 검은별을 해제하고, 2주 동안 다시 사용할 수 없어요. 계속할까요?`;
          pendingPlanetIds=planetIds;summaryText.textContent=summary;confirmation.hidden=false;
        } catch (error) { toast?.(error?.message || '비용을 확인하지 못했어요.'); }
        finally { busy = false; setBusy(false); }
      });
      previewButton.disabled=readyAt>Date.now();form.append(previewButton,confirmation);
    } else if (item.id === 'total-eclipse-card') {
      form.append(el('p', '같은 교실의 학생 모두에게 1주일 개기 일식 상태를 걸어요. 아이템을 사용할 때마다 사용자에게 별 파편 1개를 지급해요.', 'lv4-use-fee'));
      form.append(button('개기 일식 사용', () => void submitUse(item), 'primary'));
    } else if (item.id === 'supercluster-card') {
      const card1 = select('첫 번째 금별 카드', (roster.cards || []).map(c => ({ value: c.id, label: c.name })), '카드 선택');
      const card2 = select('두 번째 금별 카드', (roster.cards || []).map(c => ({ value: c.id, label: c.name })), '카드 선택');
      form.append(field('보상 카드 1', card1), field('보상 카드 2', card2));
      form.append(button('보유 효과 사용', () => void openHolding(), 'secondary'));
      form.append(button('초은하단 사용', () => {
        if (!card1.value || !card2.value) { toast?.('금별 카드 두 장을 선택해 주세요.'); return; }
        void submitUse(item, { cardIds: [card1.value, card2.value] });
      }, 'primary'));
    } else if (item.id === 'nebula-card') {
      const friends=Array.from({length:3},(_,i)=>{
        const label=`${i+1}번째 친구`,input=select(label,personOptions().filter(p=>p.value!==getPlayer?.()?.id),'친구 선택');
        form.append(field(label,input));return input;
      });
      form.append(el('p','나를 포함한 네 명의 교실 자리를 영구 변경해요. 서로 완전히 떨어진 자리로 배치하지 않도록 선생님이 확인해요.','lv4-note'));
      form.append(button('성운 사용',()=>{
        const targetIds=friends.map(input=>input.value);
        if(targetIds.some(id=>!id)||new Set(targetIds).size!==3){toast?.('서로 다른 친구 3명을 선택해 주세요.');return;}
        void submitUse(item,{targetIds});
      },'primary'));
    } else if (item.id === 'betelgeuse-card') {
      form.append(el('p','탐사권 3장을 받아요. 오늘 우주 탐사 장치에서 모은 기운 1당 급식 우선권 1주가 기록돼요.','lv4-note'));
      form.append(button('탐사권 3장 받기',()=>void submitUse(item),'primary'));
    } else if (item.id === 'alien-queen-card') {
      const status = el('p', '일기·독서 기록 제출을 확인한 뒤 선생님이 별 파편을 지급해요.', 'lv4-note');
      form.append(status,button('면제 효과 사용',()=>void submitUse(item),'primary'));
    } else {
      form.append(button('사용', () => void submitUse(item), 'primary'));
    }
    body.append(form);
  }

  async function open(itemArg) {
    const item = typeof itemArg === 'string' ? byId.get(itemArg) : (itemArg?.id ? byId.get(itemArg.id) || itemArg : null);
    if (!item) { toast?.('Lv4 아이템 정보를 찾지 못했어요.'); return; }
    const token = ++generation;
    closed = false;
    try{roster = await request('lv4:info', { itemId: item.id });}catch(e){toast(e.message);closed=true;return;}
    if (token !== generation || closed) return;
    dialog.replaceChildren();
    const body = el('div', undefined, 'lv4-body');
    buildItem(item, body);
    buildUseControls(item, body);
    dialog.append(body);
    stop?.();if (!dialog.open) dialog.showModal();
  }

  async function openHolding() {
    const token = ++generation;
    closed = false;
    let info;
    try { info = await request('lv4:info', {}); }
    catch (error) { closed = true; toast?.(error?.message || '보유 효과 정보를 불러오지 못했어요.'); return; }
    if (token !== generation || closed) return;
    roster = { ...roster, ...info, holding: info?.holding || { stacks: 0, nextAt: null } };
    dialog.replaceChildren();
    holdingButtons = [];
    const body = el('div', undefined, 'lv4-body lv4-holding');
    const header = el('header', undefined, 'lv4-header');
    header.append(el('h2', '초은하단 보유 효과'), button('닫기', close));
    body.append(header);
    if (typeof roster.useFeeText === 'string' && roster.useFeeText.trim()) body.append(el('p', roster.useFeeText, 'lv4-use-fee'));
    const status = el('section', undefined, 'lv4-controls');
    const updateStatus = () => {
      const stacks = Number(roster.holding?.stacks || 0);
      status.querySelector('.lv4-holding-count').textContent = `은하수의 기운: ${stacks}`;
      const nextAt = roster.holding?.nextAt;
      status.querySelector('.lv4-holding-date').textContent = nextAt != null ? `다음 적립: ${new Date(nextAt).toLocaleString('ko-KR')}` : '다음 적립일이 아직 없어요.';
      updateHoldingButtons();
    };
    status.append(el('p', '', 'lv4-holding-count'), el('p', '', 'lv4-holding-date'));
    const redeem = (reward, cost) => {
      const control = button(reward === 'shards' ? '기운 1 → 별 파편 4개' : '기운 2 → 별 카드 1장', async () => {
        if (busy || Number(roster.holding?.stacks || 0) < cost) return;
        let requestId = holdingRequestIds.get(reward);
        if (!requestId) { requestId = crypto.randomUUID(); holdingRequestIds.set(reward, requestId); }
        busy = true; setBusy(true);
        try {
          const result = await request('lv4:holding:use', { reward, requestId });
          roster.holding = result?.holding || roster.holding;
          holdingRequestIds.delete(reward);
          updateStatus();
          toast?.(result?.message || '보유 효과를 사용했어요.');
          window.dispatchEvent(new CustomEvent('player:updated'));
        } catch (error) {
          toast?.(error?.message || '보유 효과를 사용하지 못했어요. 다시 시도해 주세요.');
        } finally {
          busy = false; setBusy(false); updateStatus();
        }
      }, 'primary');
      holdingButtons.push({ button: control, cost });
      status.append(control);
    };
    redeem('shards', 1);
    redeem('card', 2);
    updateStatus();
    body.append(status);
    dialog.append(body);
    stop?.();
    if (!dialog.open) dialog.showModal();
  }
  async function openTeacher() {
    const token = ++generation;
    closed = false;
    let data;
    try { data = await request('lv4:teacher:info', {}); }
    catch (error) { closed = true; toast?.(error?.message || '선생님 확인 자료를 불러오지 못했어요.'); return; }
    if (token !== generation || closed) return;
    renderTeacher(data || {});
    if (!dialog.open) dialog.showModal();
  }

  function renderTeacher(data) {
    dialog.replaceChildren();
    const body = el('div', undefined, 'lv4-body lv4-teacher');
    const header = el('header', undefined, 'lv4-header');
    header.append(el('h2', 'Lv4 선생님 확인'), button('닫기', close));
    body.append(header);
    const students = (data.students || []).map(student => ({ value: student.id, label: student.nickname || student.id }));
    const owners = (data.owners || []).map(owner => ({ value: owner.id, label: owner.nickname || owner.id }));
    for (const record of data.records || []) {
      const row = el('section', undefined, 'lv4-teacher-row');row.dataset.markerId=record.id;
      const item = byId.get(record.itemId);
      row.append(el('h3', `${record.nickname || record.playerId} · ${record.name || item?.name || record.itemId}`));
      row.append(el('p', record.note || `남은 확인 횟수: ${record.remainingUses ?? '—'} · 종료: ${record.until || '—'}`));
      if (record.itemId === 'black-hole-card' || record.itemId === 'total-eclipse-card' || record.action === 'standard') {
        row.append(button('실제 처리 확인 후 효과 종료', async () => {
          await teacherAction(row, () => request('lv4:teacher:end', { targetId: record.playerId, markerId: record.id }));
        }, 'primary'));
      } else if(record.itemId==='solar-system-card'){
        if(Array.isArray(record.lunchOrderIds)){
          const names=record.lunchOrderIds.map((id,index)=>`${index+1}. ${students.find(student=>student.value===id)?.label||'퇴장한 친구'}`);
          row.append(el('p',`급식 순서: ${names.join(' → ')}`));
          if(!record.lunchOrderConfirmed){
            const reference=textInput('실제 급식 순서 변경 확인 기록','예: 10/3 급식 순서 변경');
            row.append(field('확인 메모',reference));
            row.append(button('실제 급식 순서 확인',async()=>{
              if(!reference.value.trim()){toast?.('확인 메모를 입력해 주세요.');return;}
              await teacherAction(row,()=>request('lv4:teacher:confirm',{action:'solar-lunch-order',playerId:record.playerId,markerId:record.id,reference:reference.value.trim()}));
            },'primary'));
          }
        }else row.append(el('p','이전 태양계 효과 기록입니다. 새 급식 순서 변경에는 다시 사용해야 해요.'));
        row.append(button('효과 종료',()=>teacherAction(row,()=>request('lv4:teacher:end',{targetId:record.playerId,markerId:record.id}))));
      } else if (record.itemId === 'nebula-card') {
        if(Array.isArray(record.seatTargetIds)){
          const names=record.seatTargetIds.map(id=>students.find(student=>student.value===id)?.label||'퇴장한 친구');
          row.append(el('p',`참여 학생: ${record.nickname} · ${names.join(' · ')}`));
          if(!record.seatingConfirmed){
            const together=document.createElement('input');together.type='checkbox';together.setAttribute('aria-label','네 명이 완전히 떨어진 자리가 아님을 확인');
            const reference=textInput('실제 자리 변경 확인 기록','예: 10/3 자리 변경 확인');
            row.append(field('네 명이 완전히 떨어진 자리가 아님을 확인',together),field('확인 메모',reference));
            row.append(button('실제 자리 변경 확인',async()=>{
              if(!together.checked||!reference.value.trim()){toast?.('자리 배치와 확인 메모를 입력해 주세요.');return;}
              await teacherAction(row,()=>request('lv4:teacher:confirm',{action:'nebula-seating',playerId:record.playerId,markerId:record.id,notSeparated:true,reference:reference.value.trim()}));
            },'primary'));
          }
        }else row.append(el('p','이전 성운 효과 기록입니다. 새 자리 변경에는 다시 사용해야 해요.'));
      } else if (record.itemId === 'betelgeuse-card') {
        row.append(el('p','이전 베텔기우스 탐험 기록입니다. 새 우주 탐사권 효과에는 사용되지 않아요.'));
      } else {
        row.append(button('실제 처리 확인 후 효과 종료', async () => {
          await teacherAction(row, () => request('lv4:teacher:end', { targetId: record.playerId, markerId: record.id }));
        }, 'primary'));
      }
      if(['nebula-card','betelgeuse-card'].includes(record.itemId))row.append(button('효과 종료',()=>teacherAction(row,()=>request('lv4:teacher:end',{targetId:record.playerId,markerId:record.id}))));
      body.append(row);
    }
    if (!(data.records || []).length) body.append(el('p', '확인할 아이템이 없어요.'));
    if ((data.owners || []).length) {
      const section = el('section', undefined, 'lv4-teacher-row');
      section.append(el('h3', '에일리언 퀸 · 일기/독서 기록 확인'));
      const owner = select('에일리언 퀸 보유자', owners, '보유자 선택');
      const reference = textInput('제출 확인 기록', '예: 9/25 일기 제출 확인');
      section.append(field('퀸 보유자', owner), field('제출 확인 기록', reference));
      section.append(button('작성 확인 · 별 파편 1개 지급', async () => {
        if (!owner.value || !reference.value.trim()) { toast?.('보유자와 실제 제출 확인 기록을 입력해 주세요.'); return; }
        await teacherAction(section, () => request('lv4:teacher:confirm', { action: 'queen-writing', playerId: owner.value, reference: reference.value.trim() }));
      }, 'primary'));
      body.append(section);
    }
    dialog.append(body);
  }

  async function teacherAction(row, operation) {
    if (busy) return;
    busy = true; setBusy(true);
    try {
      const result = await operation();
      toast?.(result?.message || '확인 결과를 저장했어요.');
      const data = await request('lv4:teacher:info', {});
      if (!closed && dialog.open) renderTeacher(data || {});
      window.dispatchEvent(new CustomEvent('player:updated'));
    } catch (error) { toast?.(error?.message || '확인 내용을 저장하지 못했어요.'); }
    finally { busy = false; setBusy(false); }
  }

  function reset() {
    generation++;
    busy = false;
    holdingButtons=[];holdingRequestIds.clear();
    if (dialog.open) dialog.close();
    dialog.replaceChildren();
    closed = true;
    stop?.();
  }

  return { open, openHolding, openTeacher, reset };
}
