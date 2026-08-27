import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../utils/helpers.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { crearVarianteSchema, actualizarVarianteSchema } from '../../validations/productoVariante.validation.js';
import * as varianteRepository from '../../repositories/productoVariante.repository.js';

const router = Router();

router.get('/producto/:idProducto', asyncHandler(async (req: Request, res: Response) => {
  const variantes = await varianteRepository.findByProducto(req.params.idProducto);
  res.json(variantes);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const variante = await varianteRepository.findById(req.params.id);
  if (!variante) {
    res.status(404).json({ error: 'Variante no encontrada' });
    return;
  }
  res.json(variante);
}));

router.post('/', validate(crearVarianteSchema), asyncHandler(async (req: Request, res: Response) => {
  // El repository crea la variante + su inventario inicial en la misma transacción
  const { idProducto, idMarca, idUnidad, ...resto } = req.body;
  const variante = await varianteRepository.create({
    ...resto,
    producto: { connect: { idProducto } },
    ...(idMarca ? { marca: { connect: { idMarca } } } : {}),
    ...(idUnidad ? { unidad: { connect: { idUnidad } } } : {}),
  });
  res.status(201).json(variante);
}));

router.put('/:id', validate(actualizarVarianteSchema), asyncHandler(async (req: Request, res: Response) => {
  const variante = await varianteRepository.update(req.params.id, req.body);
  res.json(variante);
}));

router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await varianteRepository.remove(req.params.id);
  res.status(204).send();
}));

export default router;
