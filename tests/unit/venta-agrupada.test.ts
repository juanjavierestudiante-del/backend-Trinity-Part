import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/config/prisma.js', () => ({ default: {} }));
const { resolverVentasAgrupadasConContextos } = await import('../../src/services/resolucion-comercial.service.js');
const regla = (cantidadMinima: number, precio: string) => ({ idReglaPrecio: cantidadMinima, nombre: 'Umbral', cantidadMinima, precioPorPresentacion: new Prisma.Decimal(precio), principal: cantidadMinima === 1, activo: true, orden: cantidadMinima });
const contexto = (idVariante: number, idPresentacion = 1, idPerfilPrecio = 1, base = 1) => ({ idProducto: 6, idVariante, presentacion: { idPresentacion, nombre: base === 1 ? 'Unidad' : 'Pack x50', cantidadBase: base }, perfilPrecio: { idPerfilPrecio, nombre: 'Perfil' }, listaPrecio: { idListaPrecio: idPresentacion * 100 + idPerfilPrecio, nombre: 'Lista', reglas: [regla(1,'10'), regla(6,'7.92'), regla(60,'6.83')] } });
describe('pricing comercial por líneas de carrito/pedido', () => {
 it.each([[3,3,'7.92','47.52'],[30,30,'6.83','409.80']])('Cortina %i + %i agrupa y mantiene decimales', (a,b,precio,total) => {
  const r=resolverVentasAgrupadasConContextos([{idVariante:1,cantidad:a},{idVariante:2,cantidad:b}],[contexto(1),contexto(2)]);
  expect(r.grupos).toHaveLength(1); expect(r.grupos[0].cantidadPresentaciones).toBe(a+b);
  expect(r.lineas[0].precioPorPresentacion.toString()).toBe(precio); expect(r.total.toFixed(2)).toBe(total);
  expect(r.lineas[0].subtotal.equals(new Prisma.Decimal(precio).mul(a))).toBe(true);
 });
 it('LED 5 + 7 alcanza 12 y conserva 4.42 exactamente', () => {
  const cs=[contexto(1),contexto(2)]; cs.forEach(c=>c.listaPrecio.reglas=[regla(1,'5'),regla(12,'4.42')]);
  const r=resolverVentasAgrupadasConContextos([{idVariante:1,cantidad:5},{idVariante:2,cantidad:7}],cs);
  expect(r.lineas.map(l=>l.subtotal.toFixed(2))).toEqual(['22.10','30.94']); expect(r.total.toFixed(2)).toBe('53.04');
 });
 it('misma variante en dos presentaciones conserva ambas líneas y separa grupos', () => {
  const r=resolverVentasAgrupadasConContextos([{idVariante:1,idPresentacion:1,cantidad:5},{idVariante:1,idPresentacion:2,cantidad:3}],[contexto(1),contexto(1,2,1,50)]);
  expect(r.grupos).toHaveLength(2);expect(r.lineas.map(l=>l.cantidadBaseTotal)).toEqual([5,150]);
 });
 it('perfiles distintos no suman umbral', () => {
  const cs=[contexto(1),contexto(2,1,2)];cs.forEach(c=>c.listaPrecio.reglas=[regla(1,'5'),regla(12,'3')]);
  const r=resolverVentasAgrupadasConContextos([{idVariante:1,cantidad:6},{idVariante:2,cantidad:6}],cs);
  expect(r.grupos).toHaveLength(2);expect(r.lineas.map(l=>l.precioPorPresentacion.toString())).toEqual(['5','5']);
 });
 it('no evalúa umbral individual cuando solo el grupo alcanza la regla mínima', () => {
  const cs=[contexto(1),contexto(2)];cs.forEach(c=>c.listaPrecio.reglas=[regla(12,'3')]);
  expect(resolverVentasAgrupadasConContextos([{idVariante:1,cantidad:5},{idVariante:2,cantidad:7}],cs).total.toString()).toBe('36');
 });
 it('rechaza contextos cruzados',()=>expect(()=>resolverVentasAgrupadasConContextos([{idVariante:1,cantidad:1}],[contexto(2)])).toThrow('contexto no corresponde'));
});
