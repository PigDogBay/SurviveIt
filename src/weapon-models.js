import * as THREE from 'three';

// Not very metallic, because shiny metal has nothing to reflect in the dark
// woods and turns black. A faint glow keeps the gun readable at night.
const wood = new THREE.MeshStandardMaterial({ color: 0x7a4620, emissive: 0x24120a, roughness: 0.6 });
const brass = new THREE.MeshStandardMaterial({
  color: 0xe0b048,
  emissive: 0x3a2808,
  metalness: 0.3,
  roughness: 0.35,
  side: THREE.DoubleSide,
});
const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a40, emissive: 0x101012, metalness: 0.3, roughness: 0.45 });
const bore = new THREE.MeshBasicMaterial({ color: 0x050505 });

// A blunderbuss: a wooden stock and a brass barrel that flares into a wide
// bell-shaped mouth. The barrel points along -z, with the breech at z = 0.
export function buildBlunderbuss() {
  const gun = new THREE.Group();

  const profile = [];
  for (let i = 0; i <= 20; i++) {
    const along = i / 20;
    profile.push(new THREE.Vector2(0.022 + Math.pow(along, 5) * 0.05, along * 0.56));
  }
  profile.push(new THREE.Vector2(0.078, 0.565), new THREE.Vector2(0.06, 0.565), new THREE.Vector2(0.03, 0.47));
  const barrel = new THREE.Mesh(new THREE.LatheGeometry(profile, 24).rotateX(-Math.PI / 2), brass);
  barrel.position.y = 0.035;
  gun.add(barrel);

  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.031, 16), bore);
  hole.position.set(0, 0.035, -0.47);
  gun.add(hole);

  for (const z of [-0.14, -0.32]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 6, 16), brass);
    band.position.set(0, 0.035, z);
    gun.add(band);
  }

  // Fore-stock under the barrel, then the grip and the butt that drops away.
  const fore = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.38), wood);
  fore.position.set(0, 0.005, -0.15);
  const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.055, 0.16), wood);
  wrist.position.set(0, 0.0, 0.1);
  wrist.rotation.x = 0.15;
  const butt = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.12, 0.2), wood);
  butt.position.set(0, -0.045, 0.25);
  butt.rotation.x = 0.25;
  const buttPlate = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.125, 0.012), brass);
  buttPlate.position.set(0, -0.07, 0.35);
  buttPlate.rotation.x = 0.25;
  gun.add(fore, wrist, butt, buttPlate);

  // Flintlock: a plate on the side and a hammer at the back of the barrel.
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.035, 0.09), iron);
  lock.position.set(0.028, 0.02, 0.02);
  const hammer = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.018), iron);
  hammer.position.set(0.026, 0.055, 0.045);
  hammer.rotation.x = -0.5;
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, 0.008), iron);
  trigger.position.set(0, -0.03, 0.05);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.004, 6, 12, Math.PI), brass);
  guard.rotation.set(Math.PI, Math.PI / 2, 0);
  guard.position.set(0, -0.018, 0.05);
  gun.add(lock, hammer, trigger, guard);

  return gun;
}

// Minion colours: yellow, overall blue and goggle grey.
const yellow = new THREE.MeshStandardMaterial({ color: 0xf2cf3a, emissive: 0x3a2e06, roughness: 0.45 });
const blue = new THREE.MeshStandardMaterial({ color: 0x2f5fb0, emissive: 0x0a1630, roughness: 0.5 });
const steel = new THREE.MeshStandardMaterial({
  color: 0xb4bcc6,
  emissive: 0x1c2026,
  metalness: 0.3,
  roughness: 0.3,
  side: THREE.DoubleSide,
});
const gasGreen = new THREE.MeshStandardMaterial({ color: 0x8fd14a, emissive: 0x1c3a08, roughness: 0.4, side: THREE.DoubleSide });
const iceGlow = new THREE.MeshBasicMaterial({ color: 0x7fe8ff });
const gaugeFace = new THREE.MeshBasicMaterial({ color: 0xf4f1ea });

