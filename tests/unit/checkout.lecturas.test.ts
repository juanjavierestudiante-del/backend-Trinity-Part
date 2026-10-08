import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { obtenerCarritoParaCheckout } from '../../src/repositories/pedido.repository.js';
import { obtenerListasComercialesParaCheckout, obtenerVariantesComercialesParaCheckout } from '../../src/repositories/resolucion-comercial.repository.js';

describe('lecturas consolidadas exclusivas de checkout', () => {
  it('distingue carrito inexistente de carrito sin líneas', async () => {
    const query = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{idCarrito:4,items:[]}]);
    const tx = {$queryRaw:query} as unknown as Prisma.TransactionClient;
    expect(await obtenerCarritoParaCheckout(1,tx)).toBeNull();
    expect(await obtenerCarritoParaCheckout(1,tx)).toEqual({idCarrito:4,items:[]});
  });
  it('sin variantes no consulta', async () => {
    const query=vi.fn();
    expect(await obtenerVariantesComercialesParaCheckout([],{$queryRaw:query} as unknown as Prisma.TransactionClient)).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
  it('sin identidades no consulta listas', async () => {
    const query=vi.fn();
    expect(await obtenerListasComercialesParaCheckout([],{$queryRaw:query} as unknown as Prisma.TransactionClient)).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
  it('convierte precios textuales a Decimal sin perder precisión ni filtrar reglas inactivas', async () => {
    const query=vi.fn().mockResolvedValue([{idListaPrecio:4,idProducto:1,idPresentacion:2,idPerfilPrecio:3,nombre:'Lista',reglas:[
      {idReglaPrecio:5,nombre:'Base',cantidadMinima:1,precioPorPresentacion:'7.92',principal:true,activo:true,orden:0},
      {idReglaPrecio:6,nombre:'Inactiva',cantidadMinima:12,precioPorPresentacion:'4.42',principal:false,activo:false,orden:1},
    ]}]);
    const result=await obtenerListasComercialesParaCheckout([{idProducto:1,presentacion:{idPresentacion:2},perfilPrecio:{idPerfilPrecio:3}}],{$queryRaw:query} as unknown as Prisma.TransactionClient);
    expect(result[0].reglas[0].precioPorPresentacion).toBeInstanceOf(Prisma.Decimal);
    expect(result[0].reglas[0].precioPorPresentacion.mul(3).toFixed(2)).toBe('23.76');
    expect(result[0].reglas[1].activo).toBe(false);
  });
});
