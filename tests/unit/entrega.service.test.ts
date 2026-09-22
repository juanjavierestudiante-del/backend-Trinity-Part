import { beforeEach, describe, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({listarPublicos:vi.fn(),listarAdmin:vi.fn(),configuracion:vi.fn(),crear:vi.fn(),buscar:vi.fn(),contarRecojosActivos:vi.fn(),actualizar:vi.fn(),actualizarConfiguracion:vi.fn()}));
vi.mock('../../src/repositories/entrega.repository.js',()=>m);
const s=await import('../../src/services/entrega.service.js');
beforeEach(()=>vi.clearAllMocks());
describe('logística 5B',()=>{
 it('lista puntos públicos por tipo',async()=>{m.listarPublicos.mockResolvedValue([]);await s.publicos('PUNTO_ENTREGA');expect(m.listarPublicos).toHaveBeenCalledWith('PUNTO_ENTREGA')});
 it('traduce duplicado a 409',async()=>{m.crear.mockRejectedValue({code:'P2002'});await expect(s.crear({})).rejects.toMatchObject({statusCode:409})});
 it('rechaza punto inexistente',async()=>{m.buscar.mockResolvedValue(null);await expect(s.editar(9,{})).rejects.toMatchObject({statusCode:404})});
 it('protege último recojo activo',async()=>{m.buscar.mockResolvedValue({tipo:'RECOJO_TIENDA',activo:true});m.contarRecojosActivos.mockResolvedValue(1);await expect(s.editar(1,{activo:false})).rejects.toMatchObject({statusCode:409})});
 it('permite desactivar recojo cuando hay otro',async()=>{m.buscar.mockResolvedValue({tipo:'RECOJO_TIENDA',activo:true});m.contarRecojosActivos.mockResolvedValue(2);m.actualizar.mockResolvedValue({activo:false});await expect(s.editar(1,{activo:false})).resolves.toMatchObject({activo:false})});
 it('singleton actualiza mediante repositorio',async()=>{m.actualizarConfiguracion.mockResolvedValue({id:1});await s.actualizarConfig({montoMinimoDelivery:200});expect(m.actualizarConfiguracion).toHaveBeenCalled()});
});