function grip(gun, material) {
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), material);
  handle.position.set(0, -0.07, 0.08);
  handle.rotation.x = 0.3;
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, 0.008), iron);
  trigger.position.set(0, -0.035, 0.02);
  gun.add(handle, trigger);
}

// The fart gun: a blue body, a yellow gas tank with a pressure gauge, and a
// green trumpet horn that the gas comes out of. Points along -z.
export function buildFartGun() {
  const gun = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.32, 16).rotateX(Math.PI / 2), blue);
  body.position.z = -0.06;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 10), blue);
  cap.position.z = 0.1;
  gun.add(body, cap);

  const tank = new THREE.Mesh(new THREE.SphereGeometry(0.055, 18, 14), yellow);
  tank.scale.set(1, 0.9, 1.3);
  tank.position.set(0, 0.085, -0.02);
  const gauge = new THREE.Mesh(new THREE.CircleGeometry(0.022, 16), gaugeFace);
  gauge.position.set(0.058, 0.09, -0.02);
  gauge.rotation.y = Math.PI / 2;
  const gaugeRim = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.005, 6, 16), steel);
  gaugeRim.position.copy(gauge.position);
  gaugeRim.rotation.y = Math.PI / 2;
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.018, 0.003), iron);
  needle.position.set(0.06, 0.095, -0.02);
  needle.rotation.x = 0.7;
  gun.add(tank, gauge, gaugeRim, needle);

  // Trumpet horn flaring out at the front.
  const profile = [];
  for (let i = 0; i <= 16; i++) {
    const along = i / 16;
    profile.push(new THREE.Vector2(0.03 + Math.pow(along, 3) * 0.075, along * 0.22));
  }
  profile.push(new THREE.Vector2(0.11, 0.225), new THREE.Vector2(0.095, 0.225));
  const horn = new THREE.Mesh(new THREE.LatheGeometry(profile, 24).rotateX(-Math.PI / 2), gasGreen);
  horn.position.z = -0.22;
  gun.add(horn);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.008, 6, 16), steel);
  ring.position.z = -0.21;
  gun.add(ring);

  grip(gun, blue);
  return gun;
}

// The freeze ray: a steel body with glowing icy rings and a glowing tip,
// and a blue coolant tank on top. Points along -z.
export function buildFreezeRay() {
  const gun = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.24, 18).rotateX(Math.PI / 2), steel);
  body.position.z = 0.0;
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.05, 0.24, 18).rotateX(Math.PI / 2), steel);
  nose.position.z = -0.24;
  gun.add(body, nose);

  for (const [z, radius] of [
    [-0.15, 0.05],
    [-0.23, 0.04],
    [-0.31, 0.03],
  ]) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.008, 8, 20), iceGlow);
    coil.position.z = z;
    gun.add(coil);
  }
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 14, 10), iceGlow);
  tip.position.z = -0.37;
  gun.add(tip);

  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 14).rotateX(Math.PI / 2), blue);
  tank.position.set(0, 0.075, 0.01);
  const coolant = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.012, 0.09), iceGlow);
  coolant.position.set(0, 0.075, 0.01);
  gun.add(tank, coolant);

  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 18).rotateX(Math.PI / 2), blue);
  back.position.z = 0.13;
  gun.add(back);

  grip(gun, blue);
  return gun;
}

const fireGlow = new THREE.MeshBasicMaterial({ color: 0xff8a2a });

// The flamethrower: two yellow fuel tanks on a blue body, a hose, and a
// long steel nozzle with a little pilot flame at the tip. Points along -z.
export function buildFlamethrower() {
  const gun = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.26), blue);
  body.position.z = 0.0;
  gun.add(body);

  for (const x of [-0.03, 0.03]) {
    const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.12, 6, 14).rotateX(Math.PI / 2), yellow);
    tank.position.set(x, 0.055, -0.03);
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.016, 8), steel);
    valve.position.set(x, 0.08, 0.02);
    gun.add(tank, valve);
  }

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.3, 14).rotateX(Math.PI / 2), steel);
  nozzle.position.set(0, 0.035, -0.27);
  const tipRing = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.007, 6, 16), iron);
  tipRing.position.set(0, 0.035, -0.42);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.018, 14), bore);
  hole.position.set(0, 0.035, -0.421);
  hole.rotation.y = Math.PI;
  gun.add(nozzle, tipRing, hole);

  // A curly hose from the tanks down to the nozzle.
  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.03, 0.05, -0.1),
        new THREE.Vector3(0.045, 0.055, -0.15),
        new THREE.Vector3(0.02, 0.045, -0.2),
      ]),
      12,
      0.008,
      6,
    ),
    iron,
  );
  gun.add(hose);

  const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), fireGlow);
  pilot.scale.set(1, 1.6, 1);
  pilot.position.set(0, 0.01, -0.41);
  gun.add(pilot);

  // A front handle under the nozzle as well as the trigger grip.
  const front = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.035), blue);
  front.position.set(0, -0.025, -0.2);
  gun.add(front);

  grip(gun, blue);
  return gun;
}

