// A small seeded random number generator (mulberry32) plus the helpers the
// world builders share. The same seed always gives the same city, traffic
// and pedestrians, which is what makes screenshot scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max) from the seeded generator. */
export function randRange(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer in [min, max] (both ends included) from the seeded generator. */
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of `arr`, picked by the seeded generator. */
export function randPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
