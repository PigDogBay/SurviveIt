import * as THREE from 'three';
import { heightAt, TEMPLE } from './terrain.js';

const EGG_HEIGHT = 0.8;
const EGG_RADIUS = 0.3;
// How high the bottom of an egg floats, and how far it bobs.
const FLOAT = 0.5;
const BOB = 0.15;

// A cartoon girl inspired by Sabrina Carpenter: wavy blonde hair with
// curtain bangs, big blue eyes and a pink smile. Drawn into the middle of
// the egg's texture, which wraps round the egg once.
function drawSabrina(ctx, cx, cy) {
  const blonde = '#f0c048';
  const blondeDark = '#b8862a';
  const skin = '#f4c9a8';
  const outline = '#5a3a1c';
  // Dark outlines, so the picture stands out even in torchlight.
  ctx.lineJoin = 'round';

  // Long wavy hair behind the face, falling past the shoulders.
  ctx.fillStyle = blonde;
  ctx.beginPath();
  ctx.moveTo(cx - 120, cy - 40);
  ctx.bezierCurveTo(cx - 140, cy - 190, cx + 140, cy - 190, cx + 120, cy - 40);
  for (let i = 0; i <= 4; i++) {
    const y = cy - 20 + i * 45;
    ctx.quadraticCurveTo(cx + 150 + (i % 2 ? -20 : 20), y + 22, cx + 125, y + 45);
  }
  ctx.lineTo(cx - 125, cy + 205);
  for (let i = 4; i >= 0; i--) {
    const y = cy - 20 + i * 45;
    ctx.quadraticCurveTo(cx - 150 + (i % 2 ? 20 : -20), y + 22, cx - 120, y);
  }
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 6;
  ctx.stroke();

  // The face.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 10, 90, 110, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 5;
  ctx.stroke();

  // Curtain bangs, parted in the middle and sweeping out to each side.
  ctx.fillStyle = blonde;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 105);
    ctx.quadraticCurveTo(cx + side * 30, cy - 60, cx + side * 95, cy - 20);
    ctx.lineTo(cx + side * 100, cy - 100);
    ctx.quadraticCurveTo(cx + side * 60, cy - 125, cx, cy - 105);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  // Streaks so the hair looks wavy.
  ctx.strokeStyle = blondeDark;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + side * (108 + i * 8), cy - 10 + i * 50);
      ctx.quadraticCurveTo(cx + side * (128 + i * 6), cy + 15 + i * 50, cx + side * (112 + i * 8), cy + 40 + i * 50);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx + side * 10, cy - 100);
    ctx.quadraticCurveTo(cx + side * 40, cy - 65, cx + side * 85, cy - 35);
    ctx.stroke();
  }

  // Big cartoon eyes with blue irises, lashes and a sparkle.
  for (const side of [-1, 1]) {
    const ex = cx + side * 38;
    const ey = cy + 5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, 24, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2f6fd0';
    ctx.beginPath();
    ctx.arc(ex, ey + 2, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c1c28';
    ctx.beginPath();
    ctx.arc(ex, ey + 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + 4, ey - 3, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1c1c28';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 24, 18, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    for (const lash of [0.15, 0.5, 0.85]) {
      const angle = Math.PI * (1.05 + lash * 0.9);
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(angle) * 24, ey + Math.sin(angle) * 18);
      ctx.lineTo(ex + Math.cos(angle) * 32, ey + Math.sin(angle) * 26);
      ctx.stroke();
    }
    // Soft brows.
    ctx.strokeStyle = '#8a5a26';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(ex - 20, ey - 32);
    ctx.quadraticCurveTo(ex, ey - 40, ex + 20, ey - 33);
    ctx.stroke();
    // Rosy cheeks.
    ctx.fillStyle = 'rgba(235, 90, 120, 0.45)';
    ctx.beginPath();
    ctx.arc(cx + side * 55, cy + 45, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  // A little nose and a big pink smile.
  ctx.strokeStyle = '#d9a88a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy + 42);
  ctx.quadraticCurveTo(cx, cy + 48, cx + 6, cy + 42);
  ctx.stroke();
  ctx.fillStyle = '#d63a64';
  ctx.beginPath();
  ctx.moveTo(cx - 32, cy + 62);
  ctx.quadraticCurveTo(cx, cy + 100, cx + 32, cy + 62);
  ctx.quadraticCurveTo(cx, cy + 74, cx - 32, cy + 62);
  ctx.fill();
  ctx.strokeStyle = '#8a1e3a';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy + 66);
  ctx.quadraticCurveTo(cx, cy + 78, cx + 24, cy + 66);
  ctx.quadraticCurveTo(cx, cy + 72, cx - 24, cy + 66);
  ctx.fill();
}

