import * as THREE from 'three';
import { DUNGEON_PICKUPS } from './dungeon.js';
import { heightAt } from './terrain.js';
import { buildBlunderbuss, buildFartGun, buildFlamethrower, buildFreezeRay, buildSword, buildTaki, buildTakiGun } from './weapon-models.js';

const PICKUP_DISTANCE = 1.4;
const SWITCH_TIME = 0.25;

// Blunderbuss: a spray of pellets, each doing 1 damage. The bang wakes up
// monsters nearby.
const PELLETS = 9;
// How far pellets scatter from the crosshair, in radians.
const SPREAD = 0.07;
const BLUNDERBUSS_RANGE = 30;
const WAKE_DISTANCE = 50;

// Fart gun: a big cloud of gas that hurts and chokes monsters inside it.
const CLOUD_DISTANCE = 7;
const CLOUD_RADIUS = 6;
const CLOUD_TIME = 4;
const CLOUD_TICK = 0.5;

// Freeze ray: a beam that turns one monster to ice. Walking into a frozen
// monster shatters it.
const FREEZE_RANGE = 40;
const FREEZE_TIME = 2;

// Flamethrower: hold the button to spray fire. Every monster in the spray
// takes 1 damage each time the flamethrower fires (its reload time).
const FLAME_RANGE = 7;
// How wide the spray is: the cosine of the angle either side of the crosshair.
const FLAME_WIDTH = Math.cos(0.3);
const FLAME_SPEED = 14;
// Flames shot out each second while the button is held.
const FLAMES_PER_SECOND = 60;

// Sword: a wide swing that kills every monster within reach in front with
// one hit (a monster has 6 health).
const SWORD_REACH = 2.6;
const SWORD_WIDTH = Math.cos(1);
const SWORD_DAMAGE = 6;
const SWING_TIME = 0.3;

// Taki gun: shoots spicy rolled Takis that fly through the air. One in the
// eyes blinds a monster for a while; it does no damage.
const TAKI_SPEED = 32;
const TAKI_RANGE = 40;
const TAKI_DROP = 3;
const BLIND_TIME = 6;

// In the order of the number keys that select them. The blunderbuss lies
// just ahead of the start; the freeze ray and the fart gun are in the
// dungeons; the others are further out in the woods.
// `ammo` is how many shots a weapon comes with, the most it can carry, and
// how many an ammo box adds. The flamethrower uses 1 each time it fires,
// every 0.3 s. The sword needs no ammo.
const WEAPONS = [
  {
    name: 'Blunderbuss',
    spot: [-2, -7],
    glow: 0xffa040,
    build: buildBlunderbuss,
    muzzle: -0.62,
    reloadTime: 1.1,
    kick: 1,
    ammo: { start: 12, max: 30, box: 8 },
  },
  {
    name: 'Fart gun',
    spot: DUNGEON_PICKUPS.fartGun,
    glow: 0x9be04a,
    build: buildFartGun,
    muzzle: -0.46,
    reloadTime: 2,
    kick: 0.6,
    ammo: { start: 6, max: 15, box: 4 },
  },
  {
    name: 'Freeze ray',
    spot: DUNGEON_PICKUPS.freezeRay,
    glow: 0x7fe8ff,
    build: buildFreezeRay,
    muzzle: -0.4,
    reloadTime: 1.5,
    kick: 0.3,
    ammo: { start: 6, max: 15, box: 4 },
  },
  {
    name: 'Flamethrower',
    spot: [55, 15],
    glow: 0xff6a20,
    build: buildFlamethrower,
    muzzle: -0.43,
    reloadTime: 0.3,
    kick: 0.1,
    hold: true,
    ammo: { start: 40, max: 100, box: 30 },
  },
  { name: 'Sword', spot: [14, 16], glow: 0xd8e4ff, build: buildSword, muzzle: -0.6, reloadTime: 0.6, kick: 0, swing: true },
  {
    name: 'Taki gun',
    spot: [28, -32],
    glow: 0xff2a6a,
    build: buildTakiGun,
    muzzle: -0.39,
    reloadTime: 0.35,
    kick: 0.25,
    ammo: { start: 20, max: 50, box: 12 },
    // Takis is a name, so it keeps its capital letter in messages.
    properName: true,
  },
];

// A weapon's name in the middle of a sentence.
const inSentence = (weapon) => (weapon.properName ? weapon.name : weapon.name.toLowerCase());

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

