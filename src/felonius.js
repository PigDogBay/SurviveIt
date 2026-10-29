import * as THREE from 'three';
import { groundAt, UNDERGROUND } from './dungeon.js';
import { heightAt, TEMPLE } from './terrain.js';

// The cage stands in the woods near the start, its door facing the start.
export const CAGE = { x: 10.4, z: -6 };
const CAGE_RADIUS = 1.2;
export const CAGE_HEIGHT = 2.2;
const BARS = 18;
// Bars this many either side of the one facing the start make the door.
const DOOR_BARS = 1;
// How close the minion must be to the door to unlock it, and to hear Felonius.
const DOOR_REACH = 2.2;
const HEAR_DISTANCE = 6;
const DOOR_OPEN_TIME = 1;

// Felonius stays this close behind the minion, walking to keep up and
// running if he falls behind. If he gets stuck far behind, he catches up.
const FOLLOW_DISTANCE = 2.2;
const WALK_SPEED = 4.5;
const RUN_SPEED = 8;
const CATCH_UP_DISTANCE = 25;
const RADIUS = 0.3;
// He's safe once he's this close to the middle of the temple hall.
const SAFE_DISTANCE = 7;
// How much harm he can take once he's out of the cage.
const HEALTH = 100;

// Felonius, Gru's son: a small boy in a hoodie with cat ears on the hood,
// round glasses, a big smile and a backpack. He faces +z.
function buildFelonius() {
  const skin = new THREE.MeshStandardMaterial({ color: 0xf1c9a0, roughness: 0.7 });
  const hoodie = new THREE.MeshStandardMaterial({ color: 0x2f8f8f, emissive: 0x08201f, roughness: 0.8 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2a3a6a, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5 });
  const backpackRed = new THREE.MeshStandardMaterial({ color: 0xc0392b, emissive: 0x200805, roughness: 0.7 });
  const smileRed = new THREE.MeshBasicMaterial({ color: 0x8a2a2a });

  const boy = new THREE.Group();

  const limb = (geometry, material, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -geometry.parameters.height / 2;
    pivot.add(mesh);
    boy.add(pivot);
    return pivot;
  };
  const legGeometry = new THREE.CylinderGeometry(0.055, 0.05, 0.4, 8);
  const leftLeg = limb(legGeometry, jeans, -0.07, 0.42);
  const rightLeg = limb(legGeometry, jeans, 0.07, 0.42);
  for (const leg of [leftLeg, rightLeg]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.16), dark);
    shoe.position.set(0, -0.4, 0.03);
    leg.add(shoe);
  }

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.24, 4, 12), hoodie);
  body.position.y = 0.62;
  boy.add(body);
  const armGeometry = new THREE.CylinderGeometry(0.045, 0.04, 0.34, 8);
  const leftArm = limb(armGeometry, hoodie, -0.21, 0.8);
  const rightArm = limb(armGeometry, hoodie, 0.21, 0.8);
  for (const arm of [leftArm, rightArm]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin);
    hand.position.y = -0.36;
    arm.add(hand);
  }

  // The hood sits behind the face, with two cat ears on top.
  const headY = 1.0;
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), hoodie);
  hood.position.set(0, headY + 0.02, -0.04);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 12), skin);
  face.position.set(0, headY, 0.04);
  boy.add(hood, face);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), hoodie);
    ear.position.set(side * 0.1, headY + 0.2, -0.03);
    ear.rotation.z = -side * 0.35;
    boy.add(ear);

    // Round glasses with a dark eye behind each lens.
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.009, 6, 16), dark);
    lens.position.set(side * 0.055, headY + 0.03, 0.185);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), dark);
    eye.position.set(side * 0.055, headY + 0.03, 0.18);
    boy.add(lens, eye);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.008, 0.008), dark);
  bridge.position.set(0, headY + 0.035, 0.19);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 12, Math.PI), smileRed);
  smile.rotation.z = Math.PI;
  smile.position.set(0, headY - 0.04, 0.18);
  boy.add(bridge, smile);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.12), backpackRed);
  backpack.position.set(0, 0.66, -0.2);
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.04), backpackRed);
  pocket.position.set(0, 0.58, -0.27);
  boy.add(backpack, pocket);

  boy.traverse((part) => (part.castShadow = true));
  return { boy, leftArm, rightArm, leftLeg, rightLeg };
}

