// Controlador de imágenes. Recibe el archivo (vía multer), lo sube a
// Cloudinary y guarda la referencia (public_id, url) en la tabla correspondiente.

import type { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import * as cloudinaryService from '../services/cloudinary.service.js';
import { asyncHandler } from '../utils/helpers.js';

// ── Imágenes de producto ──────────────────────────────────────────────

export const subirImagenProducto = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No se envió ningún archivo' });
    return;
  }

  const { idProducto } = req.params;
  const { principal = false, ordenImagen = 1 } = req.body;

  const { publicId, url } = await cloudinaryService.subirImagen(req.file.buffer, 'productos');

  const imagen = await prisma.imagenProducto.create({
    data: {
      idProducto: Number(idProducto),
      publicId,
      url,
      principal: Boolean(principal),
      ordenImagen: Number(ordenImagen),
    },
  });

  res.status(201).json(imagen);
});

export const eliminarImagenProducto = asyncHandler(async (req: Request, res: Response) => {
  const imagen = await prisma.imagenProducto.findUnique({ where: { idImagen: Number(req.params.id) } });
  if (!imagen) {
    res.status(404).json({ error: 'Imagen no encontrada' });
    return;
  }

  await cloudinaryService.borrarImagen(imagen.publicId);
  await prisma.imagenProducto.delete({ where: { idImagen: imagen.idImagen } });

  res.status(204).send();
});

// Subida múltiple de imágenes para producto (feedback parcial)
export const subirMultiplesImagenesProducto = asyncHandler(async (req: Request, res: Response) => {
  const { idProducto } = req.params;
  const archivos = req.files as Express.Multer.File[];

  if (!archivos || archivos.length === 0) {
    res.status(400).json({ error: 'No se enviaron archivos' });
    return;
  }

  const producto = await prisma.producto.findUnique({
    where: { idProducto: Number(idProducto) },
    include: { imagenes: true },
  });
  if (!producto) {
    res.status(404).json({ error: 'Producto no encontrado' });
    return;
  }

  const imagenesExistentes = producto.imagenes.length;
  if (imagenesExistentes + archivos.length > 20) {
    res.status(400).json({
      error: `Máximo 20 imágenes por producto. Ya tienes ${imagenesExistentes} y intentas subir ${archivos.length}.`,
    });
    return;
  }

  const primeraEsPrincipal = imagenesExistentes === 0;
  const resultados: { imagen?: any; error?: string; archivo: string }[] = [];

  for (const archivo of archivos) {
    try {
      const { publicId, url } = await cloudinaryService.subirImagen(archivo.buffer, 'productos');

      const imagen = await prisma.imagenProducto.create({
        data: {
          idProducto: Number(idProducto),
          publicId,
          url,
          principal: primeraEsPrincipal && resultados.length === 0,
          ordenImagen: imagenesExistentes + resultados.length + 1,
        },
      });

      resultados.push({ imagen, archivo: archivo.originalname });
    } catch (err: any) {
      resultados.push({
        error: err.message || 'Error al subir imagen',
        archivo: archivo.originalname,
      });
    }
  }

  const exitosas = resultados.filter((r) => r.imagen);
  const fallidas = resultados.filter((r) => r.error);

  res.status(exitosas.length > 0 ? 201 : 400).json({
    imagenes: exitosas.map((r) => r.imagen),
    fallidas,
    totalExitosas: exitosas.length,
    totalFallidas: fallidas.length,
  });
});

// Marcar una imagen de producto como principal (transacción)
export const marcarPrincipalProducto = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const imagen = await prisma.imagenProducto.findUnique({
    where: { idImagen: Number(id) },
  });
  if (!imagen) {
    res.status(404).json({ error: 'Imagen no encontrada' });
    return;
  }

  const imagenActualizada = await prisma.$transaction(async (tx) => {
    await tx.imagenProducto.updateMany({
      where: { idProducto: imagen.idProducto },
      data: { principal: false },
    });

    return tx.imagenProducto.update({
      where: { idImagen: imagen.idImagen },
      data: { principal: true },
    });
  });

  res.json(imagenActualizada);
});

// ── Imágenes de variante ──────────────────────────────────────────────

export const subirImagenVariante = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No se envió ningún archivo' });
    return;
  }

  const { idVariante } = req.params;
  const { principal = false, ordenImagen = 1 } = req.body;

  const { publicId, url } = await cloudinaryService.subirImagen(req.file.buffer, 'variantes');

  const imagen = await prisma.imagenVariante.create({
    data: {
      idVariante: Number(idVariante),
      publicId,
      url,
      principal: Boolean(principal),
      ordenImagen: Number(ordenImagen),
    },
  });

  res.status(201).json(imagen);
});

