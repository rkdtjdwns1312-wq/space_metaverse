const DEADZONE = 0.16;

export function createJoystick({onMove, onStop} = {}) {
  const joystick = document.querySelector('#joystick');
  const knob = document.querySelector('#joystick-knob');
  if (!joystick || !knob) return {reset() {}};

  let activePointerId = null;

  function reset() {
    if (activePointerId !== null) {
      try {
        if (joystick.hasPointerCapture?.(activePointerId)) joystick.releasePointerCapture(activePointerId);
      } catch {}
    }
    activePointerId = null;
    knob.style.transform = 'translate(-50%, -50%)';
  }

  function stop(pointerId) {
    if (activePointerId !== pointerId) return;
    knob.style.transform = 'translate(-50%, -50%)';
    activePointerId = null;
    onStop?.();
  }

  function move(event) {
    if (activePointerId !== event.pointerId) return;
    const rect = joystick.getBoundingClientRect();
    const radius = Math.min(rect.width, rect.height) / 2;
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(x, y);
    const scale = distance > radius ? radius / distance : 1;
    const clampedX = x * scale;
    const clampedY = y * scale;
    const nx = clampedX / radius;
    const ny = clampedY / radius;
    const magnitude = Math.hypot(nx, ny);
    if (magnitude < DEADZONE) {
      knob.style.transform = 'translate(-50%, -50%)';
      onMove?.({x: 0, y: 0});
      return;
    }
    knob.style.transform = `translate(calc(-50% + ${clampedX}px), calc(-50% + ${clampedY}px))`;
    onMove?.({x: nx, y: ny});
  }

  joystick.addEventListener('pointerdown', event => {
    if (activePointerId !== null || event.isPrimary === false || event.button !== 0) return;
    event.preventDefault();
    activePointerId = event.pointerId;
    joystick.setPointerCapture(event.pointerId);
    move(event);
  });
  joystick.addEventListener('pointermove', move);
  joystick.addEventListener('pointerup', event => stop(event.pointerId));
  joystick.addEventListener('pointercancel', event => stop(event.pointerId));
  joystick.addEventListener('lostpointercapture', event => stop(event.pointerId));
  window.addEventListener('blur', event => {
    if (activePointerId !== null) {
      activePointerId = null;
      knob.style.transform = 'translate(-50%, -50%)';
      onStop?.(event);
    }
  });
  reset();
  return {reset};
}
