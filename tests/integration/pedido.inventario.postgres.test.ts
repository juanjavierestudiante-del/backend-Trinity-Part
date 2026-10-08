/** Opt-in: VENTAS_POSTGRES_TEST=1 y DATABASE_URL apuntando a la base aislada
 * verificada con Neon MCP. Nunca ejecutar contra neondb ni production.
 * npx vitest run tests/integration/pedido.inventario.postgres.test.ts
 */
import type { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { diagnostics } from './helpers/postgres-diagnostics.js';

const enabled = process.env.VENTAS_POSTGRES_TEST === '1';
const contacto = { nombreContacto: 'Prueba aislada', telefonoContacto: '71234567', direccionEntrega: null };
let db: PrismaClient;
let pedidos: typeof import('../../src/services/pedido.service.js');
let singleton: PrismaClient;
let commercialRepo: typeof import('../../src/repositories/resolucion-comercial.repository.js');
let admin: typeof import('../../src/services/comercial-admin.service.js');
let adminRepo: typeof import('../../src/repositories/comercial-admin.repository.js');
let cartRepo: typeof import('../../src/repositories/carrito.repository.js');
const users: number[] = [];
const products: number[] = [];
const categories: number[] = [];
const variants: number[] = [];
const attributes: number[] = [];
const options = { timeout: 15000, maxWait: 15000 };

describe.skipIf(!enabled)('ventas: PostgreSQL real aislado', () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? '');
    const neon = url.hostname === 'ep-patient-sun-acc51t0z.sa-east-1.aws.neon.tech' &&
      url.pathname === '/fase4b_cutover_empty_20261004' && url.searchParams.get('sslmode') === 'require';
    if (!neon) {
      throw new Error('Pruebas bloqueadas: endpoint/base no autorizados');
    }
    // Fixtures, escritores y observador usan el pool existente del servicio.
    // Cada transacción sigue teniendo su conexión PostgreSQL independiente.
    singleton = (await import('../../src/config/prisma.js')).default;
    db = singleton;
    diagnostics.attach(db, 'integration');
    // Separar apertura de conexión del primer préstamo del pool (10s por defecto).
    // No aumenta pool ni timeout transaccional del backend.
    await diagnostics.operation('connect', () => db.$connect());
    const [identity] = await db.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    expect(identity.db).toBe('fase4b_cutover_empty_20261004');
    // No limpiar datos ajenos: fallar si la base dejó de estar vacía.
    expect(await db.producto.count()).toBe(0);
    expect(await db.usuario.count()).toBe(0);
    pedidos = await import('../../src/services/pedido.service.js');
    commercialRepo = await import('../../src/repositories/resolucion-comercial.repository.js');
    admin = await import('../../src/services/comercial-admin.service.js');
    adminRepo = await import('../../src/repositories/comercial-admin.repository.js');
    cartRepo = await import('../../src/repositories/carrito.repository.js');
    await diagnostics.sessions(db, 'setup-one-client');
  }, 45000);

  beforeEach(async context => {
    diagnostics.begin(context.task.name);
    await diagnostics.sessions(db, 'before');
    const crear = pedidos.crear;
    const cambiarEstado = pedidos.cambiarEstado;
    vi.spyOn(pedidos, 'crear').mockImplementation((...args) => diagnostics.operation('pedido.crear', () => crear(...args)));
    vi.spyOn(pedidos, 'cambiarEstado').mockImplementation((...args) => diagnostics.operation('pedido.cambiarEstado', () => cambiarEstado(...args)));
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (!db) return;
    // Sólo fixtures creadas por esta suite, nunca resets globales.
    await db.movimientoInventario.deleteMany({ where: { idVariante: { in: variants } } });
    await db.pedido.deleteMany({ where: { idUsuario: { in: users } } });
    await db.carrito.deleteMany({ where: { idUsuario: { in: users } } });
    await db.producto.deleteMany({ where: { idProducto: { in: products } } });
    await db.atributo.deleteMany({ where: { idAtributo: { in: attributes } } });
    await db.categoria.deleteMany({ where: { idCategoria: { in: categories } } });
    await db.usuario.deleteMany({ where: { id_usuario: { in: users } } });
    users.length = products.length = categories.length = variants.length = attributes.length = 0;
    const [clean] = await db.$queryRaw<Array<{ fixtures: number; constraints: number }>>`SELECT
      ((SELECT count(*) FROM producto)+(SELECT count(*) FROM usuario)+(SELECT count(*) FROM categoria)+
      (SELECT count(*) FROM carrito)+(SELECT count(*) FROM carrito_detalle)+(SELECT count(*) FROM pedido)+
      (SELECT count(*) FROM pedido_detalle)+(SELECT count(*) FROM inventario)+
      (SELECT count(*) FROM movimiento_inventario))::int AS fixtures,
      (SELECT count(*)::int FROM pg_constraint WHERE conname='ventas_test_failure') AS constraints`;
    expect(clean).toEqual({ fixtures: 0, constraints: 0 });
    const sessions = await diagnostics.sessions(db, 'after-cleanup');
    expect(sessions.some(s => s.transaction_ms !== null)).toBe(false);
    diagnostics.end();
  }, 45000);
  afterAll(async () => {
    try {
      if (db) expect((await diagnostics.sessions(db, 'before-disconnect')).some(s => s.transaction_ms !== null)).toBe(false);
    } finally { await db?.$disconnect(); }
  });

  async function fixture(stock: number, base = 50, extraStocks: number[] = []) {
    const key = randomUUID();
    const category = await db.categoria.create({ data: { nombre: key, slug: key } });
    categories.push(category.idCategoria);
    const product = await db.producto.create({ data: { nombre: 'Producto aislado', slug: key, idCategoria: category.idCategoria, estado: 'Activo' } });
    products.push(product.idProducto);
    const pres = await db.presentacionVenta.create({ data: { idProducto: product.idProducto, nombre: `Pack x${base}`, cantidadBase: base, principal: true } });
    const perfil = await db.perfilPrecio.create({ data: { idProducto: product.idProducto, nombre: 'Principal', principal: true } });
    const lista = await db.listaPrecio.create({ data: { idProducto: product.idProducto, nombre: 'Principal', principal: true, idPresentacion: pres.idPresentacion, idPerfilPrecio: perfil.idPerfilPrecio,
      reglas: { create: { nombre: 'Base', cantidadMinima: 1, precioPorPresentacion: '32.00', principal: true } } } });
    const vs = [];
    for (const [index, stockActual] of [stock, ...extraStocks].entries()) {
      const v = await db.productoVariante.create({ data: { idProducto: product.idProducto, sku: `TEST-${key.slice(0, 24)}-${index}`, inventario: { create: { stockActual } } } });
      variants.push(v.idVariante); vs.push(v.idVariante);
    }
    return { pres: pres.idPresentacion, vs, perfil: perfil.idPerfilPrecio, lista: lista.idListaPrecio };
  }
  async function cart(vs: number[], pres: number, quantities: number[]) {
    const user = await db.usuario.create({ data: { nombre: 'Test ventas', email: `${randomUUID()}@example.invalid`, rol: 'CLIENTE' } });
    users.push(user.id_usuario);
    const c = await db.carrito.create({ data: { idUsuario: user.id_usuario, items: { create: vs.map((idVariante, i) => ({ idVariante, idPresentacion: pres, cantidad: quantities[i] })) } } });
    return { user: user.id_usuario, id: c.idCarrito };
  }
  const stock = async (idVariante: number) => (await db.inventario.findUniqueOrThrow({ where: { idVariante } })).stockActual;
  async function unchanged(c: { user: number; id: number }, expectedStocks: number[]) {
    expect(await Promise.all(variants.map(stock))).toEqual(expectedStocks);
    expect(await db.pedido.count({ where: { idUsuario: c.user } })).toBe(0);
    expect(await db.pedidoDetalle.count({ where: { idVariante: { in: variants } } })).toBe(0);
    expect(await db.movimientoInventario.count({ where: { idVariante: { in: variants } } })).toBe(0);
    expect(await db.carritoDetalle.count({ where: { idCarrito: c.id } })).toBe(expectedStocks.length);
  }
  function latch() {
    let resolve!: () => void;
    const promise = new Promise<void>(r => { resolve = r; });
    return { promise, resolve };
  }
  // Comprueba bloqueo real mediante PostgreSQL, sin asumirlo por un sleep.
  async function waitBlocked(pid: number) {
    const start = performance.now();
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      const [r] = await db.$queryRaw<Array<{ pid: number }>>`SELECT pid FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid)) ORDER BY pid LIMIT 1`;
      if (r) { diagnostics.blocked(pid, r.pid, performance.now()-start); return r.pid; }
      await new Promise(r => setTimeout(r, 30));
    }
    throw new Error('No se observó el bloqueo esperado en PostgreSQL');
  }

  it.each([[2000, 3, 1850, 150], [149, 2, 49, 100], [100, 1, 50, 50]])('stock %i / pack50 / cantidad %i', async (initial, qty, final, consumption) => {
    const f = await fixture(initial); const c = await cart(f.vs, f.pres, [qty]);
    const p = await pedidos.crear(c.user, contacto);
    expect(p.estado).toBe('PENDIENTE'); expect(await stock(f.vs[0])).toBe(final);
    const moves = await db.movimientoInventario.findMany({ where: { idVariante: f.vs[0] } });
    expect(moves).toMatchObject([{ tipo: 'Salida', cantidad: consumption, stockAnterior: initial, stockNuevo: final }]);
    const details = await db.pedidoDetalle.findMany({ where: { idPedido: p.idPedido } });
    expect(details).toMatchObject([{ cantidad: qty, cantidadBasePresentacion: 50, presentacionNombre: 'Pack x50' }]);
    expect(details[0].precioUnitario.toFixed(2)).toBe('32.00');
    expect(await db.carritoDetalle.count({ where: { idCarrito: c.id } })).toBe(0);
  }, 45000);
  it('149 unidades no alcanzan para tres packs: rollback', async () => {
    const f = await fixture(149); const c = await cart(f.vs, f.pres, [3]);
    await expect(pedidos.crear(c.user, contacto)).rejects.toThrow('Stock insuficiente'); await unchanged(c, [149]);
  }, 45000);
  it('Unidad consume cinco unidades físicas', async () => {
    const f = await fixture(20, 1); const c = await cart(f.vs, f.pres, [5]);
    await pedidos.crear(c.user, contacto); expect(await stock(f.vs[0])).toBe(15);
  }, 45000);
  it('lectura consolidada conserva producto, SKU y atributo principal histórico', async () => {
    const f=await fixture(2000);const c=await cart(f.vs,f.pres,[3]);
    const atributo=await db.atributo.create({data:{nombre:`Color diagnóstico ${randomUUID()}`}});
    attributes.push(atributo.idAtributo);
    const valor=await db.valorAtributo.create({data:{idAtributo:atributo.idAtributo,valor:'Dorado'}});
    await db.producto.update({where:{idProducto:products[0]},data:{idAtributoPrincipal:atributo.idAtributo}});
    await db.varianteAtributo.create({data:{idVariante:f.vs[0],idValor:valor.idValor}});
    const v=await db.productoVariante.findUniqueOrThrow({where:{idVariante:f.vs[0]}});
    const p=await pedidos.crear(c.user,contacto);
    const d=await db.pedidoDetalle.findFirstOrThrow({where:{idPedido:p.idPedido}});
    expect(d).toMatchObject({nombreProductoSnapshot:'Producto aislado',skuSnapshot:v.sku,
      nombreAtributoPrincipalSnapshot:atributo.nombre,valorAtributoPrincipalSnapshot:'Dorado',
      presentacionNombre:'Pack x50',cantidadBasePresentacion:50,cantidad:3});
  },45000);
  it('multi-item: insuficiencia del segundo revierte el primer descuento', async () => {
    const f = await fixture(100, 50, [199]); const c = await cart(f.vs, f.pres, [2, 4]);
    await expect(pedidos.crear(c.user, contacto)).rejects.toThrow('Stock insuficiente'); await unchanged(c, [100, 199]);
  }, 45000);
  it('fallo real al registrar movimiento revierte stock, pedido y detalles', async () => {
    const f = await fixture(2000, 50, [1000]); const c = await cart(f.vs, f.pres, [3, 2]);
    // Restricción temporal de test, dentro de la base vacía autorizada. Sin código de fallo en production.
    await db.$executeRawUnsafe(`ALTER TABLE movimiento_inventario ADD CONSTRAINT ventas_test_failure CHECK (id_variante <> ${f.vs[1]})`);
    try {
      await expect(pedidos.crear(c.user, contacto)).rejects.toThrow();
      await unchanged(c, [2000, 1000]);
    } finally {
      await db.$executeRawUnsafe('ALTER TABLE movimiento_inventario DROP CONSTRAINT ventas_test_failure');
    }
  }, 45000);
  it.each(['PENDIENTE', 'CONFIRMADO'] as const)('cancelación histórica desde %s, sin doble reposición concurrente', async estado => {
    const f = await fixture(2000); const c = await cart(f.vs, f.pres, [3]); const p = await pedidos.crear(c.user, contacto);
    if (estado === 'CONFIRMADO') {
      await pedidos.cambiarEstado(p.idPedido, 'CONFIRMADO'); await pedidos.cambiarEstado(p.idPedido, 'CONFIRMADO');
      expect(await stock(f.vs[0])).toBe(1850);
      expect(await db.movimientoInventario.count({ where: { idVariante: f.vs[0] } })).toBe(1);
    }
    await db.presentacionVenta.update({ where: { idPresentacion: f.pres }, data: { cantidadBase: 100 } });
    await Promise.all([pedidos.cambiarEstado(p.idPedido, 'CANCELADO'), pedidos.cambiarEstado(p.idPedido, 'CANCELADO')]);
    await pedidos.cambiarEstado(p.idPedido, 'CANCELADO'); expect(await stock(f.vs[0])).toBe(2000);
    expect(await db.movimientoInventario.findMany({ where: { idVariante: f.vs[0], tipo: 'Entrada' } })).toMatchObject([{ cantidad: 150 }]);
    expect(await db.movimientoInventario.count({ where: { idVariante: f.vs[0] } })).toBe(2);
  }, 45000);
  it('dos checkouts compiten: exactamente una compra con stock100', async () => {
    const f = await fixture(100); const a = await cart(f.vs, f.pres, [2]); const b = await cart(f.vs, f.pres, [2]);
    const results = await Promise.allSettled([pedidos.crear(a.user, contacto), pedidos.crear(b.user, contacto)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find(r => r.status === 'rejected');
    expect(failed?.status === 'rejected' && failed.reason.message).toContain('Stock insuficiente');
    expect(await stock(f.vs[0])).toBe(0);
    expect(await db.pedido.count({ where: { idUsuario: { in: [a.user, b.user] } } })).toBe(1);
    expect(await db.movimientoInventario.count({ where: { idVariante: f.vs[0] } })).toBe(1);
  }, 45000);
  it('mismo carrito concurrente: una creación, el segundo ve carrito vacío', async () => {
    const f = await fixture(2000); const c = await cart(f.vs, f.pres, [3]);
    const results = await Promise.allSettled([pedidos.crear(c.user, contacto), pedidos.crear(c.user, contacto)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find(r => r.status === 'rejected');
    expect(failed?.status === 'rejected' && failed.reason.message).toContain('carrito está vacío');
    expect(await stock(f.vs[0])).toBe(1850);
    expect(await db.pedido.count({ where: { idUsuario: c.user } })).toBe(1);
    expect(await db.movimientoInventario.count({ where: { idVariante: f.vs[0] } })).toBe(1);
  }, 45000);
  it('confirmación y cancelación concurrentes respetan la máquina de estados', async () => {
    const f = await fixture(2000); const c = await cart(f.vs, f.pres, [3]); const p = await pedidos.crear(c.user, contacto);
    const results = await Promise.allSettled([pedidos.cambiarEstado(p.idPedido, 'CONFIRMADO'), pedidos.cambiarEstado(p.idPedido, 'CANCELADO')]);
    for (const r of results) if (r.status === 'rejected') expect(r.reason.statusCode).toBe(409);
    const final = await db.pedido.findUniqueOrThrow({ where: { idPedido: p.idPedido } });
    if (final.estado === 'CONFIRMADO') await pedidos.cambiarEstado(p.idPedido, 'CANCELADO');
    expect(await stock(f.vs[0])).toBe(2000);
    expect(await db.movimientoInventario.count({ where: { idVariante: f.vs[0], tipo: 'Entrada' } })).toBe(1);
  }, 45000);
  it('SHARE impide editar cantidadBase mientras checkout usa la presentación', async () => {
    const f = await fixture(2000); const c = await cart(f.vs, f.pres, [3]);
    const pause = pausarCheckoutProtegido();
    const outcome = pedidos.crear(c.user, contacto).then(p => ({ p }), error => ({ error }));
    await Promise.race([pause.locked.promise, outcome.then(() => { throw new Error('Checkout terminó antes del lock'); })]);
    const writer = db.$transaction(async tx => {
      await tx.presentacionVenta.update({ where: { idPresentacion: f.pres }, data: { cantidadBase: 100 } });
    }, options);
    writer.catch(() => undefined);
    try { await waitBlocked(pause.pid()); }
    finally { pause.release.resolve(); await Promise.allSettled([outcome, writer]); }
    await writer;
    const result = await outcome; if ('error' in result) throw result.error;
    expect(await stock(f.vs[0])).toBe(1850);
    expect(await db.pedidoDetalle.findFirst({ where: { idPedido: result.p.idPedido } })).toMatchObject({ cantidadBasePresentacion: 50 });
    expect((await db.presentacionVenta.findUniqueOrThrow({ where: { idPresentacion: f.pres } })).cantidadBase).toBe(100);
    await pedidos.cambiarEstado(result.p.idPedido, 'CANCELADO'); expect(await stock(f.vs[0])).toBe(2000);
  }, 45000);
  it('si el editor adquirió primero el lock, checkout espera y usa el nuevo valor completo', async () => {
    const f = await fixture(2000); const c = await cart(f.vs, f.pres, [3]);
    const locked = latch(); const release = latch(); let pid = 0;
    const editor = db.$transaction(async tx => {
      const [r] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`; pid = r.pid;
      await tx.presentacionVenta.update({ where: { idPresentacion: f.pres }, data: { cantidadBase: 100, nombre: 'Pack x100' } });
      locked.resolve(); await release.promise;
    }, options);
    await locked.promise;
    const outcome = pedidos.crear(c.user, contacto).then(p => ({ p }), error => ({ error }));
    try { await waitBlocked(pid); } finally { release.resolve(); await Promise.allSettled([editor, outcome]); }
    const result = await outcome; if ('error' in result) throw result.error;
    expect(await stock(f.vs[0])).toBe(1700);
    expect(await db.pedidoDetalle.findFirst({ where: { idPedido: result.p.idPedido } })).toMatchObject({ cantidadBasePresentacion: 100, presentacionNombre: 'Pack x100' });
    expect(await db.movimientoInventario.findFirst({ where: { idVariante: f.vs[0] } })).toMatchObject({ cantidad: 300 });
  }, 45000);
  it('consumo mayor al Int PostgreSQL se rechaza antes de persistir', async () => {
    const f = await fixture(2147483647, 2147483647); const c = await cart(f.vs, f.pres, [2]);
    await expect(pedidos.crear(c.user, contacto)).rejects.toThrow('Consumo base fuera del rango permitido'); await unchanged(c, [2147483647]);
  }, 45000);

  it.each(['perfil', 'lista', 'update regla', 'delete regla', 'insert regla'] as const)('checkout bloquea %s hasta COMMIT', async kind => {
    const f = await fixture(2000);
    const rule = await db.reglaPrecioCantidad.create({ data: { idListaPrecio: f.lista, nombre: 'Desde tres', cantidadMinima: 3, precioPorPresentacion: 30 } });
    const c = await cart(f.vs, f.pres, [5]);
    const pause = pausarCheckoutProtegido();
    const checkout = pedidos.crear(c.user, contacto).then(p => ({ p }), error => ({ error }));
    await Promise.race([pause.locked.promise, checkout.then(() => { throw new Error('Checkout terminó antes del lock'); })]);
    const writer = db.$transaction(async tx => {
      if (kind === 'perfil') await tx.perfilPrecio.update({ where: { idPerfilPrecio: f.perfil }, data: { nombre: 'Editado' } });
      else if (kind === 'lista') await tx.listaPrecio.update({ where: { idListaPrecio: f.lista }, data: { nombre: 'Editada' } });
      else {
        await commercialRepo.bloquearListasParaEscrituraReglas([f.lista], tx);
        if (kind === 'update regla') await tx.reglaPrecioCantidad.update({ where: { idReglaPrecio: rule.idReglaPrecio }, data: { precioPorPresentacion: 35 } });
        if (kind === 'delete regla') await tx.reglaPrecioCantidad.delete({ where: { idReglaPrecio: rule.idReglaPrecio } });
        if (kind === 'insert regla') await tx.reglaPrecioCantidad.create({ data: { idListaPrecio: f.lista, nombre: 'Desde cinco', cantidadMinima: 5, precioPorPresentacion: 25 } });
      }
    }, options);
    const writerOutcome = writer.then(() => ({}), error => ({ error }));
    try { await waitBlocked(pause.pid()); }
    finally { pause.release.resolve(); await Promise.allSettled([checkout, writerOutcome]); }
    const result = await checkout; if ('error' in result) throw result.error;
    const edited = await writerOutcome; if (edited?.error) throw edited.error;
    expect(result.p.total.toFixed(2)).toBe('150.00'); expect(await stock(f.vs[0])).toBe(1750);
    const detail = await db.pedidoDetalle.findFirstOrThrow({ where: { idPedido: result.p.idPedido } });
    expect(detail.precioUnitario.toFixed(2)).toBe('30.00'); expect(detail.cantidadBasePresentacion).toBe(50);
    if (kind === 'perfil') expect((await db.perfilPrecio.findUniqueOrThrow({ where: { idPerfilPrecio: f.perfil } })).nombre).toBe('Editado');
    if (kind === 'lista') expect((await db.listaPrecio.findUniqueOrThrow({ where: { idListaPrecio: f.lista } })).nombre).toBe('Editada');
    if (kind === 'update regla') expect((await db.reglaPrecioCantidad.findUniqueOrThrow({ where: { idReglaPrecio: rule.idReglaPrecio } })).precioPorPresentacion.toFixed(2)).toBe('35.00');
    if (kind === 'delete regla') expect(await db.reglaPrecioCantidad.findUnique({ where: { idReglaPrecio: rule.idReglaPrecio } })).toBeNull();
    if (kind === 'insert regla') expect(await db.reglaPrecioCantidad.findFirst({ where: { idListaPrecio: f.lista, cantidadMinima: 5 } })).not.toBeNull();
  }, 45000);

  it('writer de reglas primero: checkout espera y resuelve el nuevo umbral después del lock', async () => {
    const f = await fixture(2000); const c = await cart(f.vs, f.pres, [5]);
    const locked = latch(); const release = latch(); let pid = 0;
    const editor = db.$transaction(async tx => {
      const [r] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`; pid = r.pid;
      await commercialRepo.bloquearListasParaEscrituraReglas([f.lista], tx);
      await tx.reglaPrecioCantidad.create({ data: { idListaPrecio: f.lista, nombre: 'Nuevo umbral', cantidadMinima: 5, precioPorPresentacion: 25 } });
      locked.resolve(); await release.promise;
    }, options);
    await locked.promise;
    const checkout = pedidos.crear(c.user, contacto).then(p => ({ p }), error => ({ error }));
    try { await waitBlocked(pid); } finally { release.resolve(); await Promise.allSettled([editor, checkout]); }
    const r = await checkout; if ('error' in r) throw r.error;
    expect(r.p.total.toFixed(2)).toBe('125.00');
    expect((await db.pedidoDetalle.findFirstOrThrow({ where: { idPedido: r.p.idPedido } })).precioUnitario.toFixed(2)).toBe('25.00');
  }, 45000);

  it('overflow de reposición aislado devuelve error de dominio sin persistir cambios', async () => {
    const f = await fixture(2147483600); const c = await cart(f.vs, f.pres, [2]);
    const p = await db.pedido.create({ data: { idUsuario: c.user, ...contacto, total: 64,
      items: { create: { idVariante: f.vs[0], idPresentacion: f.pres, cantidad: 2,
        precioUnitario: 32, presentacionNombre: 'Pack x50', cantidadBasePresentacion: 50 } } } });
    await expect(pedidos.cambiarEstado(p.idPedido, 'CANCELADO')).rejects.toMatchObject({
      statusCode: 409, message: 'La reposición excede el límite permitido de inventario.',
    });
    expect(await stock(f.vs[0])).toBe(2147483600);
    expect((await db.pedido.findUniqueOrThrow({ where: { idPedido: p.idPedido } })).estado).toBe('PENDIENTE');
    expect(await db.movimientoInventario.count({ where: { idVariante: f.vs[0] } })).toBe(0);
    expect(await db.pedidoDetalle.count({ where: { idPedido: p.idPedido } })).toBe(1);
  }, 45000);

  it('overflow de reposición multi-variante revierte estado, primer incremento y movimiento', async () => {
    const f = await fixture(100, 50, [2147483600]); const c = await cart(f.vs, f.pres, [1, 2]);
    // Pedido histórico de fixture: esta prueba mide cancelación, no creación.
    // El checkout real está cubierto por los otros casos, incluido rollback multi-item.
    const p = await db.pedido.create({ data: { idUsuario: c.user, ...contacto, total: 96,
      items: { create: f.vs.map((idVariante, i) => ({ idVariante, idPresentacion: f.pres, cantidad: i + 1,
        precioUnitario: 32, presentacionNombre: 'Pack x50', cantidadBasePresentacion: 50 })) } } });
    await db.movimientoInventario.createMany({ data: f.vs.map((idVariante, i) => ({
      idVariante, tipo: 'Salida', cantidad: (i + 1) * 50, stockAnterior: 2000, stockNuevo: 2000 - (i + 1) * 50,
      motivo: `Pedido #${p.idPedido}`, idUsuario: c.user,
    })) });
    const movements = await db.movimientoInventario.findMany({ where: { idVariante: { in: f.vs } }, orderBy: { idMovimiento: 'asc' } });
    await expect(pedidos.cambiarEstado(p.idPedido, 'CANCELADO')).rejects.toMatchObject({ statusCode: 409, message: 'La reposición excede el límite permitido de inventario.' });
    expect(await Promise.all(f.vs.map(stock))).toEqual([100, 2147483600]);
    expect((await db.pedido.findUniqueOrThrow({ where: { idPedido: p.idPedido } })).estado).toBe('PENDIENTE');
    expect(await db.movimientoInventario.findMany({ where: { idVariante: { in: f.vs } }, orderBy: { idMovimiento: 'asc' } })).toEqual(movements);
    expect(await db.pedidoDetalle.count({ where: { idPedido: p.idPedido } })).toBe(2);
  }, 45000);

  it('control de reposición normal después del overflow: stock100 más50 produce150', async () => {
    const f = await fixture(100); const c = await cart(f.vs, f.pres, [1]);
    const p = await db.pedido.create({ data: { idUsuario: c.user, ...contacto, total: 32,
      items: { create: { idVariante: f.vs[0], idPresentacion: f.pres, cantidad: 1,
        precioUnitario: 32, presentacionNombre: 'Pack x50', cantidadBasePresentacion: 50 } } } });
    await pedidos.cambiarEstado(p.idPedido, 'CANCELADO');
    expect(await stock(f.vs[0])).toBe(150);
    expect((await db.pedido.findUniqueOrThrow({ where: { idPedido: p.idPedido } })).estado).toBe('CANCELADO');
    expect(await db.movimientoInventario.findMany({ where: { idVariante: f.vs[0] } })).toMatchObject([
      { tipo: 'Entrada', cantidad: 50, stockAnterior: 100, stockNuevo: 150 },
    ]);
  }, 45000);

  async function matrix(f: Awaited<ReturnType<typeof fixture>>) {
    const product = products[0];
    const p = await db.presentacionVenta.create({ data: { idProducto: product, nombre: 'Unidad', cantidadBase: 1 } });
    const profile = await db.perfilPrecio.create({ data: { idProducto: product, nombre: 'Especial' } });
    for (const [pres, perfil] of [[f.pres, profile.idPerfilPrecio], [p.idPresentacion, f.perfil], [p.idPresentacion, profile.idPerfilPrecio]]) {
      await db.listaPrecio.create({ data: { idProducto: product, idPresentacion: pres, idPerfilPrecio: perfil, nombre: `Matriz ${pres}/${perfil}`, reglas: { create: { nombre: 'Base', cantidadMinima: 1, precioPorPresentacion: '32', principal: true } } } });
    }
    return { product, pres: p.idPresentacion, profile: profile.idPerfilPrecio };
  }
  it('Admin cambia presentación principal sin dos principales ni listas nuevas', async () => {
    const f = await fixture(2000); const m = await matrix(f);
    await admin.guardarPresentacion(m.product, m.pres, { principal: true });
    expect(await db.presentacionVenta.count({ where: { idProducto: m.product, activo: true, principal: true } })).toBe(1);
    expect((await admin.obtenerConfiguracion(m.product)).presentaciones.find(p => p.principal)?.idPresentacion).toBe(m.pres);
  }, 90000);
  it('Admin cambia perfil principal y NULL hereda nuevo perfil', async () => {
    const f = await fixture(2000); const m = await matrix(f);
    await admin.guardarPerfil(m.product, m.profile, { principal: true });
    expect(await db.perfilPrecio.count({ where: { idProducto: m.product, activo: true, principal: true } })).toBe(1);
    expect((await admin.obtenerConfiguracion(m.product)).variantes[0].perfilEfectivo?.idPerfilPrecio).toBe(m.profile);
  }, 90000);
  it('Admin asigna perfil explícito y NULL vuelve a heredar', async () => {
    const f = await fixture(2000); const m = await matrix(f);
    await admin.asignarPerfiles(m.product, [{ idVariante: f.vs[0], idPerfilPrecio: m.profile }]);
    expect((await db.productoVariante.findUniqueOrThrow({ where: { idVariante: f.vs[0] } })).idPerfilPrecio).toBe(m.profile);
    await admin.asignarPerfiles(m.product, [{ idVariante: f.vs[0], idPerfilPrecio: null }]);
    expect((await admin.obtenerConfiguracion(m.product)).variantes[0]).toMatchObject({ idPerfilPrecio: null, perfilEfectivo: { idPerfilPrecio: f.perfil } });
  }, 90000);
  it('Admin lote inválido hace rollback de todas las asignaciones', async () => {
    const f = await fixture(2000, 50, [2000]); const m = await matrix(f);
    await expect(admin.asignarPerfiles(m.product, [{ idVariante: f.vs[0], idPerfilPrecio: m.profile }, { idVariante: 2147483647, idPerfilPrecio: m.profile }])).rejects.toThrow('variante');
    expect((await db.productoVariante.findMany({ where: { idVariante: { in: f.vs } } })).map(v => v.idPerfilPrecio)).toEqual([null, null]);
  }, 90000);
  it('Admin crea borrador, lo configura y activa sin inventar precios', async () => {
    const f = await fixture(2000);
    const p = await admin.guardarPresentacion(products[0], null, { nombre: 'Unidad', cantidadBase: 1 });
    const l = await admin.guardarLista(products[0], null, { nombre: 'Unidad', idPresentacion: p.idPresentacion, idPerfilPrecio: f.perfil, principal: false, activo: false, reglas: [] });
    await admin.guardarRegla(products[0], l.idListaPrecio, null, { nombre: 'Base', cantidadMinima: 1, precioPorPresentacion: '5' });
    const rules = (await admin.obtenerConfiguracion(products[0])).listas.find(x => x.idListaPrecio === l.idListaPrecio)!.reglas;
    await admin.guardarLista(products[0], l.idListaPrecio, { nombre: 'Unidad', principal: false, activo: true, reglas: rules });
    await admin.guardarPresentacion(products[0], p.idPresentacion, { activo: true });
    expect((await admin.obtenerConfiguracion(products[0])).listas.find(x => x.idListaPrecio === l.idListaPrecio)?.vendible).toBe(true);
  }, 90000);
  function pausarCheckoutProtegido() {
    const locked = latch(); const release = latch(); let pid = 0;
    const original = commercialRepo.bloquearReglasParaVenta;
    vi.spyOn(commercialRepo, 'bloquearReglasParaVenta').mockImplementation(async (ids, tx) => {
      await original(ids, tx);
      const [r] = await tx.$queryRaw<Array<{pid:number}>>`SELECT pg_backend_pid() pid`;
      pid = r.pid; locked.resolve(); await release.promise;
    });
    return { locked, release, pid: () => pid };
  }
  it.each(['editar', 'insertar'] as const)('Admin %s regla espera a checkout y conserva su precio completo', async operation => {
    const f = await fixture(2000); const c = await cart(f.vs, f.pres, [5]);
    const rule = await db.reglaPrecioCantidad.create({ data: { idListaPrecio: f.lista, nombre: 'Tres', cantidadMinima: 3, precioPorPresentacion: 30 } });
    const pause = pausarCheckoutProtegido();
    const checkout = pedidos.crear(c.user, contacto).then(p => ({ p }), error => ({ error }));
    await Promise.race([pause.locked.promise, checkout.then(() => { throw new Error('Checkout terminó antes del lock'); })]);
    const writer = admin.guardarRegla(products[0], f.lista, operation === 'editar' ? rule.idReglaPrecio : null,
      operation === 'editar' ? { precioPorPresentacion: '35' } : { nombre: 'Cinco', cantidadMinima: 5, precioPorPresentacion: '25' });
    writer.catch(() => undefined);
    try { await waitBlocked(pause.pid()); }
    finally { pause.release.resolve(); await Promise.allSettled([checkout, writer]); }
    await writer; const result = await checkout; if ('error' in result) throw result.error;
    expect(result.p.total.toFixed(2)).toBe('150.00');
  }, 90000);
  it('Admin posee lock primero: checkout espera y lee nueva regla completa', async () => {
    const f = await fixture(2000); const c = await cart(f.vs, f.pres, [5]);
    const locked = latch(); const release = latch(); let pid = 0;
    const original = adminRepo.crearRegla;
    vi.spyOn(adminRepo, 'crearRegla').mockImplementation(async (tx, data) => {
      const [r] = await tx.$queryRaw<Array<{pid:number}>>`SELECT pg_backend_pid() pid`; pid = r.pid;
      const rule = await original(tx, data); locked.resolve(); await release.promise; return rule;
    });
    const writer = admin.guardarRegla(products[0], f.lista, null, { nombre: 'Cinco', cantidadMinima: 5, precioPorPresentacion: '25' });
    await Promise.race([locked.promise, writer.then(() => { throw new Error('Writer terminó antes del lock'); })]);
    const checkout = pedidos.crear(c.user, contacto).then(p => ({ p }), error => ({ error }));
    try { await waitBlocked(pid); } finally { release.resolve(); await Promise.allSettled([writer, checkout]); }
    await writer; const result = await checkout; if ('error' in result) throw result.error;
    expect(result.p.total.toFixed(2)).toBe('125.00');
  }, 90000);
  it('Admin cantidadBase espera checkout y snapshot conserva valor anterior', async () => {
    const f = await fixture(2000); const c = await cart(f.vs, f.pres, [3]);
    const pause = pausarCheckoutProtegido();
    const checkout = pedidos.crear(c.user, contacto).then(p => ({ p }), error => ({ error }));
    await Promise.race([pause.locked.promise, checkout.then(() => { throw new Error('Checkout terminó antes del lock'); })]);
    const writer = admin.guardarPresentacion(products[0], f.pres, { cantidadBase: 100 });
    writer.catch(() => undefined);
    try { await waitBlocked(pause.pid()); }
    finally { pause.release.resolve(); await Promise.allSettled([checkout, writer]); }
    await writer; const result = await checkout; if ('error' in result) throw result.error;
    expect((await db.pedidoDetalle.findFirstOrThrow({ where: { idPedido: result.p.idPedido } })).cantidadBasePresentacion).toBe(50);
    expect((await db.presentacionVenta.findUniqueOrThrow({ where: { idPresentacion: f.pres } })).cantidadBase).toBe(100);
  }, 90000);
  it.each(['desactivar', 'cantidadBase'] as const)('carrito entra primero: Admin %s espera y rechaza por uso', async operation => {
    const f = await fixture(2000); const m = await matrix(f); const c = await cart(f.vs, f.pres, [1]);
    await db.carritoDetalle.deleteMany({ where: { idCarrito: c.id } });
    const locked = latch(); const release = latch(); let pid = 0;
    const original = commercialRepo.bloquearPresentacionesParaVenta;
    vi.spyOn(commercialRepo, 'bloquearPresentacionesParaVenta').mockImplementation(async (ids, tx) => {
      await original(ids, tx); const [r] = await tx.$queryRaw<Array<{pid:number}>>`SELECT pg_backend_pid() pid`; pid = r.pid; locked.resolve(); await release.promise;
    });
    const add = cartRepo.agregarItemAtomico(c.user, f.vs[0], m.pres, 3);
    await Promise.race([locked.promise, add.then(() => { throw new Error('Add terminó antes del lock'); })]);
    const edit = admin.guardarPresentacion(m.product, m.pres, operation === 'desactivar' ? { activo: false } : { cantidadBase: 100 }).then(() => null, e => e as Error);
    try { await waitBlocked(pid); } finally { release.resolve(); await Promise.allSettled([add, edit]); }
    await add; expect((await edit)?.message).toContain('en uso');
    expect(await db.carritoDetalle.count({ where: { idCarrito: c.id, idPresentacion: m.pres } })).toBe(1);
    expect((await db.presentacionVenta.findUniqueOrThrow({ where: { idPresentacion: m.pres } }))).toMatchObject({ activo: true, cantidadBase: 1 });
  }, 90000);
  it.each(['desactivar', 'cantidadBase'] as const)('Admin entra primero: carrito %s revalida después del lock', async operation => {
    const f = await fixture(149); const m = await matrix(f); const c = await cart(f.vs, f.pres, [1]);
    await db.carritoDetalle.deleteMany({ where: { idCarrito: c.id } });
    const locked = latch(); const release = latch(); let pid = 0;
    const original = adminRepo.editarPresentacion;
    vi.spyOn(adminRepo, 'editarPresentacion').mockImplementation(async (tx, id, data) => {
      const r = await original(tx, id, data); const [p] = await tx.$queryRaw<Array<{pid:number}>>`SELECT pg_backend_pid() pid`; pid = p.pid; locked.resolve(); await release.promise; return r;
    });
    const edit = admin.guardarPresentacion(m.product, m.pres, operation === 'desactivar' ? { activo: false } : { cantidadBase: 100 });
    await Promise.race([locked.promise, edit.then(() => { throw new Error('Edit terminó antes del lock'); })]);
    const add = cartRepo.agregarItemAtomico(c.user, f.vs[0], m.pres, 2).then(() => null, e => e as Error);
    try { await waitBlocked(pid); } finally { release.resolve(); await Promise.allSettled([edit, add]); }
    await edit; expect((await add)?.message).toContain(operation === 'desactivar' ? 'CART_VARIANT_NOT_AVAILABLE' : 'CART_INSUFFICIENT_STOCK');
    expect(await db.carritoDetalle.count({ where: { idCarrito: c.id } })).toBe(0);
  }, 90000);
});
