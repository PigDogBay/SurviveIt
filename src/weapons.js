import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { buildBlunderbuss, buildFartGun, buildFreezeRay } from './weapon-models.js';

const PICKUP_DISTANCE = 1.4;
const SWITCH_TIME = 0.25;

// Blunderbuss: a spray of pellets, each doing 1 damage. The bang wakes up
// monsters nearby.
const PELLETS = 9;
// How far pellets scatter from the crosshair, in radians.
const SPREAD = 0.07;
const BLUNDERBUSS_RANGE = 30;
const WAKE_DISTANCE = 50;

// Fart gun: a cloud of gas that hurts and chokes monsters inside it.
const CLOUD_DISTANCE = 4;
const CLOUD_RADIUS = 2.5;
const CLOUD_TIME = 4;
const CLOUD_TICK = 0.5;

// Freeze ray: a beam that turns one monster to ice.
const FREEZE_RANGE = 40;
const FREEZE_TIME = 5;

// In the order of the number keys that select them. The blunderbuss lies
// just ahead of the start; the others are further out in the woods.
const WEAPONS = [
  { name: 'Blunderbuss', spot: [-2, -7], glow: 0xffa040, build: buildBlunderbuss, muzzle: -0.62, reloadTime: 1.1, kick: 1 },
  { name: 'Fart gun', spot: [28, -32], glow: 0x9be04a, build: buildFartGun, muzzle: -0.46, reloadTime: 2, kick: 0.6 },
  { name: 'Freeze ray', spot: [-48, 52], glow: 0x7fe8ff, build: buildFreezeRay, muzzle: -0.4, reloadTime: 1.5, kick: 0.3 },
];

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

// Lumpy, murky puff of gas.
function gasTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  for (const [x, y, r] of [
    [32, 32, 26],
    [22, 26, 16],
    [42, 24, 15],
    [40, 42, 14],
  ]) {
    const puff = ctx.createRadialGradient(x, y, 0, x, y, r);
    puff.addColorStop(0, 'rgba(150,200,50,0.55)');
    puff.addColorStop(1, 'rgba(110,150,30,0)');
    ctx.fillStyle = puff;
    ctx.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(canvas);
}