// The cage: iron bars in a circle between a stone base and a domed iron top,
// with a door of bars held shut by a lock in the cage key's colour.
function buildCage(lockColour) {
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3634, emissive: 0x0c0a09, metalness: 0.3, roughness: 0.5 });
  const stoneBase = new THREE.MeshStandardMaterial({ color: 0x6e6858, roughness: 0.95 });
  const cage = new THREE.Group();

  const base = new THREE.Mesh(new THREE.CylinderGeometry(CAGE_RADIUS + 0.15, CAGE_RADIUS + 0.25, 0.2, 24), stoneBase);
  base.position.y = 0.1;
  base.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(CAGE_RADIUS + 0.1, CAGE_RADIUS + 0.1, 0.1, 24), iron);
  top.position.y = CAGE_HEIGHT;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(CAGE_RADIUS + 0.1, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), iron);
  dome.scale.y = 0.4;
  dome.position.y = CAGE_HEIGHT;
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.03, 8, 16), iron);
  hook.position.y = CAGE_HEIGHT + 0.6;
  cage.add(base, top, dome, hook);

  // Bars, numbered round from the one facing +z. The door's bars swing out
  // together about a hinge at one side.
  const barGeometry = new THREE.CylinderGeometry(0.03, 0.03, CAGE_HEIGHT - 0.2, 6);
  const step = (Math.PI * 2) / BARS;
  const hingeAngle = (DOOR_BARS + 0.5) * step;
  const hinge = new THREE.Group();
  hinge.position.set(Math.sin(hingeAngle) * CAGE_RADIUS, 0, Math.cos(hingeAngle) * CAGE_RADIUS);
  cage.add(hinge);
  const door = new THREE.Group();
  door.position.copy(hinge.position).negate();
  hinge.add(door);
  for (let i = 0; i < BARS; i++) {
    const angle = i * step;
    const bar = new THREE.Mesh(barGeometry, iron);
    bar.position.set(Math.sin(angle) * CAGE_RADIUS, CAGE_HEIGHT / 2 + 0.05, Math.cos(angle) * CAGE_RADIUS);
    bar.castShadow = true;
    const inDoor = i <= DOOR_BARS || i >= BARS - DOOR_BARS;
    (inDoor ? door : cage).add(bar);
  }
  // Cross bars on the door, and the lock in the middle of it.
  const doorWidth = 2 * Math.sin((DOOR_BARS + 0.5) * step) * CAGE_RADIUS;
  for (const y of [0.5, 1.7]) {
    const cross = new THREE.Mesh(new THREE.BoxGeometry(doorWidth, 0.05, 0.05), iron);
    cross.position.set(0, y, CAGE_RADIUS + 0.02);
    door.add(cross);
  }
  // Below Felonius's face, so he can be seen through the bars.
  const lockMaterial = new THREE.MeshStandardMaterial({ color: 0x7a2a5a, emissive: lockColour, emissiveIntensity: 0.15, roughness: 0.4 });
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.08), lockMaterial);
  lock.position.set(0, 0.8, CAGE_RADIUS + 0.06);
  const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), new THREE.MeshBasicMaterial({ color: 0x050403 }));
  keyhole.position.set(0, 0.82, CAGE_RADIUS + 0.105);
  door.add(lock, keyhole);
  return { cage, hinge };
}

