import * as THREE from 'three';
import { createTerrain, heightAt } from './terrain.js';
import { createForest, createFireflies } from './forest.js';
import { createPlayer } from './player.js';
import { createHealth } from './health.js';
import { createMedkits } from './medkits.js';
import { createAmmo } from './ammo.js';
import { createMonsters } from './monsters.js';
import { createWeapons } from './weapons.js';
import { createSounds } from './sounds.js';
import { createKeys, keyInfo } from './keys.js';
import { createTemple } from './temple.js';
import { createMinimap } from './minimap.js';
import { createScares } from './scares.js';
import { createFelonius } from './felonius.js';
import { createChookie } from './chookie.js';
import { combineTargets } from './targets.js';
import { createGru } from './gru.js';
import { createEasterEggs } from './easter-eggs.js';
import { createCrows } from './crows.js';
import { createUFO } from './ufo.js';
import { createCollisionGrid } from './collision.js';
import { DUNGEON_PICKUPS, OPENINGS } from './dungeon.js';

const NIGHT = 0x0b1418;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(NIGHT);
scene.fog = new THREE.FogExp2(NIGHT, 0.035);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);

// Moonlight and a faint sky glow.
scene.add(new THREE.HemisphereLight(0x6a7f9a, 0x1a1a10, 0.6));
const moonlight = new THREE.DirectionalLight(0xa8c0ff, 1.2);
moonlight.castShadow = true;
moonlight.shadow.mapSize.set(2048, 2048);
moonlight.shadow.camera.left = -40;
moonlight.shadow.camera.right = 40;
moonlight.shadow.camera.top = 40;
moonlight.shadow.camera.bottom = -40;
moonlight.shadow.camera.far = 150;
moonlight.shadow.bias = -0.0005;
scene.add(moonlight, moonlight.target);
const MOON_DIRECTION = new THREE.Vector3(-0.5, 0.8, -0.35).normalize();

// The moon itself, kept far away by following the camera.
const moon = new THREE.Mesh(
  new THREE.SphereGeometry(6, 24, 16),
  new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false }),
);
scene.add(moon);

// The minion's torch, held in the left hand, away from the weapon in the
// right. Its light starts a little ahead of the hands, so it lights the woods
// but doesn't wash out the weapon or the shield to white. Press F to switch
// it on and off.
const torch = new THREE.SpotLight(0xfff1d0, 30, 35, Math.PI / 7, 0.45, 1.6);
torch.position.set(-0.25, -0.2, -0.6);
torch.target.position.set(0, 0, -1.6);
camera.add(torch, torch.target);
scene.add(camera);

// Leave holes in the ground over the stairs down to the dungeons.
scene.add(createTerrain(OPENINGS));
const forest = createForest();
scene.add(forest.group);
const fireflies = createFireflies();
scene.add(fireflies.points);

const sounds = createSounds();
const keys = createKeys({ colliders: forest.colliders, sounds, showMessage });
scene.add(keys.group);
const temple = createTemple({ keys, sounds, showMessage });
scene.add(temple.group);
// The temple's walls block the way just like trees do.
forest.colliders.push(...temple.colliders);

const medkits = createMedkits(forest.colliders, [...temple.medkitSpots, ...DUNGEON_PICKUPS.medkits.map((spot) => ({ ...spot, hidden: true }))]);
scene.add(medkits.group);
const ammo = createAmmo(forest.colliders);
scene.add(ammo.group);
const chookie = createChookie({ keys, sounds, showMessage });
scene.add(chookie.group);
const felonius = createFelonius({
  keys,
  keyColour: keyInfo('cage').colour,
  sounds,
  showMessage,
  onSafe: succeed,
  guarded: chookie.guarding,
  // Freeing Felonius brings the crows. `gru` is made further down.
  onFreed() {
    crows.start();
    gru.say('Crows! Protect Felonius and get him to the temple!', 5);
  },
  onLost: loseFelonius,
});
const crows = createCrows({ felonius, sounds });
scene.add(crows.group);
// Shooting the UFO drops the Alien egg below it, clear of any tree.
const ufo = createUFO({
  sounds,
  showMessage,
  onShot(where) {
    const landing = new THREE.Vector3(where.x, heightAt(where.x, where.z), where.z);
    collisions.pushOut(landing, 1);
    easterEggs.drop('Alien egg', new THREE.Vector3(landing.x, where.y - 1, landing.z), camera.position);
  },
});
scene.add(ufo.group);
scene.add(felonius.group);
// The cage's bars block the way like trees do.
forest.colliders.push(...felonius.colliders);
// Collecting an easter egg: Gru is pleased. `gru` is made further down.
const easterEggs = createEasterEggs({
  sounds,
  showMessage,
  trees: forest.colliders,
  onCollect() {
    sounds.chime();
    gru.say('Well done on finding my treasure!');
  },
});
scene.add(easterEggs.group);
forest.colliders.push(...easterEggs.colliders);

const collisions = createCollisionGrid(forest.colliders);
const monsters = createMonsters(collisions, sounds, showMessage);
scene.add(monsters.group);

