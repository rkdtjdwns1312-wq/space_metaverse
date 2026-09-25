export function createAuxiliarySkills({ getPlayer, canAct, toast }) {
  const controls = document.querySelector('.combat-buttons');
  const skill = document.getElementById('touch-skill');
  if (!controls || !skill) return { update() {}, reset() {} };

  const group = document.createElement('div');
  group.className = 'auxiliary-skills';
  group.setAttribute('aria-label', '보조 스킬');
  controls.append(group);
  let count = 0;

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
    const wanted = Math.max(0, Math.min(3, levelOf(getPlayer()) - 2));
    if (wanted !== count) {
      count = wanted;
      group.replaceChildren();
      group.hidden = count === 0;
      for (let index = 1; index <= count; index += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'auxiliary-skill';
        button.textContent = String(index);
        button.setAttribute('aria-label', `보조 스킬 ${index} (준비 중)`);
        button.addEventListener('click', () => {
          if (canAct()) toast('보조 스킬은 준비 중이에요.');
        });
        group.append(button);
      }
    }
    layout();
  }

  function reset() {
    count = 0;
    group.replaceChildren();
    group.hidden = true;
  }

  const observer = new ResizeObserver(layout);
  observer.observe(controls);
  observer.observe(skill);
  window.addEventListener('resize', layout);
  group.hidden = true;
  return { update, reset };
}
