'use strict';

// Pure-JS stub for the native bufferutil addon.
// websocket@1.0.35 uses mask() and unmask() for performance; these no-ops are
// functionally correct (websocket falls back to a pure-JS path when the native
// module is absent in some code paths, but calls these directly in others).

function mask(source, mask, output, offset, length) {
  for (let i = 0; i < length; i++) {
    output[offset + i] = source[i] ^ mask[i & 3];
  }
}

function unmask(buffer, mask) {
  const len = buffer.length;
  for (let i = 0; i < len; i++) {
    buffer[i] ^= mask[i & 3];
  }
}

module.exports = { mask, unmask };
