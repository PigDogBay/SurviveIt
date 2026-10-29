import { WORLD_RADIUS } from './terrain.js';

// On-screen size in CSS pixels. The map is round, like the woods.
const SIZE = 240;
// Metres from the centre of the map to its edge.
const VIEW_RADIUS = WORLD_RADIUS + 6;
// How far around the minion the fog clears, in metres.
const REVEAL_RADIUS = 25;
// Only clear more fog after moving this far, to save work.
const REVEAL_STEP = 1;

// The map in the top-right corner. It starts covered in fog, which clears
// wherever the minion goes. Monsters, pickups and the temple only show once
// their part of the map has been explored.
export function createMinimap({ colliders, temple, medkits, ammo, weapons, keys, monsters }) {
  const canvas = document.getElementById('minimap');
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const pixels = Math.round(SIZE * pixelRatio);
  canvas.width = canvas.height = pixels;
  canvas.style.width = canvas.style.height = `${SIZE}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(pixelRatio, pixelRatio);

  const scale = SIZE / 2 / VIEW_RADIUS;
  const mapX = (x) => SIZE / 2 + x * scale;
  const mapY = (z) => SIZE / 2 + z * scale;

  function layer() {
    const layerCanvas = document.createElement('canvas');
    layerCanvas.width = layerCanvas.height = pixels;
    const layerCtx = layerCanvas.getContext('2d');
    layerCtx.scale(pixelRatio, pixelRatio);
    return [layerCanvas, layerCtx];
  }

  // The ground and every tree and rock, drawn once.
  const [ground, groundCtx] = layer();
  groundCtx.fillStyle = '#121a0e';
  groundCtx.fillRect(0, 0, SIZE, SIZE);
  groundCtx.fillStyle = '#5a5638';
  groundCtx.beginPath();
  groundCtx.arc(SIZE / 2, SIZE / 2, WORLD_RADIUS * scale, 0, Math.PI * 2);
  groundCtx.fill();
  groundCtx.fillStyle = '#1d3a1e';
  for (const { x, z, radius } of colliders) {
    const r = Math.max(0.6, radius * scale);
    groundCtx.fillRect(mapX(x) - r, mapY(z) - r, r * 2, r * 2);
  }

  // The fog: solid to start with, with holes cut wherever the minion has been.
  const [fog, fogCtx] = layer();
  fogCtx.fillStyle = '#3d4650';
  fogCtx.fillRect(0, 0, SIZE, SIZE);
  fogCtx.globalCompositeOperation = 'destination-out';
  let lastReveal = null;

  function reveal(x, z) {
    if (lastReveal && Math.hypot(x - lastReveal.x, z - lastReveal.z) < REVEAL_STEP) return;
    lastReveal = { x, z };
    const radius = REVEAL_RADIUS * scale;
    const hole = fogCtx.createRadialGradient(mapX(x), mapY(z), radius * 0.6, mapX(x), mapY(z), radius);
    hole.addColorStop(0, 'rgba(0,0,0,1)');
    hole.addColorStop(1, 'rgba(0,0,0,0)');
    fogCtx.fillStyle = hole;
    fogCtx.beginPath();
    fogCtx.arc(mapX(x), mapY(z), radius, 0, Math.PI * 2);
    fogCtx.fill();
  }

  function dot(x, z, radius, fill, stroke) {
    ctx.beginPath();
    ctx.arc(mapX(x), mapY(z), radius, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function drawTemple() {
    const { x, z, angle, rooms, doors } = temple.outline;
    ctx.save();
    ctx.translate(mapX(x), mapY(z));
    // The map's y axis is the world's z, so the turn runs the other way.
    ctx.rotate(-angle);
    ctx.fillStyle = '#c9bd94';
    ctx.strokeStyle = '#2a2418';
    ctx.lineWidth = 1;
    for (const room of rooms) {
      const w = room.width * scale;
      const d = room.depth * scale;
      ctx.strokeRect(room.x * scale - w / 2, room.z * scale - d / 2, w, d);
    }
    for (const room of rooms) {
      const w = room.width * scale;
      const d = room.depth * scale;
      ctx.fillRect(room.x * scale - w / 2, room.z * scale - d / 2, w, d);
    }
    // Each door in the colour of the key that opens it.
    for (const door of doors) {
      ctx.fillStyle = door.colour;
      ctx.fillRect(door.x * scale - 1.25, door.z * scale - 1.25, 2.5, 2.5);
    }
    ctx.restore();
  }

  function drawMedkit(x, z) {
    const cx = mapX(x);
    const cy = mapY(z);
    ctx.fillStyle = '#f4f1ea';
    ctx.fillRect(cx - 3, cy - 3, 6, 6);
    ctx.fillStyle = '#d6202a';
    ctx.fillRect(cx - 0.75, cy - 2.25, 1.5, 4.5);
    ctx.fillRect(cx - 2.25, cy - 0.75, 4.5, 1.5);
  }

  function drawAmmo(x, z) {
    const cx = mapX(x);
    const cy = mapY(z);
    ctx.fillStyle = '#4c5a2a';
    ctx.fillRect(cx - 3, cy - 2.5, 6, 5);
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(cx - 3, cy + 0.5, 6, 1.2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#000';
    ctx.strokeRect(cx - 3, cy - 2.5, 6, 5);
  }

  function drawPlayer(position, facing) {
    ctx.save();
    ctx.translate(mapX(position.x), mapY(position.z));
    ctx.rotate(Math.atan2(facing.z, facing.x));
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-4, 4.5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-4, -4.5);
    ctx.closePath();
    ctx.fillStyle = '#ffd84a';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#1b2a5c';
    ctx.stroke();
    ctx.restore();
  }

  // `facing` is the direction the camera looks.
  function update(position, facing) {
    reveal(position.x, position.z);

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(ground, 0, 0, SIZE, SIZE);
    drawTemple();
    for (const { x, z } of medkits.markers()) drawMedkit(x, z);
    for (const { x, z } of ammo.markers()) drawAmmo(x, z);
    for (const { x, z, colour } of weapons.markers()) dot(x, z, 3.5, colour, '#000');
    for (const { x, z, colour } of keys.markers()) dot(x, z, 3.5, colour, '#000');
    for (const { x, z } of monsters.markers()) dot(x, z, 2.2, '#ff3a2a');
    ctx.drawImage(fog, 0, 0, SIZE, SIZE);
    drawPlayer(position, facing);
  }

  return { update };
}