// The sword: a shining blade, a golden cross-guard with a goggle-style
// round pommel, and a blue wrapped handle. The blade points along -z.
export function buildSword() {
  const sword = new THREE.Group();

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.01, 0.5), steel);
  blade.position.z = -0.3;
  const point = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.032, 0.09, 4, 1).rotateX(-Math.PI / 2).rotateZ(Math.PI / 4), steel);
  point.scale.set(1, 0.32, 1);
  point.position.z = -0.59;
  // A groove down the middle catches the light.
  const groove = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.012, 0.4), iron);
  groove.position.z = -0.28;
  sword.add(blade, point, groove);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.03), brass);
  guard.position.z = -0.04;
  for (const x of [-0.085, 0.085]) {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), brass);
    knob.position.set(x, 0, -0.04);
    sword.add(knob);
  }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.12, 10).rotateX(Math.PI / 2), blue);
  handle.position.z = 0.03;
  const pommel = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.008, 8, 16), brass);
  pommel.position.z = 0.105;
  const pommelEye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), steel);
  pommelEye.position.z = 0.105;
  sword.add(guard, handle, pommel, pommelEye);

  return sword;
}

// Takis colours: a purple bag and spicy red-orange rolled snacks.
const takiPurple = new THREE.MeshStandardMaterial({ color: 0x5a1f8a, emissive: 0x1a0828, roughness: 0.5, side: THREE.DoubleSide });
const takiRed = new THREE.MeshStandardMaterial({ color: 0xd8402a, emissive: 0x3a0c06, roughness: 0.8 });
const flameYellow = new THREE.MeshStandardMaterial({ color: 0xffb020, emissive: 0x5a3000, roughness: 0.5 });

// One rolled Taki: a little tube of spicy tortilla, lying along z.
export function buildTaki() {
  const taki = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.13, 10).rotateX(Math.PI / 2), takiRed);
  taki.castShadow = true;
  return taki;
}

// The Taki gun: a purple body like a Takis bag with a flame stripe, a
// hopper on top full of Takis, and a red barrel they shoot out of. Points
// along -z.
export function buildTakiGun() {
  const gun = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.26), takiPurple);
  body.position.z = 0;
  gun.add(body);
  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.03, 0.2), flameYellow);
    stripe.position.set(side * 0.047, 0.01, 0);
    gun.add(stripe);
  }

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.26, 14).rotateX(Math.PI / 2), takiRed);
  barrel.position.set(0, 0.02, -0.25);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 6, 16), iron);
  ring.position.set(0, 0.02, -0.38);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), bore);
  hole.position.set(0, 0.02, -0.381);
  hole.rotation.y = Math.PI;
  gun.add(barrel, ring, hole);

  // An open hopper on top, with Takis sticking out of it.
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.026, 0.045, 16, 1, true), takiPurple);
  hopper.position.set(0, 0.07, 0.04);
  gun.add(hopper);
  for (const [x, z, tilt] of [
    [-0.012, 0.035, 0.4],
    [0.012, 0.045, -0.3],
    [0.0, 0.03, 0.9],
  ]) {
    const taki = buildTaki();
    taki.rotation.set(Math.PI / 2 - 0.3, tilt, 0);
    taki.scale.setScalar(0.35);
    taki.position.set(x, 0.09, z);
    gun.add(taki);
  }

  grip(gun, blue);
  return gun;
}