const player = createPlayer(camera, document.body, collisions);

// Weapons can hit the monsters and Chookie alike.
const weapons = createWeapons({ camera, controls: player.controls, monsters: combineTargets(monsters, chookie, crows, ufo), collisions, sounds, showMessage });
scene.add(weapons.group);

const scares = createScares({ camera, monsters, sounds });
const gru = createGru({ camera, keys, weapons, temple, felonius, chookie, sounds });
const minimap = createMinimap({ colliders: forest.colliders, temple, medkits, ammo, weapons, keys, monsters, felonius, chookie, crows });
const facing = new THREE.Vector3();

const menu = document.getElementById('menu');
const gameover = document.getElementById('gameover');
const success = document.getElementById('success');
// Set when the minion dies or wins, which stops the game.
let gameOver = false;

const health = createHealth({
  // The shield that comes with the sword blocks most of each hit.
  shield: weapons.shield,
  onDeath() {
    gameOver = true;
    player.controls.unlock();
    gameover.classList.remove('hidden');
  },
});

document.getElementById('play').addEventListener('click', () => player.controls.lock());
document.getElementById('retry').addEventListener('click', () => window.location.reload());
document.getElementById('again').addEventListener('click', () => window.location.reload());

// The crows got Felonius: the mission has failed.
function loseFelonius() {
  gameOver = true;
  player.controls.unlock();
  gameover.querySelector('h1').textContent = 'The crows got Felonius!';
  gameover.querySelector('p').textContent = 'Keep him safe all the way to the temple next time.';
  gameover.classList.remove('hidden');
}

// Felonius is safe in the temple: the mission is done.
function succeed() {
  gameOver = true;
  sounds.fanfare();
  player.controls.unlock();
  // The easter eggs found on the way.
  const found = easterEggs.found();
  document.querySelector('#eggs-found h2').textContent = `Easter eggs found: ${found.length} of ${easterEggs.total}`;
  const list = document.querySelector('#eggs-found ul');
  const items = found.map((name) => {
    const item = document.createElement('li');
    item.textContent = name;
    return item;
  });
  if (items.length === 0) {
    const none = document.createElement('li');
    none.className = 'none';
    none.textContent = 'None this time. Keep exploring!';
    items.push(none);
  }
  list.replaceChildren(...items);
  success.classList.remove('hidden');
}
player.controls.addEventListener('lock', () => menu.classList.add('hidden'));
player.controls.addEventListener('unlock', () => {
  if (!gameOver) menu.classList.remove('hidden');
});

const message = document.getElementById('message');
let messageTimeout;
function showMessage(text) {
  message.textContent = text;
  message.classList.add('show');
  clearTimeout(messageTimeout);
  messageTimeout = setTimeout(() => message.classList.remove('show'), 1500);
}

window.addEventListener('keydown', (event) => {
  if (!player.controls.isLocked) return;
  if (event.code === 'KeyF') torch.visible = !torch.visible;
  // K hurts the minion so med kits can be tested without finding a monster.
  // Only works with `npm run dev`, not in a production build.
  if (import.meta.env.DEV && event.code === 'KeyK') health.damage(20);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const timer = new THREE.Timer();
renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.1);

  player.update(delta);
  fireflies.update(timer.getElapsed());
  if (!gameOver && player.controls.isLocked) easterEggs.update(timer.getElapsed(), camera.position, collisions);
  if (!gameOver) medkits.update(timer.getElapsed(), camera.position, health, showMessage);
  if (!gameOver && player.controls.isLocked) health.update(delta);
  if (!gameOver) weapons.update(delta, timer.getElapsed(), camera.position);
  if (!gameOver) ammo.update(timer.getElapsed(), camera.position, weapons, showMessage);
  if (!gameOver) keys.update(timer.getElapsed(), camera.position);
  if (!gameOver) temple.update(delta, timer.getElapsed(), camera.position, collisions);
  minimap.update(camera.position, camera.getWorldDirection(facing));
  // Monsters freeze while the game is paused, so pausing is safe.
  if (!gameOver && player.controls.isLocked) monsters.update(delta, camera.position, health);
  if (!gameOver && player.controls.isLocked) scares.update(delta, camera.position);
  if (!gameOver && player.controls.isLocked) ufo.update(delta, timer.getElapsed());
  if (!gameOver && player.controls.isLocked) crows.update(delta, timer.getElapsed(), camera.position, health);
  if (!gameOver && player.controls.isLocked) felonius.update(delta, timer.getElapsed(), camera.position, collisions);
  if (!gameOver && player.controls.isLocked) gru.update(camera.position);
  if (!gameOver && player.controls.isLocked) chookie.update(delta, timer.getElapsed(), camera.position, health, collisions);

  // Keep the moon's shadows centred on the player.
  moonlight.target.position.copy(camera.position);
  moonlight.position.copy(camera.position).addScaledVector(MOON_DIRECTION, 80);
  moon.position.copy(camera.position).addScaledVector(MOON_DIRECTION, 300);

  renderer.render(scene, camera);
});
