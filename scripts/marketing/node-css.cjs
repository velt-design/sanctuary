// The canonical product draft imports presentation defaults from TSX owners.
// Build-time pricing uses their values only; Node must not execute their CSS imports.
require.extensions['.css'] = (module) => { module.exports = {}; };
