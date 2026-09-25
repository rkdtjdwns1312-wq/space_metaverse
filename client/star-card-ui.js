function text(value) {
  return value == null ? '' : String(value);
}

function paragraphList(values) {
  if (Array.isArray(values)) return values.flatMap(value => paragraphList(value));
  return text(values).split(/\r?\n/).map(value => value.trim()).filter(Boolean);
}

export function createStarCardUI({ request, stop, toast, getRoom, getSelfId }) {
  const dialog = document.createElement('dialog');
  dialog.id = 'star-card-dialog';
  dialog.className = 'star-card-dialog';
  dialog.setAttribute('aria-labelledby', 'star-card-title');

  const title = document.createElement('h2');
  title.id = 'star-card-title';
  title.textContent = '별카드';
  const face = document.createElement('div');
  face.className = 'star-card-face';
  face.setAttribute('role', 'document');
  const name = document.createElement('h3');
  name.className = 'star-card-name';
  const usedBy = document.createElement('p');
  usedBy.className = 'star-card-used-by';
  const expiry = document.createElement('p');
  expiry.className = 'star-card-expiry';
  const description = document.createElement('div');
  description.className = 'star-card-description';
  const effect = document.createElement('div');
  effect.className = 'star-card-effect';
  const messages = document.createElement('div');
  messages.className = 'star-card-messages';
  const manualNote = document.createElement('p');
  manualNote.className = 'star-card-manual-note';
  const choicePanel = document.createElement('section');
  choicePanel.className = 'star-card-choice';
  choicePanel.hidden = true;
  const choiceTitle = document.createElement('h4');
  choiceTitle.textContent = '황도12궁 카드 효과 선택';
  const choiceIntro = document.createElement('p');
  choiceIntro.className = 'star-card-choice-intro';
  const choiceActions = document.createElement('div');
  choiceActions.className = 'star-card-choice-actions';
  const xpChoice = document.createElement('button');
  xpChoice.type = 'button'; xpChoice.className = 'primary'; xpChoice.textContent = '경험치 받기 (주사위×3, 최대 10)';
  const constellationChoice = document.createElement('button');
  constellationChoice.type = 'button'; constellationChoice.className = 'secondary'; constellationChoice.textContent = '별자리 변경';
  choiceActions.append(xpChoice, constellationChoice);
  const optionsGrid = document.createElement('div');
  optionsGrid.className = 'star-card-constellation-options';
  const choiceConfirm = document.createElement('div');
  choiceConfirm.className = 'star-card-choice-confirm';
  choiceConfirm.hidden = true;
  const choiceSummary = document.createElement('p');
  const choiceYes = document.createElement('button');
  choiceYes.type = 'button'; choiceYes.className = 'primary'; choiceYes.textContent = '선택 확정';
  const choiceCancel = document.createElement('button');
  choiceCancel.type = 'button'; choiceCancel.className = 'secondary'; choiceCancel.textContent = '취소';
  choiceConfirm.append(choiceSummary, choiceYes, choiceCancel);
  choicePanel.append(choiceTitle, choiceIntro, choiceActions, optionsGrid, choiceConfirm);
  const error = document.createElement('p');
  error.className = 'star-card-error';
  error.setAttribute('role', 'alert');
  const removeConfirm = document.createElement('div');
  removeConfirm.className = 'star-card-remove-confirm';
  removeConfirm.hidden = true;
  const removeQuestion = document.createElement('p');
  removeQuestion.textContent = '이 활성 별카드를 종료할까요?';
  const removeYes = document.createElement('button');
  removeYes.type = 'button'; removeYes.className = 'danger'; removeYes.textContent = '종료하기';
  const removeNo = document.createElement('button');
  removeNo.type = 'button'; removeNo.className = 'secondary'; removeNo.textContent = '취소';
  removeConfirm.append(removeQuestion, removeYes, removeNo);
  const actions = document.createElement('div');
  actions.className = 'dialog-actions';
  const remove = document.createElement('button');
  remove.type = 'button'; remove.className = 'danger star-card-remove'; remove.textContent = '선생님 확인 후 종료'; remove.hidden = true;
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'secondary'; close.textContent = '닫기';
  actions.append(remove, close);
  face.append(name, usedBy, expiry, description, effect, messages, manualNote, choicePanel);
  dialog.append(title, face, error, removeConfirm, actions);
  document.body.append(dialog);

  let cardId = null;
  let previousFocus = null;
  let currentResult = null;
  let ticker = null;
  let pendingChoice = null;
  let choosing = false;
  let choiceVersion = 0;
  let observedAutomationChoice;

  function remaining(card) {
    const value = card?.remainingMs ?? card?.remaining ?? card?.expiresInMs;
    if (Number.isFinite(Number(value))) return Math.max(0, Math.ceil(Number(value) / 1000));
    const until = card?.expiresAt ?? card?.expiresAtMs ?? card?.expiry;
    if (until != null) return Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000));
    return null;
  }

  function remainingLabel(seconds) {
    if (seconds == null) return '선생님 확인 후 종료';
    if (seconds <= 0) return '만료됨';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days) return `남은 시간 ${days}일 ${hours}시간`;
    if (hours) return `남은 시간 ${hours}시간 ${minutes}분`;
    return `남은 시간 ${Math.max(1, minutes)}분`;
  }

  function render(id, result) {
    currentResult = result;
    const card = result?.card ?? result?.activeentry ?? result?.activeEntry ?? result ?? {};
    const definition = result?.definition ?? card.definition ?? {};
    cardId = id ?? card.id ?? card.cardId ?? null;
    name.textContent = text(definition.name ?? card.name ?? '별카드');
    const nickname = card.nickname ?? card.usedByNickname ?? card.userNickname ?? card.ownerNickname;
    const self = getRoom?.()?.players?.find(player => player.id === getSelfId?.());
    usedBy.textContent = nickname ? `${nickname}이 사용` : (self?.nickname ? `${self.nickname}이 사용` : '사용자 확인 중');
    const seconds = remaining(card);
    expiry.textContent = remainingLabel(seconds);
    description.replaceChildren();
    paragraphList(definition.description ?? card.description).forEach(value => { const p = document.createElement('p'); p.textContent = value; description.append(p); });
    effect.replaceChildren();
    paragraphList(definition.effect ?? card.effect).forEach(value => { const p = document.createElement('p'); p.textContent = value; effect.append(p); });
    messages.replaceChildren();
    paragraphList(card.data?.messages ?? card.messages).forEach(value => { const p = document.createElement('p'); p.textContent = value; messages.append(p); });
    manualNote.textContent = text(card.manualNote ?? card.data?.manualNote);
    manualNote.hidden = !manualNote.textContent;
    renderChoice(result);
    error.textContent = '';
    remove.hidden = result?.canRemove !== true;
    removeConfirm.hidden = true;
  }

  function renderChoice(result) {
    choiceVersion += 1;
    const card = result?.card ?? {};
    const automation = card.data?.automation;
    observedAutomationChoice = automation?.version === 1 ? automation.choice : undefined;
    choicePanel.hidden = result?.canChoose !== true || (automation?.version === 1 && automation.choice != null);
    choiceIntro.textContent = '효과는 한 번만 선택할 수 있어요. 먼저 원하는 효과를 고른 뒤 확인해 주세요.';
    choiceActions.hidden = false;
    optionsGrid.hidden = true;
    optionsGrid.replaceChildren();
    choiceConfirm.hidden = true;
    pendingChoice = null;
    choosing = false;
    xpChoice.disabled = false;
    constellationChoice.disabled = false;
    choiceYes.disabled = false;
    choiceCancel.disabled = false;
    if (choicePanel.hidden) return;
    const options = Array.isArray(result?.options) ? result.options : [];
    constellationChoice.disabled = options.length === 0;
    if (!options.length) choiceIntro.textContent = '레벨 1에서는 별자리 변경을 할 수 없어요. 경험치 받기는 선택할 수 있어요.';
    xpChoice.onclick = () => beginChoice({ choice: 'xp', label: '경험치 받기 (주사위×3, 최대 10)' });
    constellationChoice.onclick = () => {
      if (!options.length) return;
      optionsGrid.replaceChildren();
      choiceActions.hidden = true;
      choiceIntro.textContent = '변경할 별자리를 선택해 주세요.';
      optionsGrid.hidden = false;
      options.slice(0, 16).forEach(option => {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'secondary';
        button.textContent = text(option.name ?? option.id);
        button.onclick = () => beginChoice({ choice: 'constellation', constellationId: option.id, label: text(option.name ?? option.id) });
        optionsGrid.append(button);
      });
      const cancelGrid = document.createElement('button');
      cancelGrid.type = 'button'; cancelGrid.className = 'secondary'; cancelGrid.textContent = '돌아가기';
      cancelGrid.onclick = () => { optionsGrid.hidden = true; choiceActions.hidden = false; choiceIntro.textContent = '효과는 한 번만 선택할 수 있어요. 먼저 원하는 효과를 고른 뒤 확인해 주세요.'; };
      optionsGrid.append(cancelGrid);
    };
  }

  function beginChoice(choice) {
    pendingChoice = choice;
    choiceSummary.textContent = `“${choice.label}” 효과를 선택할까요?`;
    choiceActions.hidden = true;
    optionsGrid.hidden = true;
    choiceIntro.textContent = '';
    choiceConfirm.hidden = false;
  }

  function setChoiceBusy(busy) {
    choosing = busy;
    xpChoice.disabled = busy;
    constellationChoice.disabled = busy || !currentResult?.options?.length;
    choiceYes.disabled = busy;
    optionsGrid.querySelectorAll('button').forEach(button => { button.disabled = busy; });
    choiceCancel.disabled = busy;
  }

  function show(id, result) {
    previousFocus = document.activeElement;
    render(id, result);
    stop?.();
    if (!dialog.open) dialog.showModal();
    startTicker();
    close.focus();
  }

  function roomCard() {
    const room = getRoom?.();
    if (!Array.isArray(room?.starCards)) return undefined;
    return room.starCards.find(card => card.id === cardId) || null;
  }

  function update() {
    if (!dialog.open || !currentResult) return;
    const latest = roomCard();
    if (latest === null) {
      dialog.close(); return;
    }
    if (latest) {
      const latestChoice = latest.data?.automation?.version === 1 ? latest.data.automation.choice : undefined;
      const changed = latestChoice !== observedAutomationChoice;
      currentResult.card = latest;
      if (changed && !choosing) renderChoice(currentResult);
    }
    const seconds = remaining(currentResult.card);
    expiry.textContent = remainingLabel(seconds);
    if (seconds != null && seconds <= 0) dialog.close();
  }

  function startTicker() {
    if (ticker) return;
    ticker = setInterval(update, 1000);
  }

  function stopTicker() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }

  async function open(id) {
    try { show(id, await request('star-card:read', { id })); }
    catch (errorValue) { toast?.(errorValue.message); }
  }

  function finishClose() {
    if (previousFocus?.focus) previousFocus.focus();
    else document.getElementById('world')?.focus();
    previousFocus = null;
  }

  close.onclick = () => dialog.close();
  dialog.addEventListener('close', () => { stopTicker(); finishClose(); });
  remove.onclick = () => { removeConfirm.hidden = false; removeYes.focus(); };
  removeNo.onclick = () => { removeConfirm.hidden = true; remove.focus(); };
  removeYes.onclick = async () => {
    if (!cardId) return;
    removeYes.disabled = true;
    try { await request('star-card:remove', { id: cardId }); dialog.close(); toast?.('별카드를 종료했어요.'); }
    catch (errorValue) { error.textContent = errorValue.message; }
    finally { removeYes.disabled = false; }
  };
  choiceCancel.onclick = () => {
    if (choosing) return;
    choiceConfirm.hidden = true;
    pendingChoice = null;
    choiceIntro.textContent = '효과는 한 번만 선택할 수 있어요. 먼저 원하는 효과를 고른 뒤 확인해 주세요.';
    choiceActions.hidden = false;
    optionsGrid.hidden = true;
  };
  choiceYes.onclick = async () => {
    if (!cardId || !pendingChoice || choosing) return;
    const submitted = pendingChoice;
    const version = choiceVersion;
    setChoiceBusy(true);
    error.textContent = '';
    try {
      const payload = { id: cardId, choice: submitted.choice };
      if (submitted.choice === 'constellation') payload.constellationId = submitted.constellationId;
      const result = await request('star-card:choose', payload);
      if (version !== choiceVersion || !dialog.open) return;
      render(cardId, result);
      toast?.(submitted.choice === 'xp' ? '경험치 효과를 선택했어요.' : '별자리 변경 효과를 선택했어요.');
    } catch (errorValue) {
      if (version !== choiceVersion || !dialog.open) return;
      error.textContent = text(errorValue?.message || '효과 선택에 실패했어요. 다시 시도해 주세요.');
      choiceConfirm.hidden = false;
      setChoiceBusy(false);
    }
  };
  return { open, show, update, reveal: result => show(result?.card?.id ?? result?.id ?? null, result) };
}
