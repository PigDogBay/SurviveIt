// Puts several kinds of enemy (the monsters, Chookie) behind one set of calls,
// so every weapon can hit any of them. Each kind must say which targets it
// `owns` and offer raycast, hurt, near, alert, freeze and blind.
export function combineTargets(...kinds) {
  const ownerOf = (target) => kinds.find((kind) => kind.owns(target));
  return {
    // The nearest target any kind finds along the ray.
    raycast(origin, direction, maxDistance) {
      let nearest = null;
      for (const kind of kinds) {
        const hit = kind.raycast(origin, direction, nearest ? nearest.distance : maxDistance);
        if (hit && (!nearest || hit.distance < nearest.distance)) nearest = hit;
      }
      return nearest;
    },
    hurt: (target, amount, direction) => ownerOf(target)?.hurt(target, amount, direction) ?? false,
    near: (point, radius) => kinds.flatMap((kind) => kind.near(point, radius)),
    alert: (point, radius) => kinds.forEach((kind) => kind.alert(point, radius)),
    freeze: (target, seconds) => ownerOf(target)?.freeze(target, seconds),
    blind: (target, seconds) => ownerOf(target)?.blind(target, seconds),
  };
}
