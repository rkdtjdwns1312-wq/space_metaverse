// 각 캐릭터의 [E, 보조1, 보조2, 보조3] 아이콘 URL. 원화가 정해지면 빈 문자열만 채웁니다.
// 이 설정은 그림만 바꾸며 실제 스킬이나 해금 레벨을 추가하지 않습니다.
import {SAGITTARIUS_SKILLS,isSagittarius} from '/shared/sagittarius-skills.js';
export const CHARACTER_SKILL_ICON_URLS = Object.freeze({
  gemini: ['', '', '', ''],
  corvus: ['', '', '', ''],
  aquarius: ['', '', '', ''],
  capricorn: ['', '', '', ''],
  taurus: ['', '', '', ''],
  hercules: ['', '', '', ''],
  libra: ['', '', '', ''],
  cetus: ['', '', '', ''],
  leo: ['', '', '', ''],
  ophiuchus: ['', '', '', ''],
  sagittarius: SAGITTARIUS_SKILLS.map(skill=>skill.iconUrl),
  'corona-borealis': ['', '', '', ''],
  cancer: ['', '', '', ''],
  cygnus: ['', '', '', ''],
  aries: ['', '', '', ''],
  pisces: ['', '', '', ''],
});

export function canUseSpecialSkill(player) {
  return !!player && (player.role === 'teacher' || Number(player.avatar?.level || 1) >= 2);
}

// 기존 Q/E 조작 모듈의 키보드·터치 요청 모두 동일한 경계에서 확인합니다.
export function createSkillGatedRequest({ getPlayer, request }) {
  return async (event, payload) => {
    if (event === 'combat:skill' && !canUseSpecialSkill(getPlayer())) {
      throw new Error('특수 공격은 LV2부터 사용할 수 있어요.');
    }
    return request(event, payload);
  };
}

function setSlotIcon(button, url = '') {
  const image = button.querySelector('.combat-slot-icon img');
  const placeholder = button.querySelector('.combat-slot-placeholder');
  if (!image || !placeholder || button.dataset.iconUrl === url) return;
  button.dataset.iconUrl = url;
  image.hidden = true;
  placeholder.hidden = false;
  image.onload = () => { image.hidden = false; placeholder.hidden = true; };
  image.onerror = () => { image.hidden = true; placeholder.hidden = false; };
  if (url) image.src = url;
  else { image.onload = null; image.removeAttribute('src'); }
}

