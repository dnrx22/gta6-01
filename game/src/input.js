// Keyboard input: WASD or arrows to move/drive, E to enter or leave a car,
// Enter to start or restart, M to mute the (silent-by-default) beeps.

export function createInput() {
  const input = {
    up: false, down: false, left: false, right: false,
    enter: false, start: false, muted: false,
  };
  const keys = {};
  const downMap = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };
  function onKey(event, pressed) {
    const name = downMap[event.code];
    if (name) {
      input[name] = pressed;
      event.preventDefault();
      return;
    }
    if (!pressed || event.repeat) return;
    if (event.code === 'KeyE') input.enter = true;
    if (event.code === 'Enter') input.start = true;
    if (event.code === 'KeyM') input.muted = !input.muted;
  }
  window.addEventListener('keydown', (event) => onKey(event, true));
  window.addEventListener('keyup', (event) => onKey(event, false));
  window.addEventListener('blur', () => {
    for (const key of Object.keys(keys)) keys[key] = false;
    input.up = input.down = input.left = input.right = false;
  });
  // Edge-triggered keys are consumed once per frame by the game loop.
  input.consume = function consume() {
    const out = { enter: input.enter, start: input.start };
    input.enter = false;
    input.start = false;
    return out;
  };
  return input;
}
