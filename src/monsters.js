import * as THREE from 'three';
import { createRandom, range } from './random.js';
import { heightAt, WORLD_RADIUS } from './terrain.js';
import { rayCircle } from './collision.js';
import { isUnderground } from './dungeon.js';

const COUNT = 70;
// Monsters never start this close to the player's starting clearing.
const SAFE_START = 25;
const RADIUS = 0.5;

const WANDER_SPEED = 1;
// A little slower than walking (4.5), at Henry's request, so the minion can
// get away without running.
const CHASE_SPEED = 4;
const NOTICE_DISTANCE = 20;
const GIVE_UP_DISTANCE = 30;
const ATTACK_DISTANCE = 1.6;
const ATTACK_DAMAGE = 25;
const ATTACK_COOLDOWN = 1.2;

// Each blunderbuss pellet does 1 damage, so a close-up blast kills outright.
const HEALTH = 6;
const HIT_RADIUS = 0.6;
const HIT_HEIGHT = 2.3;
// Getting shot knocks a monster back and stops it for a moment.
const KNOCKBACK = 0.15;
const STUN_TIME = 0.35;
const DEATH_TIME = 1.8;
// A loud noise makes monsters chase for this long, however far away the player is.
const ALERT_TIME = 10;
// A chasing monster growls now and then once it's this close.
const GROWL_DISTANCE = 8;
const GROWL_EVERY = [1.5, 3.5];
// Monsters further off sound quieter, fading to nothing at this distance.
const HEARING_DISTANCE = 60;
// Shortest gap between two roars, or two growls, from any monsters, so a
// crowd doesn't turn into one long din.
const ROAR_GAP = 0.4;
const GROWL_GAP = 0.7;

const skin = new THREE.MeshStandardMaterial({ color: 0x1c1a1f, roughness: 0.85 });
// Eyes ignore fog and lighting, so a pair of red eyes is the first thing you
// see in the dark.
const eyes = new THREE.MeshBasicMaterial({ color: 0xff2a1a, fog: false });
// Frozen monsters swap their skin for ice.
const ice = new THREE.MeshStandardMaterial({ color: 0xa8dcff, emissive: 0x1a4a6a, roughness: 0.15 });

const bodyGeometry = new THREE.CapsuleGeometry(0.45, 0.8, 4, 10);
const headGeometry = new THREE.SphereGeometry(0.38, 12, 10);
const eyeGeometry = new THREE.SphereGeometry(0.07, 8, 6);
const limbGeometry = new THREE.CapsuleGeometry(0.1, 0.9, 3, 6).translate(0, -0.55, 0);
const clawGeometry = new THREE.ConeGeometry(0.05, 0.25, 5).rotateX(Math.PI).translate(0, -1.15, 0);

function limb(x, y, withClaws) {
  // A pivot at the shoulder or hip so the limb swings from the top.
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  pivot.add(new THREE.Mesh(limbGeometry, skin));
  if (withClaws) {
    for (const offset of [-0.06, 0, 0.06]) {
      const claw = new THREE.Mesh(clawGeometry, skin);
      claw.position.x = offset;
      pivot.add(claw);
    }
  }
  pivot.traverse((part) => (part.castShadow = true));
  return pivot;
}

// A tall, hunched shadow creature with long clawed arms.
function buildMonster() {
  const monster = new THREE.Group();
  // Turn first, then tip, so a dying monster falls over backwards.
  monster.rotation.order = 'YXZ';
  const body = new THREE.Group();
  body.position.y = 1.15;
  body.rotation.x = 0.35; // hunched forward
  monster.add(body);

  const torso = new THREE.Mesh(bodyGeometry, skin);
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Mesh(headGeometry, skin);
  head.position.set(0, 0.85, 0.15);
  head.castShadow = true;
  body.add(head);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, eyes);
    eye.position.set(side * 0.14, 0.9, 0.48);
    body.add(eye);
  }

  const leftArm = limb(-0.55, 0.45, true);
  const rightArm = limb(0.55, 0.45, true);
  body.add(leftArm, rightArm);

  const leftLeg = limb(-0.22, 1.1, false);
  const rightLeg = limb(0.22, 1.1, false);
  monster.add(leftLeg, rightLeg);

  return { monster, leftArm, rightArm, leftLeg, rightLeg };
}

