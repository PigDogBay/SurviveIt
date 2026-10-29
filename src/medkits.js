import * as THREE from 'three';
import { createRandom, range } from './random.js';
import { heightAt, WORLD_RADIUS } from './terrain.js';

const HEAL_AMOUNT = 35;
const PICKUP_DISTANCE = 1.3;
const COUNT = 12;

// A white first-aid box with a red cross on every side.
function medkitTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#d6202a';
  ctx.fillRect(26, 12, 12, 40);
  ctx.fillRect(12, 26, 40, 12);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,120,120,0.9)');
  glow.addColorStop(1, 'rgba(255,60,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function isClear(x, z, colliders) {
  return colliders.every((c) => Math.hypot(x - c.x, z - c.z) > c.radius + 1);
}

// Scatters med kits through the woods. Walking into one heals the minion,
// but only if they're hurt, so kits aren't wasted at full health.
export function createMedkits(colliders) {
  const random = createRandom(31);
  const geometry = new THREE.BoxGeometry(0.55, 0.38, 0.38);
  const material = new THREE.MeshStandardMaterial({
    map: medkitTexture(),
    emissive: 0x552222,
    roughness: 0.6,
  });
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const group = new THREE.Group();
  const kits = [];

  // A couple close to the start so they're easy to find, the rest anywhere.
  const spots = [
    [5, -6],
    [-7, 4],
  ];
  while (spots.length < COUNT) {
    const angle = range(random, 0, Math.PI * 2);
    const distance = range(random, 15, WORLD_RADIUS - 8);
    spots.push([Math.cos(angle) * distance, Math.sin(angle) * distance]);
  }

  for (let [x, z] of spots) {
    // Nudge the kit until it isn't inside a tree or rock.
    for (let tries = 0; tries < 20 && !isClear(x, z, colliders); tries++) {
      x += range(random, -2, 2);
      z += range(random, -2, 2);
    }
    const box = new THREE.Mesh(geometry, material);
    box.castShadow = true;
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.set(1.6, 1.6, 1);
    const kit = new THREE.Group();
    kit.add(box, glow);
    kit.position.set(x, heightAt(x, z) + 0.5, z);
    group.add(kit);
    kits.push({ kit, box, baseY: kit.position.y, phase: range(random, 0, 10) });
  }

  function update(time, playerPosition, health, showMessage) {
    for (let i = kits.length - 1; i >= 0; i--) {
      const { kit, box, baseY, phase } = kits[i];
      kit.position.y = baseY + Math.sin(time * 2 + phase) * 0.12;
      box.rotation.y = time * 1.2 + phase;

      const near = Math.hypot(playerPosition.x - kit.position.x, playerPosition.z - kit.position.z) < PICKUP_DISTANCE;
      if (!near) continue;
      if (health.isFull) {
        showMessage('Health is full');
        continue;
      }
      health.heal(HEAL_AMOUNT);
      showMessage(`Med kit +${HEAL_AMOUNT}`);
      group.remove(kit);
      kits.splice(i, 1);
    }
  }

  // Where the kits still lying about are, for the map.
  function markers() {
    return kits.map(({ kit }) => ({ x: kit.position.x, z: kit.position.z }));
  }

  return { group, update, markers };
}
