import * as THREE from 'three';
import { heightAt } from './terrain.js';

// The UFO loops slowly round the whole map, this far from the middle,
// wobbling in and out, and this high above the ground (over the treetops).
const LOOP_RADIUS = 80;
const LOOP_WOBBLE = 25;
const LOOP_SPEED = 0.05;
const HEIGHT = 22;
// Shots hit it anywhere within this of its middle.
const HIT_RADIUS = 2.6;
const LEAVE_TIME = 4;
const LIGHT_COLOURS = [0xff4040, 0xffd040, 0x40ff60, 0x40c0ff, 0xff60ff];

// A silver flying saucer with a glass dome and a ring of blinking lights.
function buildUFO() {
  const ufo = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, emissive: 0x3a4250, metalness: 0.4, roughness: 0.35 });
  const profile = [
    new THREE.Vector2(0.01, -0.5),
    new THREE.Vector2(1, -0.4),
    new THREE.Vector2(2.4, -0.1),
    new THREE.Vector2(2.6, 0),
    new THREE.Vector2(2.4, 0.15),
    new THREE.Vector2(1.2, 0.4),
    new THREE.Vector2(0.01, 0.45),
  ];
  const saucer = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), silver);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x80e0ff, emissive: 0x1a5a6a, transparent: true, opacity: 0.6, roughness: 0.1 }),
  );
  dome.position.y = 0.35;
  ufo.add(saucer, dome);
  // The lights ignore fog and lighting, so they can be spotted from afar.
  const lights = LIGHT_COLOURS.flatMap((colour) => [colour, colour]).map((colour, i, all) => {
    const angle = (i / all.length) * Math.PI * 2;
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), new THREE.MeshBasicMaterial({ color: colour, fog: false }));
    light.position.set(Math.cos(angle) * 2.45, 0.02, Math.sin(angle) * 2.45);
    ufo.add(light);
    return light;
  });
  // A soft glow underneath, as if it's beaming down, that shows through the
  // fog so the UFO can be spotted from afar.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(170,255,190,0.55)');
  glow.addColorStop(1, 'rgba(120,255,160,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
  );
  halo.scale.set(5, 5, 1);
  halo.position.y = -1.6;
  ufo.add(halo);
  ufo.traverse((part) => (part.castShadow = !part.isSprite));
  return { ufo, lights };
}

// The UFO easter egg: it flies over the woods, and shooting it sends it off
// into space, dropping the Alien egg (`onShot` is told where). It offers the
// same calls as the monsters, so `combineTargets` lets every gun hit it.
export function createUFO({ sounds, showMessage, onShot }) {
  const group = new THREE.Group();
  const { ufo, lights } = buildUFO();
  group.add(ufo);
  const self = { monster: ufo };
  let state = 'flying';
  let leaving = 0;
  let angle = 0;

  function update(delta, time) {
    if (state === 'gone') return;
    // The lights chase each other round the rim.
    lights.forEach((light, i) => (light.visible = Math.floor(time * 6 + i) % 3 !== 0));
    ufo.rotation.y += delta * 0.8;
    if (state === 'flying') {
      angle += delta * LOOP_SPEED;
      const radius = LOOP_RADIUS + Math.sin(angle * 3) * LOOP_WOBBLE;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      ufo.position.set(x, Math.max(heightAt(x, z), 0) + HEIGHT + Math.sin(time * 1.3) * 0.6, z);
      ufo.rotation.z = Math.sin(time * 0.9) * 0.08;
    } else if (state === 'leaving') {
      // Wobbles, then zooms straight up into space, getting smaller.
      leaving += delta;
      ufo.rotation.z = Math.sin(leaving * 20) * 0.3 * Math.max(0, 1 - leaving);
      ufo.position.y += delta * (5 + leaving * leaving * 40);
      ufo.rotation.y += delta * leaving * 15;
      if (leaving > LEAVE_TIME) {
        group.remove(ufo);
        state = 'gone';
      }
    }
  }

  // Any hit sends it off, dropping the egg where it was.
  function shoot() {
    if (state !== 'flying') return false;
    state = 'leaving';
    sounds.ufo();
    showMessage('The UFO zoomed off into space... and dropped something!');
    onShot(ufo.position.clone());
    return false;
  }

  const toUFO = new THREE.Vector3();
  function raycast(origin, direction, maxDistance) {
    if (state !== 'flying') return null;
    toUFO.subVectors(ufo.position, origin);
    const along = toUFO.dot(direction);
    if (along < 0 || along >= maxDistance) return null;
    if (toUFO.lengthSq() - along * along > HIT_RADIUS * HIT_RADIUS) return null;
    return { target: self, distance: along };
  }

  return {
    group,
    update,
    raycast,
    hurt: () => shoot(),
    freeze: () => shoot(),
    blind: () => shoot(),
    ignite: () => shoot(),
    // Too high for gas clouds, flames or the sword.
    near: () => [],
    alert() {},
    owns: (target) => target === self,
  };
}