// Subida múltiple de imágenes para variante (feedback parcial por imagen)
export const subirMultiplesImagenesVariante = asyncHandler(async (req: Request, res: Response) => {
  const { idVariante } = req.params;
  const archivos = req.files as Express.Multer.File[];

  if (!archivos || archivos.length === 0) {
    res.status(400).json({ error: 'No se enviaron archivos' });
    return;
  }

  const variante = await prisma.productoVariante.findUnique({
    where: { idVariante: Number(idVariante) },
    include: { imagenes: true },
  });
  if (!variante) {
    res.status(404).json({ error: 'Variante no encontrada' });
    return;
  }

  // Límite total de 20 imágenes por variante
  const imagenesExistentes = variante.imagenes.length;
  if (imagenesExistentes + archivos.length > 20) {
    res.status(400).json({
      error: `Máximo 20 imágenes por variante. Ya tienes ${imagenesExistentes} y intentas subir ${archivos.length}.`,
    });
    return;
  }

  // La primera imagen nueva es principal si no hay imágenes previas
  const primeraEsPrincipal = imagenesExistentes === 0;

  const resultados: { imagen?: any; error?: string; archivo: string }[] = [];

  for (const archivo of archivos) {
    try {
      const { publicId, url } = await cloudinaryService.subirImagen(archivo.buffer, 'variantes');

      const imagen = await prisma.imagenVariante.create({
        data: {
          idVariante: Number(idVariante),
          publicId,
          url,
          principal: primeraEsPrincipal && resultados.length === 0,
          ordenImagen: imagenesExistentes + resultados.length + 1,
        },
      });

      resultados.push({ imagen, archivo: archivo.originalname });
    } catch (err: any) {
      resultados.push({
        error: err.message || 'Error al subir imagen',
        archivo: archivo.originalname,
      });
    }
  }

  const exitosas = resultados.filter((r) => r.imagen);
  const fallidas = resultados.filter((r) => r.error);

  res.status(exitosas.length > 0 ? 201 : 400).json({
    imagenes: exitosas.map((r) => r.imagen),
    fallidas,
    totalExitosas: exitosas.length,
    totalFallidas: fallidas.length,
  });
});

// Marcar una imagen como principal (transacción para evitar race conditions)
export const marcarPrincipalVariante = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const imagen = await prisma.imagenVariante.findUnique({
    where: { idImagen: Number(id) },
  });
  if (!imagen) {
    res.status(404).json({ error: 'Imagen no encontrada' });
    return;
  }

  const imagenActualizada = await prisma.$transaction(async (tx) => {
    await tx.imagenVariante.updateMany({
      where: { idVariante: imagen.idVariante },
      data: { principal: false },
    });

    return tx.imagenVariante.update({
      where: { idImagen: imagen.idImagen },
      data: { principal: true },
    });
  });

  res.json(imagenActualizada);
});

export const eliminarImagenVariante = asyncHandler(async (req: Request, res: Response) => {
  const imagen = await prisma.imagenVariante.findUnique({ where: { idImagen: Number(req.params.id) } });
  if (!imagen) {
    res.status(404).json({ error: 'Imagen no encontrada' });
    return;
  }

  await cloudinaryService.borrarImagen(imagen.publicId);
  await prisma.imagenVariante.delete({ where: { idImagen: imagen.idImagen } });

  res.status(204).send();
});

// ── Categorías ──────────────────────────────────────────────────────

export const subirImagenCategoria = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No se envió ningún archivo' });
    return;
  }

  const { idCategoria } = req.params;

  const categoria = await prisma.categoria.findUnique({ where: { idCategoria: Number(idCategoria) } });
  if (!categoria) {
    res.status(404).json({ error: 'Categoría no encontrada' });
    return;
  }

  if (categoria.imagenPublicId) {
    await cloudinaryService.borrarImagen(categoria.imagenPublicId);
  }

  const { publicId, url } = await cloudinaryService.subirImagen(req.file.buffer, 'categorias');

  const actualizada = await prisma.categoria.update({
    where: { idCategoria: Number(idCategoria) },
    data: { imagenPublicId: publicId, imagenUrl: url },
  });

  res.status(200).json(actualizada);
});

export const eliminarImagenCategoria = asyncHandler(async (req: Request, res: Response) => {
  const categoria = await prisma.categoria.findUnique({ where: { idCategoria: Number(req.params.id) } });
  if (!categoria) {
    res.status(404).json({ error: 'Categoría no encontrada' });
    return;
  }

  if (!categoria.imagenPublicId) {
    res.status(400).json({ error: 'La categoría no tiene imagen' });
    return;
  }

  await cloudinaryService.borrarImagen(categoria.imagenPublicId);
  await prisma.categoria.update({
    where: { idCategoria: Number(req.params.id) },
    data: { imagenPublicId: null, imagenUrl: null },
  });

  res.status(204).send();
});
