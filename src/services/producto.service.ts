// Lógica de negocio para Producto.

import { Prisma, EstadoProducto } from '@prisma/client';
import * as productoRepository from '../repositories/producto.repository.js';
import * as categoriaRepository from '../repositories/categoria.repository.js';
import { generarSlug, AppError, type Paginacion } from '../utils/helpers.js';
import { esAtributoColor } from '../utils/atributo.helpers.js';
import type { CrearProductoInput, ActualizarProductoInput } from '../validations/producto.validation.js';
//filtro por busqueda categiria y estado priemro hcamos un interdaz
interface FiltrosProducto {
  estado?: string; 
  categoria? :string;
  q?: string;
}

const resolverIdsCategorias = async (categoria?: string) => {
  if (!categoria) return undefined;

  // 🔥 Si viene categoría, resolvemos TODO el árbol
  return categoriaRepository.getIdsDescendientes(categoria);
};

export const listar = async (
  filtros: FiltrosProducto,
  paginacion: Paginacion = { page: 1, limit: 20 }
) => {
  const idsCategorias = await resolverIdsCategorias(filtros.categoria);

  return productoRepository.findAll(
    {
      estado: filtros.estado as EstadoProducto | undefined,
      idsCategorias,
      busqueda: filtros.q,
    },
    paginacion.page,
    paginacion.limit
  );
};

// Listado admin sin paginar (mismo filtrado, shape de array).
export const listarTodos = async (filtros: FiltrosProducto) => {
  const idsCategorias = await resolverIdsCategorias(filtros.categoria);

  return productoRepository.findAllSinPaginacion({
    estado: filtros.estado as EstadoProducto | undefined,
    idsCategorias,
    busqueda: filtros.q,
  });
};

export const obtenerPorId = async (idProducto: number | string) => {
  const producto = await productoRepository.findById(idProducto);
  if (!producto) {
    throw new AppError('Producto no encontrado', 404);
  }

console.log(producto?.rating);
  return producto;
};

export const obtenerPorSlug = async (slug: string) => {
  const producto = await productoRepository.findBySlug(slug);
  if (!producto) {
    throw new AppError('Producto no encontrado', 404);
  }
  return producto;
};

export const crear = (datos: CrearProductoInput) => {
  const slug = generarSlug(datos.nombre);

  const { idCategoria, idAtributoPrincipal, ...resto } = datos;

  if (idAtributoPrincipal != null) {
    throw new AppError('El atributo principal solo puede asignarse cuando el producto ya usa ese atributo en una variante', 400);
  }

  return productoRepository.create({
    ...resto,
    slug,
    categoria: {
      connect: {
        idCategoria,
      },
    },
  });
};

export const actualizar = async (idProducto: number | string, datos: ActualizarProductoInput) => {
  const producto = await obtenerPorId(idProducto);
  const data: Record<string, unknown> = { ...datos };
  if (datos.nombre) {
    data.slug = generarSlug(datos.nombre);
  }
  if (datos.idCategoria) {
    data.categoria = { connect: { idCategoria: datos.idCategoria } };
    delete data.idCategoria;
  }

  if (Object.prototype.hasOwnProperty.call(datos, 'idAtributoPrincipal')) {
    delete data.idAtributoPrincipal;
    if (datos.idAtributoPrincipal === null) {
      data.atributoPrincipal = { disconnect: true };
    } else if (datos.idAtributoPrincipal !== undefined) {
      const atributo = await productoRepository.atributoExiste(datos.idAtributoPrincipal);
      if (!atributo) {
        throw new AppError('El atributo principal indicado no existe', 400);
      }
      const usos = await productoRepository.productoUsaAtributo(producto.idProducto, atributo.idAtributo);
      if (usos === 0) {
        throw new AppError('El atributo principal debe estar asignado a al menos una variante del producto', 400);
      }
      data.atributoPrincipal = { connect: { idAtributo: atributo.idAtributo } };
    }
  }
  return productoRepository.update(idProducto, data as Prisma.ProductoUpdateInput);
};

export const sugerirAtributoPrincipalColor = async (idProducto: number | string) => {
  const atributos = await productoRepository.atributosUsadosPorProducto(idProducto);
  return atributos.find((atributo) => esAtributoColor(atributo.nombre)) ?? null;
};

export const eliminar = async (idProducto: number | string) => {
  await obtenerPorId(idProducto);
  return productoRepository.remove(idProducto);
};
