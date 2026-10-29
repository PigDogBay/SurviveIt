export const MAX_HEALTH = 100;
// After this long without being hurt, health slowly comes back by
// REGEN_RATE a second.
const REGEN_DELAY = 5;
const REGEN_RATE = 1;

// Tracks the minion's health and keeps the health bar on screen in sync.
// Monsters call damage(); med kits call heal(). `shield.protection()` is how
// much of each hit is blocked (0 to 1), and `shield.onBlock` is told when
// it blocks one.
export function createHealth({ onDeath, shield = { protection: () => 0, onBlock() {} } }) {
  const bar = document.getElementById('health-fill');
  const label = document.getElementById('health-value');
  const hud = document.getElementById('health');
  const flash = document.getElementById('flash');
  let health = MAX_HEALTH;
  let sinceHurt = REGEN_DELAY;

  function render() {
    const fraction = health / MAX_HEALTH;
    bar.style.width = `${fraction * 100}%`;
    // Green when healthy, through yellow, to red when nearly out.
    bar.style.background = `hsl(${fraction * 120}, 75%, 48%)`;
    label.textContent = Math.ceil(health);
    hud.classList.toggle('low', fraction <= 0.25);
  }

  function flashScreen(kind) {
    flash.className = '';
    // Restart the animation even if it's already playing.
    void flash.offsetWidth;
    flash.className = kind;
  }

  function damage(amount) {
    if (health <= 0) return;
    const blocked = shield.protection();
    if (blocked > 0) shield.onBlock();
    health = Math.max(0, health - amount * (1 - blocked));
    sinceHurt = 0;
    flashScreen('hurt');
    render();
    if (health === 0) onDeath();
  }

  function heal(amount) {
    health = Math.min(MAX_HEALTH, health + amount);
    flashScreen('heal');
    render();
  }

  // Slowly gets better after a while without being hurt.
  function update(delta) {
    sinceHurt += delta;
    if (health <= 0 || health >= MAX_HEALTH || sinceHurt < REGEN_DELAY) return;
    health = Math.min(MAX_HEALTH, health + REGEN_RATE * delta);
    render();
  }

  render();
  return {
    damage,
    heal,
    update,
    get value() {
      return health;
    },
    get isFull() {
      return health >= MAX_HEALTH;
    },
  };
}