export function createAuxiliarySkills({ getPlayer, canAct, toast, castSkill, iconUrls = CHARACTER_SKILL_ICON_URLS }) {
  const controls = document.querySelector('.combat-buttons');
  const skill = document.getElementById('touch-skill');
  if (!controls || !skill) return { update() {}, reset() {} };

  const group = document.createElement('div');
  group.className = 'auxiliary-skills';
  group.setAttribute('aria-label', '보조 스킬');
  controls.append(group);
  let count = 0;
  const heldNumberKeys = new Set();

  function skillIndexForCode(code) {
    const match = /^(?:Digit|Numpad)([1-3])$/.exec(code);
    return match ? Number(match[1]) - 1 : -1;
  }

  function keyboardTargetBlocksSkill(target) {
    return !target || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) ||
      target.isContentEditable;
  }

  window.addEventListener('keydown', event => {
    const index = skillIndexForCode(event.code);
    if (index < 0 || event.ctrlKey || event.metaKey || event.altKey ||
        document.querySelector('dialog:modal') || keyboardTargetBlocksSkill(event.target) || !canAct()) return;
    const button = group.children[index];
    if (!button) return;
    event.preventDefault();
    if (event.repeat || heldNumberKeys.has(event.code)) return;
    heldNumberKeys.add(event.code);
    button.click();
  });
  window.addEventListener('keyup', event => {
    if (skillIndexForCode(event.code) >= 0) heldNumberKeys.delete(event.code);
  });
  window.addEventListener('blur', () => heldNumberKeys.clear());

  function levelOf(player) {
    return player?.role === 'teacher' ? 6 : (player?.avatar?.level || 1);
  }

  function layout() {
    if (!count || group.hidden) return;
    const parentRect = controls.getBoundingClientRect();
    const skillRect = skill.getBoundingClientRect();
    const small = matchMedia('(max-width: 520px)').matches;
    const size = parseFloat(getComputedStyle(group).getPropertyValue('--aux-size')) || (small ? 30 : 36);
    const w = skillRect.width;
    const h = skillRect.height;
    const centerX = skillRect.left - parentRect.left + w / 2;
    const centerY = skillRect.top - parentRect.top + h / 2;
    const vitals = document.getElementById('vitals-hud')?.getBoundingClientRect();
    const rightmostX = skillRect.right + (small ? 1.08 : 1.25) * w;
    const auxTop = skillRect.top - (small ? 1.05 : 1.0) * h;
    const rightWouldOverlapVitals = vitals && rightmostX + size / 2 >= vitals.left &&
      skillRect.right <= vitals.right && auxTop < vitals.bottom && auxTop + size >= vitals.top;
    const above = small || rightWouldOverlapVitals;
    const points = above
      ? [[-.68, -.94], [0, -1.18], [.68, -.94]]
      : [[0, -.94], [.72, -.72], [1.02, 0]];
    [...group.children].forEach((button, index) => {
      const [x, y] = points[index];
      button.style.left = `${centerX + x * w}px`;
      button.style.top = `${centerY + y * h}px`;
    });
  }

  function update() {
    const player = getPlayer();
    const unlocked = canUseSpecialSkill(player);
    skill.disabled = !unlocked;
    skill.classList.toggle('is-locked', !unlocked);
    skill.setAttribute('aria-disabled', String(!unlocked));
    skill.setAttribute('aria-label', unlocked ? '특수 공격(E)' : '특수 공격(E), LV2부터 해금');
    skill.title = unlocked ? '특수 공격 (E)' : 'LV2부터 특수 공격을 사용할 수 있어요';
    if(unlocked&&isSagittarius(player)){skill.title='빛의 화살 (E)';skill.setAttribute('aria-label',skill.title);}
    const lock = skill.querySelector('.combat-slot-lock');
    if (lock) lock.hidden = unlocked;
    const urls = iconUrls[player?.avatar?.constellationId] || [];
    setSlotIcon(skill, unlocked ? urls[0] || '' : '');
    const wanted = player ? Math.max(0, Math.min(3, levelOf(player) - 2)) : 0;
    if (wanted !== count) {
      count = wanted;
      group.replaceChildren();
      group.hidden = count === 0;
      for (let index = 1; index <= count; index += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'auxiliary-skill';
        button.dataset.skillSlot = `auxiliary-${index}`;
        button.innerHTML = '<span class="combat-slot-icon" aria-hidden="true"><span class="combat-slot-placeholder">✧</span><img alt="" decoding="async" hidden></span>' +
          `<span class="combat-key-badge" aria-hidden="true">${index}</span>`;
        button.setAttribute('aria-label', `보조 스킬 ${index} (준비 중)`);
        button.addEventListener('click', () => {
          if (canAct()) {if(castSkill)castSkill(index);else toast('보조 스킬은 준비 중이에요.');}
        });
        group.append(button);
      }
    }
    [...group.children].forEach((button, index) => {
      setSlotIcon(button, urls[index + 1] || '');
      button.setAttribute('aria-label',isSagittarius(player)?`${SAGITTARIUS_SKILLS[index+1].name} (${index+1})`:`보조 스킬 ${index+1} (준비 중)`);
      button.title=button.getAttribute('aria-label');
    });
    layout();
  }

  function reset() {
    count = 0;
    group.replaceChildren();
    group.hidden = true;
    heldNumberKeys.clear();
    skill.disabled = true;
    skill.classList.add('is-locked');
    skill.setAttribute('aria-disabled', 'true');
    skill.setAttribute('aria-label', '특수 공격(E), LV2부터 해금');
    const lock = skill.querySelector('.combat-slot-lock');
    if (lock) lock.hidden = false;
    setSlotIcon(skill);
  }

  const observer = new ResizeObserver(layout);
  observer.observe(controls);
  observer.observe(skill);
  window.addEventListener('resize', layout);
  group.hidden = true;
  return { update, reset };
}
