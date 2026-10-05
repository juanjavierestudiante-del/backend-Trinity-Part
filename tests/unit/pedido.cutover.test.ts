import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({transaction:vi.fn(), pricing:vi.fn(), read:vi.fn()}));
vi.mock('../../src/config/prisma.js',()=>({default:{$transaction:m.transaction}}));
vi.mock('../../src/services/resolucion-comercial.service.js',()=>({resolverVentasAgrupadasParaCheckout:m.pricing}));
vi.mock('../../src/repositories/pedido.repository.js',()=>({findByIdEnTx:m.read}));
const service=await import('../../src/services/pedido.service.js');
const contacto={nombreContacto:'Cliente Prueba',telefonoContacto:'71234567',direccionEntrega:null};
const setup=()=>{
 const items=[{idVariante:2,idPresentacion:1,cantidad:5,variante:{sku:'DORADO'}},{idVariante:2,idPresentacion:2,cantidad:3,variante:{sku:'DORADO'}}];
 const tx={$queryRaw:vi.fn().mockResolvedValue([]),carrito:{findUnique:vi.fn().mockResolvedValue({idCarrito:1,items})},inventario:{updateMany:vi.fn().mockResolvedValue({count:1}),findUniqueOrThrow:vi.fn().mockResolvedValue({stockActual:1845}),update:vi.fn().mockResolvedValue({stockActual:2000})},pedido:{create:vi.fn().mockResolvedValue({idPedido:5}),findUnique:vi.fn(),updateMany:vi.fn().mockResolvedValue({count:1})},movimientoInventario:{createMany:vi.fn(),create:vi.fn()},carritoDetalle:{deleteMany:vi.fn()}};
 m.transaction.mockImplementation(async cb=>cb(tx));m.read.mockResolvedValue({idPedido:5,estado:'CANCELADO'});
 m.pricing.mockResolvedValue({lineas:items.map((i,k)=>({idVariante:i.idVariante,cantidadBaseTotal:i.cantidad*(k===0?1:50),presentacion:{idPresentacion:i.idPresentacion,nombre:k===0?'Unidad':'Pack x50',cantidadBase:k===0?1:50},precioPorPresentacion:new Prisma.Decimal(k===0?'5':'50')})),total:new Prisma.Decimal('175')});return tx;
};
beforeEach(()=>vi.clearAllMocks());
describe('cutover checkout/cancelación',()=>{
 it('coordinador bloquea carrito, variantes y presentaciones antes de pricing protegido', async () => {
  const tx = setup(); await service.crear(1, contacto);
  const sql = tx.$queryRaw.mock.calls.map(([parts]) => parts.join(''));
  expect(sql[0]).toContain('FROM carrito'); expect(sql[0]).toContain('FOR UPDATE');
  expect(sql[1]).toContain('FROM producto_variante'); expect(sql[1]).toContain('FOR SHARE');
  expect(sql[2]).toContain('FROM presentacion_venta'); expect(sql[2]).toContain('FOR SHARE');
  expect(m.pricing.mock.invocationCallOrder[0]).toBeGreaterThan(tx.$queryRaw.mock.invocationCallOrder[2]);
 });
 it('agrega consumo de dos presentaciones y descuenta una vez por variante',async()=>{const tx=setup();await service.crear(1,contacto);expect(tx.inventario.updateMany).toHaveBeenCalledExactlyOnceWith({where:{idVariante:2,stockActual:{gte:155}},data:{stockActual:{decrement:155}}});expect(tx.movimientoInventario.createMany.mock.calls[0][0].data).toMatchObject([{cantidad:155,stockAnterior:2000,stockNuevo:1845}]);});
 it('guarda precio por presentación y ambos snapshots independientes',async()=>{const tx=setup();await service.crear(1,contacto);const d=tx.pedido.create.mock.calls[0][0].data.items.create;expect(d).toMatchObject([{cantidad:5,idPresentacion:1,presentacionNombre:'Unidad',cantidadBasePresentacion:1},{cantidad:3,idPresentacion:2,presentacionNombre:'Pack x50',cantidadBasePresentacion:50}]);expect(d.map(x=>x.precioUnitario.toString())).toEqual(['5','50']);});
 it('stock insuficiente aborta antes de crear pedido o vaciar carrito',async()=>{const tx=setup();tx.inventario.updateMany.mockResolvedValue({count:0});await expect(service.crear(1,contacto)).rejects.toThrow('Stock insuficiente');expect(tx.pedido.create).not.toHaveBeenCalled();expect(tx.carritoDetalle.deleteMany).not.toHaveBeenCalled();});
 it('fallo creando pedido no vacía carrito ni registra salida',async()=>{const tx=setup();tx.pedido.create.mockRejectedValue(new Error('Fallo creación'));await expect(service.crear(1,contacto)).rejects.toThrow('Fallo creación');expect(tx.carritoDetalle.deleteMany).not.toHaveBeenCalled();expect(tx.movimientoInventario.createMany).not.toHaveBeenCalled();});
 it('checkout exitoso vacía carrito después del pedido y movimiento',async()=>{const tx=setup();await service.crear(1,contacto);expect(tx.carritoDetalle.deleteMany).toHaveBeenCalledWith({where:{idCarrito:1}});expect(tx.carritoDetalle.deleteMany.mock.invocationCallOrder[0]).toBeGreaterThan(tx.movimientoInventario.createMany.mock.invocationCallOrder[0]);});
 it('cancelación repone 155 desde snapshots y agrega una entrada',async()=>{const tx=setup();tx.pedido.findUnique.mockResolvedValue({idPedido:5,estado:'PENDIENTE',items:[{idVariante:2,cantidad:5,cantidadBasePresentacion:1},{idVariante:2,cantidad:3,cantidadBasePresentacion:50}]});await service.cambiarEstado(5,'CANCELADO');expect(tx.inventario.updateMany).toHaveBeenCalledExactlyOnceWith({where:{idVariante:2,stockActual:{lte:2147483492}},data:{stockActual:{increment:155}}});expect(tx.movimientoInventario.create).toHaveBeenCalledTimes(1);});
 it('pedido ya cancelado no vuelve a reponer',async()=>{const tx=setup();tx.pedido.findUnique.mockResolvedValue({idPedido:5,estado:'CANCELADO',items:[]});await service.cambiarEstado(5,'CANCELADO');expect(tx.inventario.update).not.toHaveBeenCalled();});
 it('confirmación no descuenta nuevamente',async()=>{const tx=setup();tx.pedido.findUnique.mockResolvedValue({idPedido:5,estado:'PENDIENTE',items:[]});await service.cambiarEstado(5,'CONFIRMADO');expect(tx.inventario.updateMany).not.toHaveBeenCalled();expect(tx.inventario.update).not.toHaveBeenCalled();});
});
