import * as THREE from 'three';
import { createRandom, range } from './random.js';
import { heightAt, WORLD_RADIUS } from './terrain.js';

const PICKUP_DISTANCE = 1.3;
const COUNT = 20;

// An army-green crate with a yellow stripe and "AMMO" stencilled on it.
function crateTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4c5a2a';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffd84a';
  ctx.fillRect(0, 40, 64, 10);
  ctx.strokeStyle = '#2c3418';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, 61, 61);
  ctx.fillStyle = '#ffd84a';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AMMO', 32, 30);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,220,90,0.9)');
  glow.addColorStop(1, 'rgba(255,200,60,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function isClear(x, z, colliders) {
  return colliders.every((c) => Math.hypot(x - c.x, z - c.z) > c.radius + 1);
}

// Scatters ammo boxes through the woods. Walking into one tops up one of
// the minion's weapons, picked at random from those that need it. If none
// do, the box is left for later.
export function createAmmo(colliders) {
  const random = createRandom(57);
  const geometry = new THREE.BoxGeometry(0.5, 0.32, 0.36);
  const material = new THREE.MeshStandardMaterial({ map: crateTexture(), emissive: 0x2a2a10, roughness: 0.7 });
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const group = new THREE.Group();
  const boxes = [];

  // One close to the start so the first top-up is easy, the rest anywhere.
  const spots = [[-4, 8]];
  while (spots.length < COUNT) {
    const angle = range(random, 0, Math.PI * 2);
    const distance = range(random, 15, WORLD_RADIUS - 8);
    spots.push([Math.cos(angle) * distance, Math.sin(angle) * distance]);
  }

  for (let [x, z] of spots) {
    // Nudge the box until it isn't inside a tree or rock.
    for (let tries = 0; tries < 20 && !isClear(x, z, colliders); tries++) {
      x += range(random, -2, 2);
      z += range(random, -2, 2);
    }
    const crate = new THREE.Mesh(geometry, material);
    crate.castShadow = true;
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.set(1.5, 1.5, 1);
    const box = new THREE.Group();
    box.add(crate, glow);
    box.position.set(x, heightAt(x, z) + 0.45, z);
    group.add(box);
    boxes.push({ box, crate, baseY: box.position.y, phase: range(random, 0, 10) });
  }

  function update(time, playerPosition, weapons, showMessage) {
    for (let i = boxes.length - 1; i >= 0; i--) {
      const { box, crate, baseY, phase } = boxes[i];
      box.position.y = baseY + Math.sin(time * 2 + phase) * 0.12;
      crate.rotation.y = time * 1.2 + phase;

      // Only on the same level, so a box can't be reached from a dungeon underneath.
      const near =
        Math.abs(playerPosition.y - box.position.y) < 2 &&
        Math.hypot(playerPosition.x - box.position.x, playerPosition.z - box.position.z) < PICKUP_DISTANCE;
      if (!near) continue;
      const added = weapons.refill();
      if (!added) {
        showMessage(weapons.needsAmmo() ? 'Ammo is full' : 'Ammo box: find a weapon to use it');
        continue;
      }
      showMessage(`Ammo! ${added.join(', ')}`);
      group.remove(box);
      boxes.splice(i, 1);
    }
  }

  // Where the boxes still lying about are, for the map.
  function markers() {
    return boxes.map(({ box }) => ({ x: box.position.x, z: box.position.z }));
  }

  return { group, update, markers };
}
