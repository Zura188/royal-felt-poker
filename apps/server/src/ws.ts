import { createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Socket as NetSocket } from 'node:net';
import type { Duplex } from 'node:stream';

/** WebSocket server minimal (RFC 6455, hanya frame teks) tanpa dependensi luar. */
export class Socket {
  private buf = Buffer.alloc(0);
  onMessage: (text: string) => void = () => {};
  onClose: () => void = () => {};
  closed = false;
  /** waktu terakhir ada data masuk dari klien (ms epoch) — dipakai untuk mendeteksi sambungan mati */
  lastRx = Date.now();

  constructor(private sock: Duplex) {
    sock.on('data', (d: Buffer) => this.feed(d));
    sock.on('close', () => this.finish());
    sock.on('error', () => this.finish());
  }

  private finish() {
    if (this.closed) return;
    this.closed = true;
    this.onClose();
  }

  private feed(d: Buffer) {
    this.lastRx = Date.now();
    this.buf = Buffer.concat([this.buf, d]);
    if (this.buf.length > 1_000_000) return this.close();
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const op = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f;
      let off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (len > 100_000) return this.close();
      const need = off + (masked ? 4 : 0) + len;
      if (b.length < need) return;
      let payload = b.subarray(off + (masked ? 4 : 0), need);
      if (masked) {
        const key = b.subarray(off, off + 4);
        payload = Buffer.from(payload.map((v, i) => v ^ key[i % 4]));
      }
      this.buf = b.subarray(need);
      if (op === 0x8) return this.close();
      if (op === 0x9) this.frame(0xa, payload);
      else if (op === 0x1) this.onMessage(payload.toString('utf8'));
    }
  }

  private frame(op: number, payload: Buffer) {
    if (this.closed) return;
    const n = payload.length;
    let head: Buffer;
    if (n < 126) head = Buffer.from([0x80 | op, n]);
    else if (n < 65536) head = Buffer.from([0x80 | op, 126, n >> 8, n & 255]);
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
    this.sock.write(Buffer.concat([head, payload]));
  }

  /** ping tingkat protokol; browser membalas pong otomatis */
  ping() { this.frame(0x9, Buffer.alloc(0)); }
  /** putus paksa (sambungan mati / tidak merespons) */
  terminate() { this.sock.destroy(); this.finish(); }
  send(obj: unknown) { this.frame(0x1, Buffer.from(JSON.stringify(obj))); }
  close() { if (!this.closed) { this.frame(0x8, Buffer.alloc(0)); this.sock.end(); } this.finish(); }
}

export function accept(req: IncomingMessage, sock: Duplex): Socket | null {
  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string' || req.headers.upgrade?.toLowerCase() !== 'websocket') { sock.destroy(); return null; }
  const acc = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${acc}\r\n\r\n`);
  (sock as Partial<NetSocket>).setNoDelay?.(true);
  return new Socket(sock);
}
