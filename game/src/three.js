// SOLMAR BAY — three.js access: the vendored UMD build sets globalThis.THREE.
// One job: give every module the same THREE namespace object.

import '../vendor/three.min.js';

const THREE = globalThis.THREE;
export default THREE;