export function createMonsters(collisions, sounds) {
  const random = createRandom(666);
  const group = new THREE.Group();
  const monsters = [];

  function addMonster(x, z, heading, stride) {
    const position = new THREE.Vector3(x, heightAt(x, z), z);
    collisions.pushOut(position, RADIUS, true);
    position.y = heightAt(position.x, position.z);

    const parts = buildMonster();
    parts.monster.position.copy(position);
    group.add(parts.monster);
    const m = {
      ...parts,
      chasing: false,
      heading,
      wanderTimer: 0,
      attackTimer: 0,
      health: HEALTH,
      stun: 0,
      frozen: 0,
      alerted: 0,
      dead: false,
      deathTimer: 0,
      stride,
      roared: false,
      growlTimer: 0,
    };
    monsters.push(m);
    return m;
  }

  while (monsters.length < COUNT) {
    const angle = range(random, 0, Math.PI * 2);
    const distance = range(random, SAFE_START, WORLD_RADIUS - 10);
    addMonster(Math.cos(angle) * distance, Math.sin(angle) * distance, range(random, 0, Math.PI * 2), range(random, 0, 10));
  }

  const toPlayer = new THREE.Vector3();
  let sinceRoar = ROAR_GAP;
  let sinceGrowl = GROWL_GAP;
  const loudness = (distance) => Math.max(0, 1 - distance / HEARING_DISTANCE);

  function update(delta, playerPosition, health) {
    sinceRoar += delta;
    sinceGrowl += delta;
    const hidden = isUnderground(playerPosition);
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      const position = m.monster.position;
      if (m.dead) {
        // Topple over, then sink into the ground and disappear.
        m.deathTimer += delta;
        const fall = Math.min(1, m.deathTimer / 0.5);
        m.monster.rotation.x = -(Math.PI / 2) * fall * fall;
        if (m.deathTimer > 0.9) position.y -= delta * 0.8;
        if (m.deathTimer > DEATH_TIME) {
          group.remove(m.monster);
          monsters.splice(i, 1);
        }
        continue;
      }

      if (m.frozen > 0) {
        m.frozen -= delta;
        if (m.frozen <= 0) setSkin(m, skin);
        continue;
      }

      toPlayer.set(playerPosition.x - position.x, 0, playerPosition.z - position.z);
      const distance = toPlayer.length();

      m.alerted -= delta;
      // Monsters can't follow the minion down into the dungeon, so they lose track of them there.
      if (hidden) {
        m.chasing = false;
        m.alerted = 0;
      } else if (distance < NOTICE_DISTANCE || m.alerted > 0) m.chasing = true;
      else if (distance > GIVE_UP_DISTANCE) m.chasing = false;

      // Roar on first spotting the minion (or being shot or woken by a bang).
      if (m.chasing && !m.roared) {
        m.roared = true;
        // Growl as soon as it gets close.
        m.growlTimer = 0;
        if (sinceRoar >= ROAR_GAP) {
          sounds.roar(loudness(distance));
          sinceRoar = 0;
        }
      } else if (!m.chasing) {
        m.roared = false;
      }
      // Growl every so often while close.
      if (m.chasing && distance < GROWL_DISTANCE) {
        m.growlTimer -= delta;
        if (m.growlTimer <= 0 && sinceGrowl >= GROWL_GAP) {
          sounds.growl(loudness(distance));
          sinceGrowl = 0;
          m.growlTimer = range(Math.random, ...GROWL_EVERY);
        }
      }

      let speed = 0;
      if (m.chasing) {
        m.heading = Math.atan2(toPlayer.x, toPlayer.z);
        speed = distance > ATTACK_DISTANCE * 0.8 ? CHASE_SPEED : 0;
      } else {
        // Shuffle about, changing direction every few seconds.
        m.wanderTimer -= delta;
        if (m.wanderTimer <= 0) {
          m.heading += range(random, -1.5, 1.5);
          m.wanderTimer = range(random, 2, 5);
        }
        speed = WANDER_SPEED;
      }
      if (m.stun > 0) {
        m.stun -= delta;
        speed = 0;
      }

      position.x += Math.sin(m.heading) * speed * delta;
      position.z += Math.cos(m.heading) * speed * delta;
      collisions.pushOut(position, RADIUS, true);
      position.y = heightAt(position.x, position.z);

      // Turn smoothly towards the way it's heading.
      const turn = Math.atan2(Math.sin(m.heading - m.monster.rotation.y), Math.cos(m.heading - m.monster.rotation.y));
      m.monster.rotation.y += turn * Math.min(1, delta * 8);

      // Swing legs and arms in time with walking speed.
      m.stride += delta * speed * 2.2;
      const swing = Math.sin(m.stride) * Math.min(1, speed / 2) * 0.7;
      m.leftLeg.rotation.x = swing;
      m.rightLeg.rotation.x = -swing;

      m.attackTimer -= delta;
      if (m.chasing && m.stun <= 0 && distance < ATTACK_DISTANCE) {
        if (m.attackTimer <= 0) {
          health.damage(ATTACK_DAMAGE);
          sounds.rip();
          m.attackTimer = ATTACK_COOLDOWN;
        }
      }
      // Arms lunge forward right after a swipe, otherwise they dangle.
      const lunge = m.attackTimer > ATTACK_COOLDOWN - 0.3 ? -1.6 : m.chasing ? -0.6 : 0;
      m.leftArm.rotation.x = THREE.MathUtils.lerp(m.leftArm.rotation.x, lunge - swing * 0.5, Math.min(1, delta * 12));
      m.rightArm.rotation.x = THREE.MathUtils.lerp(m.rightArm.rotation.x, lunge + swing * 0.5, Math.min(1, delta * 12));
    }
  }

  function setSkin(m, material) {
    m.monster.traverse((part) => {
      if (part.material === skin || part.material === ice) part.material = material;
    });
  }

  // Living monsters within `radius` of a point, seen from above.
  function near(point, radius) {
    return monsters.filter(
      (m) => !m.dead && Math.hypot(m.monster.position.x - point.x, m.monster.position.z - point.z) < radius,
    );
  }

  // A loud noise: every monster within `radius` comes after the player.
  function alert(point, radius) {
    for (const m of near(point, radius)) {
      m.chasing = true;
      m.alerted = ALERT_TIME;
    }
  }

  // Turns a monster to ice: it can't move or attack until it thaws.
  function freeze(target, seconds) {
    if (target.dead) return;
    target.frozen = seconds;
    setSkin(target, ice);
  }

  // A monster that leaps out at the player for a jump scare: it appears
  // already facing them with its arms up, and gets one swipe's wait before
  // it can hit.
  function ambush(x, z, playerPosition) {
    const heading = Math.atan2(playerPosition.x - x, playerPosition.z - z);
    const m = addMonster(x, z, heading, 0);
    m.monster.rotation.y = heading;
    m.chasing = true;
    // The scare has its own screech, so no roar on top.
    m.roared = true;
    m.growlTimer = GROWL_EVERY[1];
    m.alerted = ALERT_TIME;
    m.attackTimer = ATTACK_COOLDOWN;
    m.leftArm.rotation.x = m.rightArm.rotation.x = -1.6;
    return m;
  }

  // The nearest living monster a ray (normalised direction) hits, if any.
  function raycast(origin, direction, maxDistance) {
    let nearest = null;
    let nearestDistance = maxDistance;
    for (const m of monsters) {
      if (m.dead) continue;
      const position = m.monster.position;
      const distance = rayCircle(origin, direction, position.x, position.z, HIT_RADIUS);
      if (distance >= nearestDistance) continue;
      const y = origin.y + direction.y * distance;
      if (y < position.y || y > position.y + HIT_HEIGHT) continue;
      nearest = m;
      nearestDistance = distance;
    }
    return nearest && { target: nearest, distance: nearestDistance };
  }

  // Hurts a monster shot from `direction`. Returns true if that killed it.
  function hurt(target, amount, direction) {
    if (target.dead) return false;
    target.health -= amount;
    target.chasing = true;
    target.stun = STUN_TIME;
    const position = target.monster.position;
    position.x += direction.x * KNOCKBACK * amount;
    position.z += direction.z * KNOCKBACK * amount;
    collisions.pushOut(position, RADIUS, true);
    position.y = heightAt(position.x, position.z);
    if (target.health > 0) return false;
    target.dead = true;
    return true;
  }

  // Where the living monsters are, for the map.
  function markers() {
    return monsters.filter((m) => !m.dead).map((m) => ({ x: m.monster.position.x, z: m.monster.position.z }));
  }

  return { group, update, raycast, hurt, near, alert, freeze, ambush, markers };
}
