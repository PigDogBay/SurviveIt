import * as THREE from 'three';
import { heightAt } from './terrain.js';

const PICKUP_DISTANCE = 1.4;

const hex = (colour) => `#${colour.toString(16).padStart(6, '0')}`;

// Every key in the game. The temple key is plain gold; each chamber key
// has a gem that matches the ring on its chamber's door. A key with no
// `spot` is put in place by whatever hides it (the red and green keys are
// in the dungeons). A `waiting` key isn't in the woods until something
// reveals it (the blue and purple keys appear when the switches in the red
// and green chambers are pressed). The cage key is bigger, with a pink gem
// like Roro's feathers, and sits on the stand in the purple chamber.
const KEYS = [
  {
    id: 'temple',
    name: 'Temple key',
    colour: 0xffc040,
    spot: [-80, -55],
    found: 'You found the temple key! Now find the temple',
  },
  ...[
    ['red', 'Red', 0xff4a3a, null],
    ['blue', 'Blue', 0x4a8cff, [-120, 20]],
    ['green', 'Green', 0x5ae05a, null],
    ['purple', 'Purple', 0xb46aff, [-30, -130]],
  ].map(([id, colourName, colour, spot]) => ({
    waiting: id === 'blue' || id === 'purple',
    id,
    name: `${colourName} chamber key`,
    colour,
    gem: true,
    spot,
    found: `You found the ${colourName.toLowerCase()} chamber key! It opens a hidden chamber in the temple`,
  })),
  {
    id: 'cage',
    name: 'Cage key',
    colour: 0xff5fc8,
    gem: true,
    size: 1.3,
    spot: null,
    found: "You found the cage key! It opens Felonius's cage. Beware of Roro",
  },
];

// A key's name and colour, by its id.
export function keyInfo(id) {
  return KEYS.find((key) => key.id === id);
}

// Moves a spot out of any tree or rock, spiralling outwards until it's clear.
function clearSpot(x, z, colliders) {
  for (let step = 0; step < 80; step++) {
    const angle = step * 2.4;
    const px = x + Math.cos(angle) * step * 0.3;
    const pz = z + Math.sin(angle) * step * 0.3;
    if (colliders.every((c) => Math.hypot(px - c.x, pz - c.z) > c.radius + 1)) return [px, pz];
  }
  return [x, z];
}

const gold = new THREE.MeshStandardMaterial({ color: 0xf0c050, emissive: 0x5a3c08, metalness: 0.4, roughness: 0.3 });

// An old-fashioned key: a fancy ring to hold, a long shaft and a toothed bit.
// Lies along x, with the ring at the left. A gem can sit in the ring.
function buildKey(gem) {
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
  if (gem) {
    const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshBasicMaterial({ color: gem }));
    stone.position.x = -0.3;
    key.add(stone);
  }
  return key;
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// Keys lie glowing in the woods, each in its own colour. Walking into one
// picks it up, and the keys the minion carries are listed on screen until
// they're used.
export function createKeys({ colliders, sounds, showMessage }) {
  const glowMap = glowTexture();
  const group = new THREE.Group();
  const carried = new Set();

  for (const key of KEYS) {
    const [x, z] = key.spot ? clearSpot(...key.spot, colliders) : [0, 0];
    key.model = buildKey(key.gem && key.colour);
    key.model.scale.setScalar(key.size ?? 1);
    key.model.traverse((part) => (part.castShadow = true));
    // Ignores fog so a key's glow can be spotted between the trees from afar.
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowMap, color: key.colour, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
    );
    glow.scale.setScalar(2 * (key.size ?? 1));
    key.pickup = new THREE.Group();
    key.pickup.add(key.model, glow);
    key.floor = heightAt(x, z);
    key.pickup.position.set(x, key.floor + 0.7, z);
    if (!key.waiting) group.add(key.pickup);
    key.collected = false;
  }

  const hud = document.getElementById('keys');
  function render() {
    hud.innerHTML = KEYS.filter((key) => carried.has(key.id))
      .map((key) => `<span class="key" style="color: ${hex(key.colour)}">🗝️ ${key.name}</span>`)
      .join('');
  }

  function update(time, playerPosition) {
    for (const key of KEYS) {
      if (key.collected || key.waiting) continue;
      const { pickup } = key;
      pickup.position.y = key.floor + 0.7 + Math.sin(time * 2) * 0.1;
      key.model.rotation.y = time * 1.5;
      // Only on the same level, so the hall floor can't reach a key in the dungeon below.
      const sameLevel = Math.abs(playerPosition.y - pickup.position.y) < 2;
      if (sameLevel && Math.hypot(playerPosition.x - pickup.position.x, playerPosition.z - pickup.position.z) < PICKUP_DISTANCE) {
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
    // Whether a key has been picked up (even if it's been used since), and
    // where it lies.
    found: (id) => keyInfo(id).collected,
    where: (id) => keyInfo(id).pickup.position,
    // Where the keys not yet found are, for the map. Hidden keys stay off it.
    markers: () =>
      KEYS.filter((key) => !key.collected && !key.hidden && !key.waiting).map((key) => ({ x: key.pickup.position.x, z: key.pickup.position.z, colour: hex(key.colour) })),
    // Puts a key with no `spot` in place, with its floor at `y`. It stays off the map.
    place(id, { x, y, z }) {
      const key = keyInfo(id);
      key.floor = y;
      key.hidden = true;
      key.pickup.position.set(x, y + 0.7, z);
    },
    // Makes a waiting key appear where it lies.
    reveal(id) {
      const key = keyInfo(id);
      key.waiting = false;
      group.add(key.pickup);
    },
    // Uses up a key, such as when it unlocks a door.
    use(id) {
      carried.delete(id);
      render();
    },
  };
}
