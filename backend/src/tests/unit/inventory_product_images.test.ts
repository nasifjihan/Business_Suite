import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import { createApp } from '@/app';
import { prisma } from '@/lib/prisma';
import { CONFIG } from '@/config/env';
import { seedBaseline, createTestJwt } from '../testUtils';

const app = createApp();

/**
 * A genuine PNG. Produced by the qrcode encoder already in the dependency tree
 * rather than a hand-copied base64 blob, so it cannot silently rot into
 * something that only looks like a PNG.
 */
async function pngBuffer(): Promise<Buffer> {
  const dataUrl = await QRCode.toDataURL('product-image-test', { width: 64, margin: 1 });
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

/** Only the SOI marker matters to the sniffer; nothing here ever decodes it. */
function jpegBuffer(size = 64): Buffer {
  const buf = Buffer.alloc(size, 0);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xe0;
  return buf;
}

describe('Product image upload', () => {
  let seeded: Awaited<ReturnType<typeof seedBaseline>>;
  let adminJwt: string;
  let productId: string;

  beforeEach(async () => {
    seeded = await seedBaseline(prisma);
    adminJwt = createTestJwt(
      seeded.admin.id,
      ['inventory.products.read', 'inventory.products.create', 'inventory.products.update'],
      'ADMIN',
    );
    const created = await request(app)
      .post('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminJwt}`)
      .send({ name: 'Photo Product', costPrice: 5, unitPrice: 10 });
    productId = created.body.data.id;
  });

  afterAll(async () => {
    await fs.rm(CONFIG.uploads.dir, { recursive: true, force: true });
  });

  function upload(buffer: Buffer, filename: string, contentType: string) {
    return request(app)
      .post(`/api/v1/inventory/products/${productId}/image`)
      .set('Authorization', `Bearer ${adminJwt}`)
      .attach('file', buffer, { filename, contentType });
  }

  it('rejects a file whose extension lies about its contents', async () => {
    // Named .png, announced as image/png, but the bytes are plain text. A
    // mimetype or extension check alone would let this through.
    const res = await upload(Buffer.from('definitely not an image'), 'fake.png', 'image/png');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('stores a real PNG as a relative /api/v1/uploads path and serves it back', async () => {
    const res = await upload(await pngBuffer(), 'photo.png', 'image/png');
    expect(res.status).toBe(200);
    expect(res.body.data.imageUrl).toMatch(/^\/api\/v1\/uploads\/[0-9a-f-]{36}\.png$/);

    const persisted = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
    expect(persisted.imageUrl).toBe(res.body.data.imageUrl);

    const fetched = await request(app).get(res.body.data.imageUrl);
    expect(fetched.status).toBe(200);
    expect(fetched.headers['content-type']).toContain('image/png');
  });

  it('derives the stored extension from the bytes, not the client filename', async () => {
    // A JPEG wearing a .png name and a PNG mimetype. The upload succeeds, but
    // it must be stored and served as a JPEG.
    const res = await upload(jpegBuffer(), 'actually-a-jpeg.png', 'image/png');
    expect(res.status).toBe(200);
    expect(res.body.data.imageUrl).toMatch(/\.jpg$/);

    const fetched = await request(app).get(res.body.data.imageUrl);
    expect(fetched.headers['content-type']).toContain('image/jpeg');
  });

  it('rejects a file over the size cap with 413', async () => {
    const oversize = Buffer.alloc(CONFIG.uploads.maxBytes + 1024);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(oversize);
    const res = await upload(oversize, 'huge.png', 'image/png');
    expect(res.status).toBe(413);
  });

  it('replaces the previous image and deletes the old file from disk', async () => {
    const first = await upload(await pngBuffer(), 'first.png', 'image/png');
    const firstPath = path.join(CONFIG.uploads.dir, path.basename(first.body.data.imageUrl));
    await expect(fs.access(firstPath)).resolves.toBeUndefined();

    const second = await upload(jpegBuffer(), 'second.jpg', 'image/jpeg');
    expect(second.status).toBe(200);
    expect(second.body.data.imageUrl).not.toBe(first.body.data.imageUrl);

    // The replaced file is unreferenced, so it must not be left behind.
    await expect(fs.access(firstPath)).rejects.toThrow();
    await expect(
      fs.access(path.join(CONFIG.uploads.dir, path.basename(second.body.data.imageUrl))),
    ).resolves.toBeUndefined();
  });

  it('exposes imageUrl in the product list', async () => {
    await upload(await pngBuffer(), 'photo.png', 'image/png');
    const list = await request(app)
      .get('/api/v1/inventory/products')
      .set('Authorization', `Bearer ${adminJwt}`);
    expect(list.status).toBe(200);
    const row = list.body.data.items.find((p: { id: string }) => p.id === productId);
    expect(row.imageUrl).toMatch(/^\/api\/v1\/uploads\//);
  });

  it('returns 404 for an unknown product', async () => {
    const res = await request(app)
      .post('/api/v1/inventory/products/00000000-0000-0000-0000-000000000000/image')
      .set('Authorization', `Bearer ${adminJwt}`)
      .attach('file', await pngBuffer(), { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when no file part is attached', async () => {
    const res = await request(app)
      .post(`/api/v1/inventory/products/${productId}/image`)
      .set('Authorization', `Bearer ${adminJwt}`);
    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post(`/api/v1/inventory/products/${productId}/image`)
      .attach('file', await pngBuffer(), { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });

  it('requires the inventory.products.update permission', async () => {
    const viewerJwt = createTestJwt(seeded.viewer.id, ['inventory.products.read'], 'VIEWER');
    const res = await request(app)
      .post(`/api/v1/inventory/products/${productId}/image`)
      .set('Authorization', `Bearer ${viewerJwt}`)
      .attach('file', await pngBuffer(), { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(403);
  });
});
