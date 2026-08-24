// Controlador de Categoría.

import type { Request, Response } from 'express';
import * as categoriaService from '../services/categoria.service.js';
import * as cloudinaryService from '../services/cloudinary.service.js';
import prisma from '../config/prisma.js';
import { asyncHandler, AppError } from '../utils/helpers.js';

export const listar = asyncHandler(async (req: Request, res: Response) => {
  const categorias = await categoriaService.listar();
  res.json(categorias);
});

export const listarRaiz = asyncHandler(async (req: Request, res: Response) => {
  const categorias = await categoriaService.listarRaiz();
  res.json(categorias);
});

export const obtenerPorId = asyncHandler(async (req: Request, res: Response) => {
  const categoria = await categoriaService.obtenerPorIdConHijos(req.params.id);
  res.json(categoria);
});

export const crear = asyncHandler(async (req: Request, res: Response) => {
  const datos = { ...req.body };

  // Si se subió imagen, guardarla en Cloudinary
  if (req.file) {
    const { publicId, url } = await cloudinaryService.subirImagen(req.file.buffer, 'categorias');
    datos.imagenPublicId = publicId;
    datos.imagenUrl = url;
  }

  // Convertir orden a number si viene como string
  if (datos.orden !== undefined) {
    datos.orden = Number(datos.orden);
  }

  // [Bug solucionado] Convertir idCategoriaPadre de string a number
  // FormData envía todo como string, pero Prisma espera number
  if (datos.idCategoriaPadre === '') {
    datos.idCategoriaPadre = null;
  } else if (
    datos.idCategoriaPadre !== undefined &&
    datos.idCategoriaPadre !== null
  ) {
    datos.idCategoriaPadre = Number(datos.idCategoriaPadre);
  }

  const categoria = await categoriaService.crear(datos);
  res.status(201).json(categoria);
});

export const actualizar = asyncHandler(async (req: Request, res: Response) => {
  const datos = { ...req.body };
  const { id } = req.params;

  // [Bug solucionado] Obtener categoría actual ANTES de procesar, para tener acceso
  // a la imagen anterior tanto para eliminar como para reemplazar
  const categoriaActual = await categoriaService.obtenerPorId(id);

  // [Bug solucionado] Si se pide eliminar la imagen
  if (datos.eliminarImagen === 'true' || datos.eliminarImagen === true) {
    if (categoriaActual.imagenPublicId) {
      await cloudinaryService.borrarImagen(categoriaActual.imagenPublicId);
    }
    datos.imagenPublicId = null;
    datos.imagenUrl = null;
    delete datos.eliminarImagen;
  }
  // [Bug solucionado] Si se subió una imagen nueva, subirla a Cloudinary
  // y eliminar la anterior si existía
  else if (req.file) {
    if (categoriaActual.imagenPublicId) {
      await cloudinaryService.borrarImagen(categoriaActual.imagenPublicId);
    }
    const { publicId, url } = await cloudinaryService.subirImagen(req.file.buffer, 'categorias');
    datos.imagenPublicId = publicId;
    datos.imagenUrl = url;
  }

  // Convertir orden
  if (datos.orden !== undefined) {
    datos.orden = Number(datos.orden);
  }

  // Convertir categoría padre
  if (datos.idCategoriaPadre === '') {
    datos.idCategoriaPadre = null;
  } else if (
    datos.idCategoriaPadre !== undefined &&
    datos.idCategoriaPadre !== null
  ) {
    datos.idCategoriaPadre = Number(datos.idCategoriaPadre);
  }

  // Limpiar campos que no deben actualizarse
  delete datos.idCategoria;
  delete datos.slug;
  delete datos.imagen;

  const categoria = await categoriaService.actualizar(id, datos);
  res.json(categoria);
});

// Cambiar estado (inactivar/reactivar) - reemplaza al DELETE
export const cambiarEstado = asyncHandler(async (req: Request, res: Response) => {
  const { estado } = req.body;

  if (estado !== 'Activo' && estado !== 'Inactivo') {
    throw new AppError('Estado inválido. Usa "Activo" o "Inactivo".', 400);
  }

  const resultado = await categoriaService.cambiarEstado(req.params.id, estado);
  res.json(resultado);
});

// Eliminar físicamente (solo si no tiene hijos)
export const eliminar = asyncHandler(async (req: Request, res: Response) => {
  await categoriaService.eliminar(req.params.id);
  res.status(204).send();
});
