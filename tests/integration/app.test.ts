import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/repositories/producto.repository.js', () => ({
  findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));
import app from '../../src/app.js';

describe('Health check', () => {
  it('GET /health responde 200 y status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Catálogo público', () => {
  it('GET /api/productos responde un envelope paginado', async () => {
    const res = await request(app).get('/api/productos');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.page).toBe('number');
    expect(typeof res.body.totalPages).toBe('number');
  });
});