// The minion's weapons: find each one glowing in the woods, switch with the
// number keys or mouse wheel, and click to fire.
export function createWeapons({ camera, controls, monsters, collisions, sounds, showMessage }) {
  const glow = glowTexture();
  const gas = gasTexture();
  const group = new THREE.Group();

  // Everything held sits in the bottom-right of the view.
  const held = new THREE.Group();
  held.position.set(0.24, -0.25, -0.42);
  held.rotation.y = -0.1;
  camera.add(held);

  const muzzleFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, depthWrite: false, blending: THREE.AdditiveBlending }));
  muzzleFlash.scale.set(0.5, 0.5, 1);
  muzzleFlash.visible = false;
  // Always present but dark between shots: adding and removing a light
  // would make Three.js rebuild every material's shader.
  const flashLight = new THREE.PointLight(0xffffff, 0, 25, 1.5);

  for (const weapon of WEAPONS) {
    const [x, z] = weapon.spot;
    const spot = new THREE.Vector3(x, 0, z);
    collisions.pushOut(spot, 1);
    const pickupGun = weapon.build();
    pickupGun.scale.setScalar(1.6);
    pickupGun.traverse((part) => (part.castShadow = true));
    // The glow ignores fog so it can be spotted between the trees from afar.
    const pickupGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color: weapon.glow, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }),
    );
    pickupGlow.scale.set(2, 2, 1);
    weapon.pickup = new THREE.Group();
    weapon.pickup.add(pickupGun, pickupGlow);
    weapon.pickup.position.set(spot.x, heightAt(spot.x, spot.z) + 0.55, spot.z);
    weapon.pickupGun = pickupGun;
    group.add(weapon.pickup);

    weapon.gun = weapon.build();
    weapon.gun.visible = false;
    held.add(weapon.gun);
    weapon.owned = false;
    weapon.sinceShot = weapon.reloadTime;
  }
  WEAPONS[0].fire = fireBlunderbuss;
  WEAPONS[1].fire = fireFartGun;
  WEAPONS[2].fire = fireFreezeRay;

  let current = null;
  let sinceSwitch = SWITCH_TIME;

  const slots = document.getElementById('weapons');
  function renderSlots() {
    slots.innerHTML = WEAPONS.map((weapon, i) =>
      weapon.owned ? `<span class="slot${weapon === current ? ' active' : ''}"><kbd>${i + 1}</kbd>${weapon.name}</span>` : '',
    ).join('');
  }

  function equip(weapon) {
    if (!weapon.owned || weapon === current) return;
    if (current) current.gun.visible = false;
    current = weapon;
    current.gun.visible = true;
    muzzleFlash.position.set(0, 0.035, weapon.muzzle);
    flashLight.position.copy(muzzleFlash.position);
    flashLight.color.setHex(weapon.glow);
    muzzleFlash.material.color.setHex(weapon.glow);
    weapon.gun.add(muzzleFlash, flashLight);
    sinceSwitch = 0;
    renderSlots();
  }

  const crosshair = document.getElementById('crosshair');
  let crosshairTimeout;
  function showHits(hits, kills) {
    if (hits > 0) {
      crosshair.classList.add('hit');
      clearTimeout(crosshairTimeout);
      crosshairTimeout = setTimeout(() => crosshair.classList.remove('hit'), 150);
    }
    if (kills > 0) showMessage(kills > 1 ? `${kills} monsters defeated!` : 'Monster defeated!');
  }

  const origin = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const direction = new THREE.Vector3();

  // How far a ray goes before it hits a tree, up to `range`.
  function clearDistance(from, towards, range) {
    return Math.min(range, collisions.rayDistance(from, towards, range));
  }

  function fireBlunderbuss() {
    sounds.bang();
    monsters.alert(origin, WAKE_DISTANCE);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);

    // Count how many pellets hit each monster, then hurt each one once.
    const hits = new Map();
    for (let i = 0; i < PELLETS; i++) {
      const angle = Math.random() * Math.PI * 2;
      const scatter = Math.sqrt(Math.random()) * SPREAD;
      direction
        .copy(aim)
        .addScaledVector(right, Math.cos(angle) * scatter)
        .addScaledVector(up, Math.sin(angle) * scatter)
        .normalize();
      const hit = monsters.raycast(origin, direction, BLUNDERBUSS_RANGE);
      if (!hit || collisions.rayDistance(origin, direction, hit.distance) < hit.distance) continue;
      hits.set(hit.target, (hits.get(hit.target) ?? 0) + 1);
    }

    let kills = 0;
    for (const [target, count] of hits) {
      if (monsters.hurt(target, count, aim)) kills++;
    }
    showHits(hits.size, kills);
  }

  const clouds = [];
  function fireFartGun() {
    sounds.fart();
    // The cloud stops short of any tree in the way.
    const distance = Math.max(1.5, clearDistance(origin, aim, CLOUD_DISTANCE) - 0.5);
    const centre = origin.clone().addScaledVector(aim, distance);
    centre.y = heightAt(centre.x, centre.z) + 1;

    const cloud = new THREE.Group();
    cloud.position.copy(centre);
    const material = new THREE.SpriteMaterial({ map: gas, depthWrite: false, opacity: 0 });
    for (let i = 0; i < 7; i++) {
      const puff = new THREE.Sprite(material);
      puff.position.set((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2.4);
      puff.userData.size = 1.8 + Math.random() * 1.4;
      cloud.add(puff);
    }
    group.add(cloud);
    clouds.push({ cloud, material, age: 0, tick: 0 });
  }

  function updateClouds(delta) {
    const away = new THREE.Vector3();
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i];
      c.age += delta;
      // Billow out quickly, hang about, then fade away.
      const grow = Math.min(1, c.age / 0.4);
      c.material.opacity = 0.85 * grow * Math.min(1, (CLOUD_TIME - c.age) / 1);
      for (const puff of c.cloud.children) puff.scale.setScalar(puff.userData.size * (0.4 + 0.6 * grow));
      c.cloud.rotation.y += delta * 0.3;

      c.tick -= delta;
      if (c.tick <= 0) {
        c.tick = CLOUD_TICK;
        let hits = 0;
        let kills = 0;
        for (const target of monsters.near(c.cloud.position, CLOUD_RADIUS)) {
          away.subVectors(target.monster.position, c.cloud.position).setY(0).normalize();
          hits++;
          if (monsters.hurt(target, 1, away)) kills++;
        }
        showHits(hits, kills);
      }

      if (c.age >= CLOUD_TIME) {
        group.remove(c.cloud);
        c.material.dispose();
        clouds.splice(i, 1);
      }
    }
  }

  const beamMaterial = new THREE.MeshBasicMaterial({
    color: 0x9ff0ff,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8, 1, true), beamMaterial);
  beam.visible = false;
  group.add(beam);
  let beamAge = 0;
  const muzzle = new THREE.Vector3();
  const beamEnd = new THREE.Vector3();

  function fireFreezeRay() {
    sounds.zap();
    let length = clearDistance(origin, aim, FREEZE_RANGE);
    const hit = monsters.raycast(origin, aim, length);
    if (hit) {
      length = hit.distance;
      monsters.freeze(hit.target, FREEZE_TIME);
    }
    showHits(hit ? 1 : 0, 0);

    // Draw the beam from the gun's tip to wherever it stopped.
    muzzleFlash.getWorldPosition(muzzle);
    beamEnd.copy(origin).addScaledVector(aim, length);
    beam.position.addVectors(muzzle, beamEnd).multiplyScalar(0.5);
    beam.scale.y = muzzle.distanceTo(beamEnd);
    beam.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, direction.subVectors(beamEnd, muzzle).normalize());
    beam.visible = true;
    beamAge = 0;
  }

  function fire() {
    if (!current || sinceSwitch < SWITCH_TIME || current.sinceShot < current.reloadTime) return;
    current.sinceShot = 0;
    camera.getWorldPosition(origin);
    camera.getWorldDirection(aim);
    current.fire();
  }

  function owned() {
    return WEAPONS.filter((weapon) => weapon.owned);
  }

  window.addEventListener('mousedown', (event) => {
    if (event.button === 0 && controls.isLocked) fire();
  });
  window.addEventListener('keydown', (event) => {
    if (!controls.isLocked) return;
    const index = ['Digit1', 'Digit2', 'Digit3'].indexOf(event.code);
    if (index >= 0) equip(WEAPONS[index]);
  });
  window.addEventListener('wheel', (event) => {
    const list = owned();
    if (!controls.isLocked || list.length < 2) return;
    const step = event.deltaY > 0 ? 1 : -1;
    equip(list[(list.indexOf(current) + step + list.length) % list.length]);
  });

  function update(delta, time, playerPosition) {
    for (const weapon of WEAPONS) {
      if (weapon.owned) continue;
      const { pickup } = weapon;
      pickup.position.y = heightAt(pickup.position.x, pickup.position.z) + 0.55 + Math.sin(time * 2) * 0.1;
      weapon.pickupGun.rotation.y = time * 1.2;
      if (Math.hypot(playerPosition.x - pickup.position.x, playerPosition.z - pickup.position.z) < PICKUP_DISTANCE) {
        weapon.owned = true;
        group.remove(pickup);
        equip(weapon);
        const name = weapon.name.toLowerCase();
        showMessage(owned().length === 1 ? `You found a ${name}! Click to fire` : `You found a ${name}! Switch with 1, 2, 3`);
      }
    }

    updateClouds(delta);
    beamAge += delta;
    beamMaterial.opacity = Math.max(0, 1 - beamAge / 0.25);
    beam.visible = beamAge < 0.25;

    if (!current) return;
    for (const weapon of WEAPONS) weapon.sinceShot += delta;
    sinceSwitch += delta;

    // Kick back when fired, then dip down to reload. A new weapon rises
    // into view when switched to.
    const { sinceShot, reloadTime, kick } = current;
    const recoil = Math.exp(-sinceShot * 14) * kick;
    const reload = sinceShot > 0.25 && sinceShot < reloadTime ? Math.sin((Math.PI * (sinceShot - 0.25)) / (reloadTime - 0.25)) : 0;
    const raise = 1 - Math.min(1, sinceSwitch / SWITCH_TIME);
    current.gun.position.set(0, -0.08 * reload - 0.2 * raise, 0.08 * recoil);
    current.gun.rotation.set(0.35 * recoil - 0.3 * reload, 0, 0.4 * reload);

    muzzleFlash.visible = sinceShot < 0.05;
    flashLight.intensity = Math.max(0, 1 - sinceShot / 0.1) * 40;
  }

  // Where the weapons not yet picked up are, for the map.
  function markers() {
    return WEAPONS.filter((weapon) => !weapon.owned).map((weapon) => ({
      x: weapon.pickup.position.x,
      z: weapon.pickup.position.z,
      colour: `#${weapon.glow.toString(16).padStart(6, '0')}`,
    }));
  }

  return { group, update, markers };
}
