// Solmar Bay — three.js shim.
// The vendored UMD build sets globalThis.THREE; this module re-exports it so
// every other module imports THREE the same way.

export const THREE = globalThis.THREE;
export default THREE;
