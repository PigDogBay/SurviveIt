import * as THREE from 'three';
import { rayCircle } from './collision.js';
import { isUnderground } from './dungeon.js';
import { fireMaterial } from './monsters.js';
import { CAGE, CAGE_HEIGHT } from './felonius.js';
import { heightAt } from './terrain.js';

const HEALTH = 80;
// Chookie wakes when the minion comes this close carrying the cage key.
const WAKE_DISTANCE = 14;
// Warns the minion off while still asleep, this close.
const WARN_DISTANCE = 11;
const RADIUS = 1.1;
// The part of Chookie that shots can hit: a tall circle from its knees up.
const HIT_RADIUS = 1.3;
const HIT_BOTTOM = 0.8;
const HIT_TOP = 4.4;

// On the ground Chookie stalks the minion a little slower than they walk, and
// pecks with all three heads when close.
const STALK_SPEED = 3.5;
const STALK_TIME = 6;
const PECK_REACH = 3;
const PECK_DAMAGE = 20;
const PECK_COOLDOWN = 1.4;
// Then it flies up, circles overhead, and dives at where the minion stood.
const FLY_HEIGHT = 8;
const CIRCLE_RADIUS = 9;
const CIRCLE_TIME = 3;
const AIM_TIME = 0.7;
const DIVE_SPEED = 22;
const DIVE_HIT = 2.6;
const DIVE_DAMAGE = 30;
// After landing from a dive it's dazed for a moment: the best time to hit it.
const STUNNED_TIME = 2.2;
// Set alight, it loses BURN_DAMAGE every BURN_TICK while it burns.
const BURN_TICK = 0.5;
const BURN_DAMAGE = 1;
const FLYING = ['rising', 'circling', 'aiming', 'diving', 'landing'];

// Chookie, from Henry's drawing: a huge brown bird with pink legs and necks,
// blue and pink markings, and three heads with hooked beaks and red eyes.
// Faces +z with its feet at y = 0.
function buildChookie() {
  const brown = new THREE.MeshStandardMaterial({ color: 0x6b4226, emissive: 0x1a0c04, roughness: 0.85 });
  const lightBrown = new THREE.MeshStandardMaterial({ color: 0x9a6a42, emissive: 0x1a0c04, roughness: 0.85 });
  const pink = new THREE.MeshStandardMaterial({ color: 0xe8709e, emissive: 0x2a0a18, roughness: 0.7 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x3a7bd5, emissive: 0x0a1a3a, roughness: 0.6 });
  const beak = new THREE.MeshStandardMaterial({ color: 0xf0a020, emissive: 0x3a2000, roughness: 0.5 });
  const talon = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.5 });
  const eyes = new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false });

  const chookie = new THREE.Group();
  chookie.rotation.order = 'YXZ';
  const add = (parent, geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // Long pink legs from the hips, with three talons on each foot.
  const legs = [-0.4, 0.4].map((x) => {
    const hip = new THREE.Group();
    hip.position.set(x, 1.8, 0);
    chookie.add(hip);
    add(hip, new THREE.CylinderGeometry(0.1, 0.08, 1.8, 8), pink, 0, -0.9, 0);
    for (const turn of [-0.5, 0, 0.5]) {
      const toe = add(hip, new THREE.ConeGeometry(0.06, 0.45, 6).rotateX(Math.PI / 2), talon, Math.sin(turn) * 0.15, -1.75, 0.2 + Math.cos(turn) * 0.1);
      toe.rotation.y = turn;
    }
    return hip;
  });

  // A big round body, with a paler belly and stripes of blue and pink.
  const body = add(chookie, new THREE.SphereGeometry(1, 20, 16), brown, 0, 2.6, 0);
  body.scale.set(0.95, 0.85, 1.3);
  const belly = add(chookie, new THREE.SphereGeometry(0.8, 16, 12), lightBrown, 0, 2.35, 0.45);
  belly.scale.set(0.9, 0.8, 0.9);
  [blue, pink, blue].forEach((material, i) => {
    const stripe = add(chookie, new THREE.SphereGeometry(0.9, 16, 8), material, 0, 3.3 - i * 0.05, -0.4 + i * 0.45);
    stripe.scale.set(0.9, 0.12, 0.3);
  });

  // Wings at the shoulders, with blue feather tips. They fold along its sides.
  const wings = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.8, 3, 0.1);
    chookie.add(shoulder);
    add(shoulder, new THREE.BoxGeometry(1.9, 0.1, 1.1), brown, side * 0.95, 0, 0);
    add(shoulder, new THREE.BoxGeometry(0.9, 0.11, 0.25), pink, side * 0.8, 0.01, 0.3);
    for (let i = 0; i < 4; i++) add(shoulder, new THREE.BoxGeometry(0.5, 0.08, 0.28), blue, side * (1.95 + i * 0.05), 0, 0.35 - i * 0.28);
    return shoulder;
  });

  // A fan of tail feathers.
  for (let i = -2; i <= 2; i++) {
    const feather = add(chookie, new THREE.BoxGeometry(0.28, 0.06, 1.3), i % 2 ? blue : brown, i * 0.22, 2.75, -1.6);
    feather.rotation.set(-0.4, i * 0.18, 0);
  }

  // Three pink necks, each with a head: hooked beak, red eyes, angry brows
  // and a little pink crest.
  const necks = [-0.4, 0, 0.4].map((x) => {
    const neck = new THREE.Group();
    neck.position.set(x, 3.1, 0.95);
    neck.rotation.z = -x * 0.9;
    chookie.add(neck);
    add(neck, new THREE.CylinderGeometry(0.1, 0.15, 1.3, 10), pink, 0, 0.65, 0);
    const head = new THREE.Group();
    head.position.y = 1.35;
    neck.add(head);
    const skull = add(head, new THREE.SphereGeometry(0.3, 14, 10), brown, 0, 0, 0);
    skull.scale.set(1, 0.95, 1.2);
    const hooked = add(head, new THREE.ConeGeometry(0.11, 0.5, 8).rotateX(Math.PI / 2), beak, 0, -0.04, 0.5);
    hooked.rotation.x = 0.25;
    for (const side of [-1, 1]) {
      add(head, new THREE.SphereGeometry(0.055, 8, 6), eyes, side * 0.17, 0.07, 0.2);
      const brow = add(head, new THREE.BoxGeometry(0.16, 0.04, 0.05), talon, side * 0.16, 0.16, 0.23);
      brow.rotation.z = side * 0.45;
    }
    for (let i = 0; i < 3; i++) {
      const crest = add(head, new THREE.ConeGeometry(0.05, 0.25, 5), pink, 0, 0.32, -0.1 - i * 0.12);
      crest.rotation.x = -0.5;
    }
    return neck;
  });

  return { chookie, legs, wings, necks, eyes, materials: [brown, lightBrown, pink, blue, beak, talon] };
}