// A soft blob of fire, white-hot in the middle. Tinted yellow to red as it burns out.
function flameTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const fire = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  fire.addColorStop(0, 'rgba(255,255,255,1)');
  fire.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  fire.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fire;
  ctx.fillRect(0, 0, 64, 64);
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
    // A spot with `y` (in the dungeon) is used as it is, and stays off the map.
    weapon.hidden = weapon.spot.y !== undefined;
    const [x, z] = weapon.hidden ? [weapon.spot.x, weapon.spot.z] : weapon.spot;
    const spot = new THREE.Vector3(x, heightAt(x, z), z);
    if (!weapon.hidden) collisions.pushOut(spot, 1);
    weapon.floor = weapon.hidden ? weapon.spot.y : heightAt(spot.x, spot.z);
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
    weapon.pickup.position.set(spot.x, weapon.floor + 0.55, spot.z);
    weapon.pickupGun = pickupGun;
    group.add(weapon.pickup);

    weapon.gun = weapon.build();
    weapon.gun.visible = false;
    held.add(weapon.gun);
    weapon.owned = false;
    weapon.rounds = 0;
    weapon.sinceShot = weapon.reloadTime;
  }
  WEAPONS[0].fire = fireBlunderbuss;
  WEAPONS[1].fire = fireFartGun;
  WEAPONS[2].fire = fireFreezeRay;
  WEAPONS[3].fire = fireFlamethrower;
  WEAPONS[4].fire = swingSword;
  WEAPONS[5].fire = fireTakiGun;

  let current = null;
  let sinceSwitch = SWITCH_TIME;

  const slots = document.getElementById('weapons');
  function renderSlots() {
    slots.innerHTML = WEAPONS.map((weapon, i) =>
      weapon.owned
        ? `<span class="slot${weapon === current ? ' active' : ''}"><kbd>${i + 1}</kbd>${weapon.name}` +
          `<span class="ammo${weapon.ammo && weapon.rounds === 0 ? ' empty' : ''}">${weapon.ammo ? weapon.rounds : '∞'}</span></span>`
        : '',
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
    // About 1 m off the ground, wherever the minion is standing, even in the dungeon.
    centre.y = origin.y - 0.25;

    const cloud = new THREE.Group();
    cloud.position.copy(centre);
    const material = new THREE.SpriteMaterial({ map: gas, depthWrite: false, opacity: 0 });
    // Puffs spread right across the cloud, so it looks as big as it hurts.
    for (let i = 0; i < 24; i++) {
      const puff = new THREE.Sprite(material);
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.sqrt(Math.random()) * CLOUD_RADIUS * 0.85;
      puff.position.set(Math.cos(angle) * spread, (Math.random() - 0.3) * 1.6, Math.sin(angle) * spread);
      puff.userData.size = 2.6 + Math.random() * 2;
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

  // Hurts every monster within `reach` in front of the minion, unless a tree
  // is in the way. Returns how many were hit.
  const flatAim = new THREE.Vector3();
  const towards = new THREE.Vector3();
  function hitInFront(reach, width, damage) {
    flatAim.copy(aim).setY(0).normalize();
    let hits = 0;
    let kills = 0;
    for (const target of monsters.near(origin, reach)) {
      towards.subVectors(target.monster.position, origin).setY(0);
      const distance = towards.length();
      towards.normalize();
      // Right up close counts as in front, whichever way it's standing.
      if (distance > 1 && towards.dot(flatAim) < width) continue;
      if (collisions.rayDistance(origin, towards, distance) < distance) continue;
      hits++;
      if (monsters.hurt(target, damage, towards)) kills++;
    }
    showHits(hits, kills);
    return hits;
  }

  function fireFlamethrower() {
    sounds.flame();
    hitInFront(FLAME_RANGE, FLAME_WIDTH, 1);
  }

  const flameMap = flameTexture();
  const flames = [];
  const hotColour = new THREE.Color(0xffa040);
  const coolColour = new THREE.Color(0xa01800);
  let flamesDue = 0;

  // Flames shoot out of the nozzle while the button is held, rising and
  // fading as they go. They stop at the first tree.
  function updateFlames(delta, spraying) {
    if (spraying) {
      camera.getWorldPosition(origin);
      camera.getWorldDirection(aim);
      muzzleFlash.getWorldPosition(muzzle);
      const life = Math.min(FLAME_RANGE, clearDistance(origin, aim, FLAME_RANGE)) / FLAME_SPEED;
      for (flamesDue += delta * FLAMES_PER_SECOND; flamesDue >= 1; flamesDue--) {
        const flame = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: flameMap, depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        flame.position.copy(muzzle);
        flame.userData.velocity = aim
          .clone()
          .multiplyScalar(FLAME_SPEED * (0.8 + Math.random() * 0.3))
          .add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2.5));
        flame.userData.age = Math.random() * 0.03;
        flame.userData.life = life;
        group.add(flame);
        flames.push(flame);
      }
    } else {
      flamesDue = 0;
    }

    for (let i = flames.length - 1; i >= 0; i--) {
      const flame = flames[i];
      const data = flame.userData;
      data.age += delta;
      const burnt = data.age / data.life;
      if (burnt >= 1) {
        group.remove(flame);
        flame.material.dispose();
        flames.splice(i, 1);
        continue;
      }
      data.velocity.y += delta * 3;
      flame.position.addScaledVector(data.velocity, delta);
      flame.scale.setScalar(0.2 + burnt * 1.8);
      flame.material.color.lerpColors(hotColour, coolColour, burnt);
      flame.material.opacity = 0.5 * (1 - burnt * burnt);
      flame.material.rotation += delta * 3;
    }
  }

  // Takis in flight. Each one spins as it goes and drops a little, and stops
  // at the first tree or monster in its way.
  const takis = [];
  function fireTakiGun() {
    sounds.pop();
    const taki = new THREE.Group();
    taki.add(buildTaki());
    muzzleFlash.getWorldPosition(taki.position);
    taki.userData = { velocity: aim.clone().multiplyScalar(TAKI_SPEED), travelled: 0 };
    group.add(taki);
    takis.push(taki);
  }

  const takiStep = new THREE.Vector3();
  const takiDirection = new THREE.Vector3();
  function updateTakis(delta) {
    for (let i = takis.length - 1; i >= 0; i--) {
      const taki = takis[i];
      const { velocity } = taki.userData;
      velocity.y -= TAKI_DROP * delta;
      takiStep.copy(velocity).multiplyScalar(delta);
      const length = takiStep.length();
      takiDirection.copy(takiStep).normalize();
      const blocked = collisions.rayDistance(taki.position, takiDirection, length) < length;
      const hit = monsters.raycast(taki.position, takiDirection, length);
      taki.userData.travelled += length;
      if (hit && !blocked) {
        monsters.blind(hit.target, BLIND_TIME);
        sounds.crunch();
        showHits(1, 0);
      }
      if (hit || blocked || taki.userData.travelled > TAKI_RANGE) {
        group.remove(taki);
        takis.splice(i, 1);
        continue;
      }
      taki.position.add(takiStep);
      taki.lookAt(takiDirection.add(taki.position));
      taki.children[0].rotation.z += delta * 25;
    }
  }

  function swingSword() {
    sounds.swish();
    if (hitInFront(SWORD_REACH, SWORD_WIDTH, SWORD_DAMAGE) > 0) sounds.thwack();
  }

  const outOfAmmo = (weapon) => `The ${inSentence(weapon)} is out of ammo! Find an ammo box`;

  function fire() {
    if (!current || sinceSwitch < SWITCH_TIME || current.sinceShot < current.reloadTime) return;
    current.sinceShot = 0;
    if (current.ammo) {
      if (current.rounds === 0) {
        sounds.click();
        showMessage(outOfAmmo(current));
        return;
      }
      current.rounds--;
      renderSlots();
      if (current.rounds === 0) showMessage(outOfAmmo(current));
    }
    camera.getWorldPosition(origin);
    camera.getWorldDirection(aim);
    current.fire();
  }

  function owned() {
    return WEAPONS.filter((weapon) => weapon.owned);
  }

  // The flamethrower keeps going for as long as the button is held.
  let triggerHeld = false;
  window.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || !controls.isLocked) return;
    triggerHeld = true;
    fire();
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) triggerHeld = false;
  });
  controls.addEventListener('unlock', () => (triggerHeld = false));
  window.addEventListener('keydown', (event) => {
    if (!controls.isLocked) return;
    const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(event.code);
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
      pickup.position.y = weapon.floor + 0.55 + Math.sin(time * 2) * 0.1;
      weapon.pickupGun.rotation.y = time * 1.2;
      const sameLevel = Math.abs(playerPosition.y - pickup.position.y) < 2;
      if (sameLevel && Math.hypot(playerPosition.x - pickup.position.x, playerPosition.z - pickup.position.z) < PICKUP_DISTANCE) {
        weapon.owned = true;
        if (weapon.ammo) weapon.rounds = weapon.ammo.start;
        group.remove(pickup);
        equip(weapon);
        const name = inSentence(weapon);
        const how = weapon.hold ? 'Hold click to spray fire' : weapon.swing ? 'Click to swing' : 'Click to fire';
        showMessage(`You found a ${name}! ${owned().length === 1 || how !== 'Click to fire' ? how : 'Switch with the number keys'}`);
      }
    }

    updateClouds(delta);
    beamAge += delta;
    beamMaterial.opacity = Math.max(0, 1 - beamAge / 0.25);
    beam.visible = beamAge < 0.25;

    const spraying = Boolean(current?.hold && triggerHeld && sinceSwitch >= SWITCH_TIME && current.rounds > 0);
    updateFlames(delta, spraying);
    updateTakis(delta);

    if (!current) return;
    for (const weapon of WEAPONS) weapon.sinceShot += delta;
    sinceSwitch += delta;
    if (spraying) fire();

    // Kick back when fired, then dip down to reload. A new weapon rises
    // into view when switched to.
    const { sinceShot, reloadTime, kick } = current;
    const raise = 1 - Math.min(1, sinceSwitch / SWITCH_TIME);
    muzzleFlash.visible = current.hold ? spraying : !current.swing && sinceShot < 0.05;
    if (current.hold) flashLight.intensity = spraying ? 15 + Math.random() * 15 : 0;
    else flashLight.intensity = current.swing ? 0 : Math.max(0, 1 - sinceShot / 0.1) * 40;

    if (current.swing) {
      // Held up and ready, then slashed down and across to the left, and back.
      const slash =
        sinceShot < SWING_TIME
          ? Math.sin(((sinceShot / SWING_TIME) * Math.PI) / 2)
          : Math.max(0, 1 - (sinceShot - SWING_TIME) / (reloadTime - SWING_TIME));
      current.gun.position.set(-0.12 * slash, 0.02 - 0.05 * slash - 0.25 * raise, -0.05 * slash);
      current.gun.rotation.set(1.1 - 1.3 * slash, 0.9 * slash, 0.35 - 0.9 * slash);
      return;
    }

    const recoil = Math.exp(-sinceShot * 14) * kick;
    const reload = sinceShot > 0.25 && sinceShot < reloadTime ? Math.sin((Math.PI * (sinceShot - 0.25)) / (reloadTime - 0.25)) : 0;
    current.gun.position.set(0, -0.08 * reload - 0.2 * raise, 0.08 * recoil);
    current.gun.rotation.set(0.35 * recoil - 0.3 * reload, 0, 0.4 * reload);
  }

  // Where the weapons not yet picked up are, for the map.
  function markers() {
    return WEAPONS.filter((weapon) => !weapon.owned && !weapon.hidden).map((weapon) => ({
      x: weapon.pickup.position.x,
      z: weapon.pickup.position.z,
      colour: `#${weapon.glow.toString(16).padStart(6, '0')}`,
    }));
  }

  // An ammo box: tops up every weapon the minion has that isn't full.
  // Returns what was added, such as ['Blunderbuss +8'], or null if nothing needed it.
  function refill() {
    const added = [];
    for (const weapon of owned()) {
      if (!weapon.ammo || weapon.rounds >= weapon.ammo.max) continue;
      const amount = Math.min(weapon.ammo.box, weapon.ammo.max - weapon.rounds);
      weapon.rounds += amount;
      added.push(`${weapon.name} +${amount}`);
    }
    if (added.length === 0) return null;
    sounds.reload();
    renderSlots();
    return added;
  }

  return {
    group,
    update,
    markers,
    refill,
    // Whether the minion has any weapon that uses ammo.
    needsAmmo: () => owned().some((weapon) => weapon.ammo),
    hasAny: () => owned().length > 0,
    // Where a weapon lies, by name.
    where: (name) => WEAPONS.find((weapon) => weapon.name === name).pickup.position,
  };
}
