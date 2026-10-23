export const MAX_HEALTH = 100;

// Tracks the minion's health and keeps the health bar on screen in sync.
// Monsters call damage(); med kits call heal().
export function createHealth({ onDeath }) {
  const bar = document.getElementById('health-fill');
  const label = document.getElementById('health-value');
  const hud = document.getElementById('health');
  const flash = document.getElementById('flash');
  let health = MAX_HEALTH;

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
    health = Math.max(0, health - amount);
    flashScreen('hurt');
    render();
    if (health === 0) onDeath();
  }

  function heal(amount) {
    health = Math.min(MAX_HEALTH, health + amount);
    flashScreen('heal');
    render();
  }

  render();
  return {
    damage,
    heal,
    get value() {
      return health;
    },
    get isFull() {
      return health >= MAX_HEALTH;
    },
  };
}