// "Zzz" floating up from the sleeping bird.
function snoreSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4e8ff';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('Z', 4, 56);
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('z', 44, 40);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('z', 76, 24);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), depthWrite: false, fog: false }));
  sprite.scale.set(1.6, 0.8, 1);
  return sprite;
}

// Chookie, the final boss. It sleeps on Felonius's cage until the minion comes
// near with the cage key (or attacks it), then fights. The cage can't be
// opened until Chookie is beaten.
export function createChookie({ keys, sounds, showMessage }) {
  const group = new THREE.Group();
  const { chookie, legs, wings, necks, eyes, materials } = buildChookie();
  group.add(chookie);
  const position = chookie.position;
  // Asleep, it sits on the cage's dome with its legs tucked under it.
  const perchY = heightAt(CAGE.x, CAGE.z) + CAGE_HEIGHT - 1.2;
  position.set(CAGE.x, perchY, CAGE.z);
  chookie.rotation.y = Math.atan2(-CAGE.x, -CAGE.z);
  const zzz = snoreSprite();
  group.add(zzz);

  // Frozen, Chookie turns to ice: every part swaps to the ice material.
  const ice = new THREE.MeshStandardMaterial({ color: 0xa8dcff, emissive: 0x1a4a6a, roughness: 0.15 });
  chookie.traverse((part) => {
    if (materials.includes(part.material)) part.userData.material = part.material;
  });
  function setIce(on) {
    chookie.traverse((part) => {
      if (part.userData.material) part.material = on ? ice : part.userData.material;
    });
  }
  const setEyes = (open) => chookie.traverse((part) => part.material === eyes && (part.visible = open));
  setEyes(false);

  const bossBar = document.getElementById('boss');
  const bossFill = bossBar.querySelector('.fill');

  // The one target the weapons see. `monster` is what they read the position from.
  const self = { monster: chookie };
  let state = 'asleep';
  let health = HEALTH;
  let timer = 0;
  let orbit = 0;
  let frozen = 0;
  let blind = 0;
  let attackTimer = 0;
  let peckTimer = 0;
  let hurtFlash = 0;
  let burning = 0;
  let burnTick = 0;
  let fire = null;
  let stride = 0;
  let snoreTimer = 0;
  let warned = false;
  let sinceCaw = 1;
  const diveTarget = new THREE.Vector3();
  const flyTo = new THREE.Vector3();

  function caw(volume = 1, length = 0.5) {
    if (sinceCaw < 0.4 && length <= 0.5) return;
    sinceCaw = 0;
    sounds.caw(volume, length);
  }

  function wake() {
    state = 'rising';
    timer = 0;
    zzz.visible = false;
    setEyes(blind <= 0);
    bossBar.classList.remove('hidden');
    caw(1, 0.9);
    sounds.flap();
    showMessage('Chookie wakes up! Defeat Chookie to free Felonius!');
    // Stands up off the cage before taking off.
    position.y = heightAt(CAGE.x, CAGE.z) + CAGE_HEIGHT + 0.3;
  }

  function face(x, z, delta, rate = 6) {
    const heading = Math.atan2(x - position.x, z - position.z);
    const turn = Math.atan2(Math.sin(heading - chookie.rotation.y), Math.cos(heading - chookie.rotation.y));
    chookie.rotation.y += turn * Math.min(1, delta * rate);
  }

  // Flies straight towards a point, facing the way it's going.
  function flyTowards(point, speed, delta) {
    const step = flyTo.subVectors(point, position);
    const distance = step.length();
    if (distance > 0.01) {
      position.addScaledVector(step, Math.min(1, (speed * delta) / distance));
      face(point.x, point.z, delta);
    }
    return distance;
  }

  // Walks on the ground towards a point, around trees.
  function walkTowards(x, z, speed, delta, collisions) {
    const dx = x - position.x;
    const dz = z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > 0.05) {
      position.x += (dx / distance) * Math.min(distance, speed * delta);
      position.z += (dz / distance) * Math.min(distance, speed * delta);
      face(x, z, delta);
    }
    collisions.pushOut(position, RADIUS, true);
    position.y = heightAt(position.x, position.z);
    stride += delta * speed * 1.6;
  }

  function update(delta, time, playerPosition, minionHealth, collisions) {
    if (state === 'gone') return;
    sinceCaw += delta;
    if (burning > 0) burn(delta);
    attackTimer -= delta;
    peckTimer -= delta;
    hurtFlash -= delta;
    for (const material of materials) material.emissiveIntensity = hurtFlash > 0 ? 6 : 1;

    const hidden = isUnderground(playerPosition);
    const feet = playerPosition.y - 1.25;
    const toPlayer = Math.hypot(playerPosition.x - position.x, playerPosition.z - position.z);
    const ground = heightAt(position.x, position.z);
    const flying = FLYING.includes(state);

    if (state === 'asleep') {
      // Snores, with "Zzz" drifting up, and warns the minion off.
      zzz.position.set(position.x + 0.6, position.y + 5 + ((time * 0.4) % 1) * 0.8, position.z);
      zzz.material.opacity = 1 - ((time * 0.4) % 1);
      snoreTimer -= delta;
      if (snoreTimer <= 0 && toPlayer < 25) {
        sounds.snore();
        snoreTimer = 3.2;
      }
      if (keys.has('cage') && toPlayer < WAKE_DISTANCE && !hidden) {
        wake();
      } else if (toPlayer < WARN_DISTANCE && !warned) {
        warned = true;
        showMessage('Shh! Chookie is asleep on the cage. Come back with the cage key, ready to fight!');
      } else if (toPlayer > WARN_DISTANCE + 4) {
        warned = false;
      }
      pose(time, delta);
      return;
    }

    if (state === 'dying') {
      timer += delta;
      const fall = Math.min(1, timer / 0.8);
      chookie.rotation.x = -(Math.PI / 2) * fall * fall;
      position.y = Math.max(ground - (timer > 2.5 ? (timer - 2.5) * 0.8 : 0), position.y - 12 * delta);
      if (timer > 6) {
        group.remove(chookie);
        state = 'gone';
      }
      return;
    }

    if (frozen > 0) {
      // Frozen solid: drops out of the sky and can't do anything.
      frozen -= delta;
      position.y = Math.max(ground, position.y - 12 * delta);
      if (frozen <= 0) {
        setIce(false);
        if (flying) state = 'stalking';
        timer = 0;
      }
      return;
    }

    if (blind > 0) {
      blind -= delta;
      if (blind <= 0) setEyes(true);
      // Can't see to dive, so it comes down.
      if (flying && state !== 'landing') state = 'landing';
    }

    if (state === 'rising') {
      timer += delta;
      flyTo.set(playerPosition.x, heightAt(playerPosition.x, playerPosition.z) + FLY_HEIGHT, playerPosition.z);
      flyTowards(flyTo, 9, delta);
      if (timer > 1.5) {
        state = 'circling';
        timer = 0;
        orbit = Math.atan2(position.z - playerPosition.z, position.x - playerPosition.x);
      }
    } else if (state === 'circling') {
      timer += delta;
      orbit += delta * 0.9;
      const point = new THREE.Vector3(
        playerPosition.x + Math.cos(orbit) * CIRCLE_RADIUS,
        heightAt(playerPosition.x, playerPosition.z) + FLY_HEIGHT,
        playerPosition.z + Math.sin(orbit) * CIRCLE_RADIUS,
      );
      flyTowards(point, 16, delta);
      if (timer > CIRCLE_TIME) {
        timer = 0;
        state = hidden ? 'landing' : 'aiming';
        if (!hidden) caw(1, 0.6);
      }
    } else if (state === 'aiming') {
      // Hovers, glaring, then locks on to where the minion is standing.
      timer += delta;
      face(playerPosition.x, playerPosition.z, delta, 10);
      if (timer > AIM_TIME) {
        diveTarget.set(playerPosition.x, heightAt(playerPosition.x, playerPosition.z), playerPosition.z);
        state = 'diving';
        sounds.flap();
      }
    } else if (state === 'diving') {
      const distance = flyTowards(diveTarget, DIVE_SPEED, delta);
      if (distance < 0.6 || position.y <= heightAt(position.x, position.z)) {
        position.y = heightAt(position.x, position.z);
        sounds.slam();
        const near = Math.hypot(playerPosition.x - position.x, playerPosition.z - position.z);
        if (!hidden && near < DIVE_HIT && Math.abs(feet - position.y) < 2) minionHealth.damage(DIVE_DAMAGE);
        state = 'stunned';
        timer = 0;
      }
    } else if (state === 'landing') {
      position.y -= 8 * delta;
      if (position.y <= ground) {
        position.y = ground;
        state = 'stalking';
        timer = 0;
      }
    } else if (state === 'stunned') {
      timer += delta;
      if (timer > STUNNED_TIME) {
        state = 'stalking';
        timer = 0;
      }
    } else if (state === 'stalking') {
      timer += delta;
      if (blind > 0) {
        // Stumbles about, pecking at nothing.
        if (timer % 1 < delta) flyTo.set(position.x + (Math.random() - 0.5) * 8, 0, position.z + (Math.random() - 0.5) * 8);
        walkTowards(flyTo.x, flyTo.z, STALK_SPEED * 0.7, delta, collisions);
      } else if (hidden) {
        // Can't reach the minion in the dungeons, so guards the cage.
        if (Math.hypot(CAGE.x - position.x, CAGE.z - position.z) > 4) walkTowards(CAGE.x, CAGE.z, STALK_SPEED, delta, collisions);
      } else if (toPlayer > PECK_REACH - 0.6) {
        walkTowards(playerPosition.x, playerPosition.z, STALK_SPEED, delta, collisions);
      } else {
        face(playerPosition.x, playerPosition.z, delta);
      }
      // Pecks with all three heads, even blind if the minion is right there.
      if (!hidden && toPlayer < (blind > 0 ? 2 : PECK_REACH) && Math.abs(feet - position.y) < 2 && attackTimer <= 0) {
        minionHealth.damage(PECK_DAMAGE);
        sounds.rip();
        caw(0.8);
        attackTimer = PECK_COOLDOWN;
        peckTimer = 0.35;
      }
      if (timer > STALK_TIME && blind <= 0 && !hidden) {
        state = 'rising';
        timer = 0;
        sounds.flap();
        caw(0.9);
      }
    }
    pose(time, delta);
  }

  // Wings, legs and heads for whatever Chookie is doing.
  function pose(time, delta) {
    const flying = FLYING.includes(state);
    const ease = Math.min(1, delta * 10);
    wings.forEach((wing, i) => {
      const side = i ? 1 : -1;
      let lift;
      if (state === 'asleep') lift = -1.25;
      else if (state === 'diving') lift = -0.35;
      else if (flying) lift = Math.sin(time * 9) * 0.75;
      else lift = -1.15 + Math.sin(time * 2) * 0.05;
      wing.rotation.z = THREE.MathUtils.lerp(wing.rotation.z, side * lift, ease);
      wing.rotation.y = THREE.MathUtils.lerp(wing.rotation.y, state === 'diving' ? -side * 0.6 : 0, ease);
    });
    legs.forEach((leg, i) => {
      const swing = flying ? 0.9 : Math.sin(stride + i * Math.PI) * 0.5;
      leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, state === 'asleep' ? -1.5 : swing, ease);
    });
    necks.forEach((neck, i) => {
      let lean = -0.15 + Math.sin(time * 2 + i) * 0.08;
      if (state === 'asleep') lean = 1.3;
      else if (peckTimer > 0) lean = 1.1;
      else if (state === 'stunned') lean = 0.5 + Math.sin(time * 6 + i * 2) * 0.3;
      else if (state === 'diving') lean = 0.9;
      neck.rotation.x = THREE.MathUtils.lerp(neck.rotation.x, lean, ease);
    });
  }

  function raycast(origin, direction, maxDistance) {
    if (!alive()) return null;
    const distance = rayCircle(origin, direction, position.x, position.z, HIT_RADIUS);
    if (distance >= maxDistance) return null;
    const y = origin.y + direction.y * distance;
    if (y < position.y + HIT_BOTTOM || y > position.y + HIT_TOP) return null;
    return { target: self, distance };
  }

  const alive = () => state !== 'dying' && state !== 'gone';

  function hurt(target, amount) {
    if (!alive()) return false;
    health = Math.max(0, health - amount);
    bossFill.style.width = `${(health / HEALTH) * 100}%`;
    hurtFlash = 0.1;
    if (state === 'asleep') wake();
    else caw(0.7);
    if (health === 0) {
      state = 'dying';
      timer = 0;
      setIce(false);
      setEyes(false);
      caw(1, 1.6);
      bossBar.classList.add('hidden');
      showMessage('You defeated Chookie! Now open the cage and free Felonius');
    }
    // Chookie's own message, not "Monster defeated!".
    return false;
  }

  // Chookie is big, so it counts as near if any of it is within reach.
  function near(point, radius) {
    if (!alive()) return [];
    const across = Math.hypot(point.x - position.x, point.z - position.z) < radius + HIT_RADIUS;
    const level = point.y > position.y - radius && point.y < position.y + HIT_TOP + radius;
    return across && level ? [self] : [];
  }

  // Set alight: flames all over its body, like a burning monster's but bigger.
  function ignite(target, seconds) {
    if (!alive()) return;
    if (state === 'asleep') wake();
    if (frozen > 0) {
      // Fire melts the ice.
      frozen = 0;
      setIce(false);
    }
    burning = Math.max(burning, seconds);
    if (!fire) {
      fire = new THREE.Group();
      for (const [x, y, z] of [
        [0, 2.2, 0.6],
        [-0.7, 2.7, 0],
        [0.7, 2.6, 0],
        [0, 3.3, -0.4],
        [-0.3, 3.9, 1],
        [0.4, 3.6, 0.9],
        [0, 2.4, -1],
      ]) {
        const flame = new THREE.Sprite(fireMaterial);
        flame.position.set(x, y, z);
        fire.add(flame);
      }
      chookie.add(fire);
    }
    fire.visible = true;
  }

  function burn(delta) {
    burning -= delta;
    fire.children.forEach((flame, i) => {
      const flicker = 0.75 + Math.sin(burning * 14 + i * 1.9) * 0.2 + Math.random() * 0.1;
      flame.scale.set(1.3 * flicker, 1.7 * flicker, 1);
    });
    burnTick -= delta;
    if (burnTick <= 0) {
      burnTick = BURN_TICK;
      hurt(self, BURN_DAMAGE);
    }
    if (burning <= 0 || !alive()) fire.visible = false;
  }

  function freeze(target, seconds) {
    if (!alive()) return;
    if (state === 'asleep') wake();
    frozen = seconds;
    setIce(true);
  }

  function blindIt(target, seconds) {
    if (!alive()) return;
    if (state === 'asleep') wake();
    blind = seconds;
    setEyes(false);
    caw(0.8);
  }

  return {
    group,
    update,
    raycast,
    hurt,
    near,
    freeze,
    blind: blindIt,
    ignite,
    // Bangs don't wake Chookie: it sleeps deeply until the minion brings the key.
    alert() {},
    owns: (target) => target === self,
    // Felonius's cage stays shut while Chookie is still around.
    guarding: () => alive(),
    markers: () => (alive() ? [{ x: position.x, z: position.z }] : []),
    awake: () => alive() && state !== 'asleep',
    where: () => position,
  };
}