// The rescue: Felonius is locked in a cage in the woods. The cage key opens
// it, but not while `guarded()` (Chookie is still around), then he follows the
// minion. `onFreed` is called as the cage opens. Once he's free he has
// health, shown in `#felonius-health`: things that attack him call `hurt`,
// and if it runs out `onLost` is called. Once he's safe inside the temple,
// `onSafe` is called.
export function createFelonius({ keys, keyColour, sounds, showMessage, onSafe, onFreed, onLost, guarded }) {
  const group = new THREE.Group();

  const facingStart = Math.atan2(-CAGE.x, -CAGE.z);
  const { cage, hinge } = buildCage(keyColour);
  cage.position.set(CAGE.x, heightAt(CAGE.x, CAGE.z), CAGE.z);
  cage.rotation.y = facingStart;
  group.add(cage);

  // Colliders round the bars: the door's are taken out when it opens.
  const colliders = [];
  const doorColliders = [];
  const rings = 40;
  for (let i = 0; i < rings; i++) {
    const angle = (i / rings) * Math.PI * 2;
    const x = CAGE.x + Math.sin(angle + facingStart) * CAGE_RADIUS;
    const z = CAGE.z + Math.cos(angle + facingStart) * CAGE_RADIUS;
    const collider = { x, z, radius: 0.2, above: heightAt(x, z) - 1.5 };
    colliders.push(collider);
    const fromDoor = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
    if (fromDoor < ((DOOR_BARS + 0.6) * Math.PI * 2) / BARS) doorColliders.push(collider);
  }
  const doorSpot = new THREE.Vector3(CAGE.x + Math.sin(facingStart) * (CAGE_RADIUS + 0.5), 0, CAGE.z + Math.cos(facingStart) * (CAGE_RADIUS + 0.5));
  const outside = new THREE.Vector3(CAGE.x + Math.sin(facingStart) * (CAGE_RADIUS + 1.8), 0, CAGE.z + Math.cos(facingStart) * (CAGE_RADIUS + 1.8));

  const { boy, leftArm, rightArm, leftLeg, rightLeg } = buildFelonius();
  const position = boy.position;
  position.set(CAGE.x, heightAt(CAGE.x, CAGE.z) + 0.2, CAGE.z);
  boy.rotation.y = facingStart;
  group.add(boy);

  // 'caged', then 'opening' while the door swings, 'leaving' while he steps
  // out, 'following', and finally 'safe'.
  let state = 'caged';
  let opening = 0;
  let stride = 0;
  let heard = false;
  let toldGuarded = false;
  let health = HEALTH;
  let hurtFlash = 0;
  const bar = document.getElementById('felonius-health');
  const barFill = bar.querySelector('.fill');

  function walkTowards(target, speed, delta, collisions) {
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const distance = Math.hypot(dx, dz);
    const move = Math.min(distance, speed * delta);
    if (distance > 0.01) {
      position.x += (dx / distance) * move;
      position.z += (dz / distance) * move;
      const heading = Math.atan2(dx, dz);
      const turn = Math.atan2(Math.sin(heading - boy.rotation.y), Math.cos(heading - boy.rotation.y));
      boy.rotation.y += turn * Math.min(1, delta * 10);
    }
    collisions.pushOut(position, RADIUS);
    // Stays on the ground, down stairs and into the dungeons too.
    const ground = groundAt(position.x, position.y, position.z);
    position.y = ground < position.y ? Math.max(ground, position.y - 12 * delta) : ground;
    return move / Math.max(delta, 1e-6);
  }

  function update(delta, time, playerPosition, collisions) {
    let speed = 0;
    // Shrinks back for a moment when hit.
    if (hurtFlash > 0) {
      hurtFlash -= delta;
      if (hurtFlash <= 0) boy.scale.setScalar(1);
    }
    if (state === 'caged') {
      // Waves for help.
      leftArm.rotation.z = -2.6 + Math.sin(time * 6) * 0.4;
      rightArm.rotation.z = 2.6 - Math.sin(time * 6 + 1) * 0.4;
      const distance = Math.hypot(playerPosition.x - CAGE.x, playerPosition.z - CAGE.z);
      if (distance < HEAR_DISTANCE && !heard) {
        heard = true;
        showMessage(keys.has('cage') ? 'Felonius: "Help! Get me out of here!"' : 'Felonius: "Help! Find the cage key and get me out!"');
      } else if (distance > HEAR_DISTANCE + 2) {
        heard = false;
        toldGuarded = false;
      }
      const atDoor = Math.hypot(playerPosition.x - doorSpot.x, playerPosition.z - doorSpot.z) < DOOR_REACH;
      if (atDoor && keys.has('cage') && guarded()) {
        if (!toldGuarded) showMessage('Chookie is guarding the cage! Defeat Chookie first');
        toldGuarded = true;
      } else if (atDoor && keys.has('cage')) {
        keys.use('cage');
        collisions.remove(doorColliders);
        sounds.click();
        sounds.chime();
        showMessage('You freed Felonius! Lead him back to the temple');
        state = 'opening';
        bar.classList.remove('hidden');
        onFreed();
      }
    } else if (state === 'opening') {
      opening = Math.min(1, opening + delta / DOOR_OPEN_TIME);
      hinge.rotation.y = 1.9 * (1 - (1 - opening) * (1 - opening));
      leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z, 0, delta * 6);
      rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, 0, delta * 6);
      if (opening === 1) state = 'leaving';
    } else if (state === 'leaving') {
      speed = walkTowards(outside, WALK_SPEED, delta, collisions);
      if (Math.hypot(position.x - outside.x, position.z - outside.z) < 0.2) state = 'following';
    } else if (state === 'following') {
      const feet = playerPosition.y - 1.25;
      const distance = Math.hypot(playerPosition.x - position.x, playerPosition.z - position.z);
      if (distance > CATCH_UP_DISTANCE || Math.abs(feet - position.y) > 6) {
        // Stuck far behind: pop up just behind the minion.
        position.set(playerPosition.x, feet, playerPosition.z);
        collisions.pushOut(position, RADIUS);
      } else if (distance > FOLLOW_DISTANCE) {
        speed = walkTowards(playerPosition, distance > 6 ? RUN_SPEED : WALK_SPEED, delta, collisions);
      }
      const fromTemple = Math.hypot(position.x - TEMPLE.x, position.z - TEMPLE.z);
      if (fromTemple < SAFE_DISTANCE && position.y >= UNDERGROUND) {
        state = 'safe';
        bar.classList.add('hidden');
        onSafe();
      }
    }

    // Swing arms and legs in time with walking.
    stride += delta * speed * 2.5;
    const swing = Math.sin(stride) * Math.min(1, speed / 3) * 0.6;
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;
    if (state !== 'caged') {
      leftArm.rotation.x = -swing * 0.8;
      rightArm.rotation.x = swing * 0.8;
    }
  }

  // Something hit Felonius. Only counts once he's out of the cage.
  function hurt(amount) {
    if (state !== 'leaving' && state !== 'following') return;
    health = Math.max(0, health - amount);
    barFill.style.width = `${(health / HEALTH) * 100}%`;
    hurtFlash = 0.15;
    boy.scale.setScalar(0.85);
    sounds.ouch();
    if (health === 0) {
      state = 'lost';
      bar.classList.add('hidden');
      onLost();
    }
  }

  // The cage (while Felonius is inside) and Felonius (once he's out), for the map.
  function markers() {
    if (state === 'caged') return [{ x: CAGE.x, z: CAGE.z, kind: 'cage' }];
    return [{ x: position.x, z: position.z, kind: 'felonius' }];
  }

  return {
    group,
    colliders,
    update,
    markers,
    // 'caged', 'opening', 'leaving', 'following', 'safe' or 'lost'.
    status: () => state,
    door: doorSpot,
    hurt,
    // Where his feet are.
    where: () => position,
  };
}
