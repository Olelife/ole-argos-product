// Lector y escritor mínimos de ZIP (store + deflate), solo stdlib. Alcanza para el "Project archive"
// de Claude Design y para armar fixtures en los tests; no soporta ZIP64 ni cifrado.
import { readFileSync } from 'node:fs';
import { inflateRawSync, deflateRawSync, crc32 } from 'node:zlib';

const EOCD = 0x06054b50, CEN = 0x02014b50, LOC = 0x04034b50;

// Un nombre que se escapa del destino (absoluto, `..`, unidad de Windows) se rechaza: zip-slip.
export function unsafeName(name) {
  return name.startsWith('/') || name.includes('\\') || /^[a-zA-Z]:/.test(name) || name.split('/').includes('..');
}

export function readZip(path) {
  const buf = readFileSync(path);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('no es un zip (sin directorio central)');
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  if (p === 0xffffffff || total === 0xffff) throw new Error('ZIP64 no soportado');
  const entries = [];
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(p) !== CEN) throw new Error('directorio central corrupto');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8');
    p += 46 + nlen + xlen + clen;
    if (unsafeName(name)) throw new Error(`entrada insegura en el zip: ${name}`);
    const isDir = name.endsWith('/');
    entries.push({
      name, size, isDir,
      data() {
        if (buf.readUInt32LE(local) !== LOC) throw new Error(`cabecera local corrupta: ${name}`);
        const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
        const raw = buf.subarray(start, start + csize);
        if (method === 0) return Buffer.from(raw);
        if (method === 8) return inflateRawSync(raw);
        throw new Error(`método de compresión ${method} no soportado: ${name}`);
      },
    });
  }
  return entries;
}

// files: [{ name, data: Buffer|string }]
export function writeZip(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data), 'utf8');
    const comp = deflateRawSync(data);
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(LOC, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(CEN, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cen = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(EOCD, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cen.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cen, end]);
}
