/**
 * Implementação de TOTP usando Web Crypto API (RFC 6238)
 */
const TOTP = {
  base32ToBuf: function(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    base32 = base32.replace(/=+$/, '');
    let bits = '';
    for (let i = 0; i < base32.length; i++) {
      const val = alphabet.indexOf(base32[i].toUpperCase());
      if (val === -1) continue;
      bits += val.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.substr(i, 8), 2));
    }
    return new Uint8Array(bytes).buffer;
  },

  generate: async function(secretBase32) {
    try {
      const secretBuf = this.base32ToBuf(secretBase32);
      const epoch = Math.floor(Date.now() / 1000);
      const time = Math.floor(epoch / 30);

      const timeBuf = new ArrayBuffer(8);
      const view = new DataView(timeBuf);
      view.setUint32(0, 0);
      view.setUint32(4, time);

      const key = await crypto.subtle.importKey(
        'raw',
        secretBuf,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', key, timeBuf);
      const hmac = new Uint8Array(signature);

      const offset = hmac[hmac.length - 1] & 0xf;
      const code = (
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff)
      ) % 1000000;

      return code.toString().padStart(6, '0');
    } catch (e) {
      console.error('Erro ao gerar TOTP:', e);
      return null;
    }
  }
};
