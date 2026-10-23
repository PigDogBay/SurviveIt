import * as THREE from 'three';
import { createTerrain } from './terrain.js';
import { createForest, createFireflies } from './forest.js';
import { createPlayer } from './player.js';

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

// The minion's torch. Press F to switch it on and off.
const torch = new THREE.SpotLight(0xfff1d0, 30, 35, Math.PI / 7, 0.45, 1.6);
torch.position.set(0.25, -0.2, 0);
torch.target.position.set(0, 0, -1);
camera.add(torch, torch.target);
scene.add(camera);

scene.add(createTerrain());
const forest = createForest();
scene.add(forest.group);
const fireflies = createFireflies();
scene.add(fireflies.points);

const player = createPlayer(camera, document.body, forest.colliders);

const menu = document.getElementById('menu');
document.getElementById('play').addEventListener('click', () => player.controls.lock());
player.controls.addEventListener('lock', () => menu.classList.add('hidden'));
player.controls.addEventListener('unlock', () => menu.classList.remove('hidden'));

window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyF' && player.controls.isLocked) torch.visible = !torch.visible;
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

  // Keep the moon's shadows centred on the player.
  moonlight.target.position.copy(camera.position);
  moonlight.position.copy(camera.position).addScaledVector(MOON_DIRECTION, 80);
  moon.position.copy(camera.position).addScaledVector(MOON_DIRECTION, 300);

  renderer.render(scene, camera);
});
