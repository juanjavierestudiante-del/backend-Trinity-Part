import * as repo from '../repositories/entrega.repository.js'; import { AppError } from '../utils/helpers.js'; import type { TipoPuntoEntrega } from '@prisma/client';
export const publicos=async(tipo?:TipoPuntoEntrega)=>repo.listarPublicos(tipo);
export const admin=()=>repo.listarAdmin(); export const config=()=>repo.configuracion();
export const crear=async(data:any)=>{try{return await repo.crear(data)}catch(e:any){if(e.code==='P2002')throw new AppError('Ya existe un punto con ese nombre',409);throw e}};
export const editar=async(id:number,data:any)=>{const p=await repo.buscar(id);if(!p)throw new AppError('Punto de entrega no encontrado',404);if(p.tipo==='RECOJO_TIENDA'&&p.activo&&!data.activo&&await repo.contarRecojosActivos()<=1)throw new AppError('Debe existir un punto activo de recojo en tienda',409);return repo.actualizar(id,data)};
export const actualizarConfig=(data:any)=>repo.actualizarConfiguracion(data);
