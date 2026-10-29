import * as THREE from 'three';
import { heightAt } from './terrain.js';

const PICKUP_DISTANCE = 1.4;

// Every key in the game. The 4 chamber keys and the cage key go here later.
const KEYS = [
  {
    id: 'temple',
    name: 'Temple key',
    spot: [-80, -55],
    found: 'You found the temple key! Now find the temple',
  },
];

const gold = new THREE.MeshStandardMaterial({ color: 0xf0c050, emissive: 0x5a3c08, metalness: 0.4, roughness: 0.3 });

// An old-fashioned key: a fancy ring to hold, a long shaft and a toothed bit.
// Lies along x, with the ring at the left.
function buildKey() {
  const key = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 8, 20), gold);
  ring.position.x = -0.3;
  // Three little bumps make the ring look like a clover.
  for (const angle of [Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const bump = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.02, 6, 12), gold);
    bump.position.set(-0.3 + Math.cos(angle) * 0.14, Math.sin(angle) * 0.14, 0);
    key.add(bump);
  }
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 10).rotateZ(Math.PI / 2), gold);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 10).rotateZ(Math.PI / 2), gold);
  collar.position.x = -0.16;
  const bit = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.03), gold);
  bit.position.set(0.19, -0.08, 0);
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.03), gold);
  tooth.position.set(0.15, -0.17, 0);
  key.add(ring, shaft, collar, bit, tooth);
  return key;
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,230,140,0.95)');
  glow.addColorStop(0.4, 'rgba(255,200,60,0.5)');
  glow.addColorStop(1, 'rgba(255,180,40,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// Keys lie glowing in the woods. Walking into one picks it up, and the keys
// the minion carries are listed on screen until they're used.
export function createKeys({ sounds, showMessage }) {
  // Ignores fog so a key's glow can be spotted between the trees from afar.
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture(),
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  });
  const group = new THREE.Group();
  const carried = new Set();

  for (const key of KEYS) {
    const [x, z] = key.spot;
    key.model = buildKey();
    key.model.traverse((part) => (part.castShadow = true));
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.set(2, 2, 1);
    key.pickup = new THREE.Group();
    key.pickup.add(key.model, glow);
    key.pickup.position.set(x, heightAt(x, z) + 0.7, z);
    group.add(key.pickup);
    key.collected = false;
  }

  const hud = document.getElementById('keys');
  function render() {
    hud.innerHTML = KEYS.filter((key) => carried.has(key.id))
      .map((key) => `<span class="key">🗝️ ${key.name}</span>`)
      .join('');
  }

  function update(time, playerPosition) {
    for (const key of KEYS) {
      if (key.collected) continue;
      const { pickup } = key;
      pickup.position.y = heightAt(pickup.position.x, pickup.position.z) + 0.7 + Math.sin(time * 2) * 0.1;
      key.model.rotation.y = time * 1.5;
      if (Math.hypot(playerPosition.x - pickup.position.x, playerPosition.z - pickup.position.z) < PICKUP_DISTANCE) {
        key.collected = true;
        carried.add(key.id);
        group.remove(pickup);
        sounds.chime();
        showMessage(key.found);
        render();
      }
    }
  }

  return {
    group,
    update,
    has: (id) => carried.has(id),
    // Where the keys not yet found are, for the map.
    markers: () => KEYS.filter((key) => !key.collected).map((key) => ({ x: key.pickup.position.x, z: key.pickup.position.z })),
    // Uses up a key, such as when it unlocks a door.
    use(id) {
      carried.delete(id);
      render();
    },
  };
}