// Every easter egg: its name (for the list at the end), where it is behind
// or around the temple (in the temple's own space, z towards the front
// door), its colours, and the picture on it.
const EGGS = [
  { name: 'Sabrina Carpenter egg', spot: [0, -12.5], colour: '#7cbce6', band: '#e86aa4', draw: drawSabrina },
];
// How close the minion must get to pick an egg up.
const PICKUP_DISTANCE = 1.2;

// A pastel egg with a zigzag band round the bottom and a picture on the front.
// The texture wraps round the egg once, with its middle on the front.
function eggTexture({ colour, band, draw }) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, 1024, 512);
  ctx.fillStyle = band;
  ctx.beginPath();
  ctx.moveTo(0, 470);
  for (let x = 0; x <= 1024; x += 32) ctx.lineTo(x, x % 64 ? 445 : 470);
  ctx.lineTo(1024, 500);
  ctx.lineTo(0, 500);
  ctx.fill();
  draw(ctx, 512, 210);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// An egg shape: rounder at the bottom, pointier at the top, standing on y = 0.
function eggGeometry() {
  const points = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const angle = t * Math.PI;
    // Squeezing the top half makes it an egg rather than a ball.
    const radius = Math.sin(angle) * EGG_RADIUS * (1 - 0.18 * t);
    points.push(new THREE.Vector2(Math.max(radius, 0.0001), (1 - Math.cos(angle)) / 2 * EGG_HEIGHT));
  }
  return new THREE.LatheGeometry(points, 48);
}

// Easter eggs hidden around the temple. They don't glow, so they're found by
// exploring with the torch, and they aren't on the map. Each floats a little
// off the ground, bobbing up and down, with its picture facing away from
// the temple. Walking into one collects it and tells `onCollect`.
export function createEasterEggs({ onCollect }) {
  const group = new THREE.Group();
  const colliders = [];
  const geometry = eggGeometry();
  const cos = Math.cos(TEMPLE.angle);
  const sin = Math.sin(TEMPLE.angle);
  const eggs = EGGS.map((egg, i) => {
    const [lx, lz] = egg.spot;
    const x = TEMPLE.x + lx * cos + lz * sin;
    const z = TEMPLE.z - lx * sin + lz * cos;
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: eggTexture(egg), roughness: 0.85 }));
    mesh.castShadow = true;
    // The texture's middle is at the back of the lathe, so turn it round to
    // face out from the temple.
    mesh.rotation.y = TEMPLE.angle + Math.PI + Math.atan2(lx, lz);
    const floor = heightAt(x, z);
    mesh.position.set(x, floor + FLOAT, z);
    group.add(mesh);
    const collider = { x, z, radius: EGG_RADIUS + 0.05, above: floor - 1.5 };
    colliders.push(collider);
    return { name: egg.name, mesh, collider, floor, phase: i * 1.7, collected: false };
  });

  function update(time, playerPosition, collisions) {
    for (const egg of eggs) {
      if (egg.collected) continue;
      const { mesh, floor, phase } = egg;
      mesh.position.y = floor + FLOAT + Math.sin(time * 1.5 + phase) * BOB;
      // Only on the same level, so an egg can't be reached from a dungeon underneath.
      const near =
        Math.abs(playerPosition.y - 1.25 - floor) < 2 &&
        Math.hypot(playerPosition.x - mesh.position.x, playerPosition.z - mesh.position.z) < PICKUP_DISTANCE;
      if (!near) continue;
      egg.collected = true;
      group.remove(mesh);
      collisions.remove([egg.collider]);
      onCollect(egg.name);
    }
  }

  return {
    group,
    colliders,
    update,
    // The names of the eggs collected so far, and how many there are.
    found: () => eggs.filter((egg) => egg.collected).map((egg) => egg.name),
    total: eggs.length,
  };
}
