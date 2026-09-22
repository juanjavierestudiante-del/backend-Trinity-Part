import * as repository from '../repositories/precio-cantidad.repository.js';
import { Prisma } from '@prisma/client';
import { ErrorPrecioCantidad, type ContextoListaPrecio, type LineaPrecioResuelta, type LineaPrecioSolicitada, type ListaPrecioAplicable, type ResultadoPreciosAgrupados, type ResultadoPrecioVariante } from '../types/precio-cantidad.types.js';
import { resolverPrecioUmbral, validarCantidadPrecio } from '../utils/resolver-precio-umbral.js';

export const obtenerListaPrecioEfectivaConContexto = (contexto: ContextoListaPrecio): ListaPrecioAplicable => {
  const lista = contexto.listaAsignada ?? contexto.listaPrincipal;
  if (!lista || !lista.activo) throw new ErrorPrecioCantidad('SIN_LISTA_PRECIO');
  return lista;
};

export const resolverPrecioLista = (lista: ListaPrecioAplicable, cantidad: number) => resolverPrecioUmbral(cantidad, lista.reglas);

export const resolverPrecioVarianteConContexto = (contexto: ContextoListaPrecio, cantidad: number): ResultadoPrecioVariante => {
  const lista = obtenerListaPrecioEfectivaConContexto(contexto);
  return { idVariante: contexto.idVariante, idProducto: contexto.idProducto, idListaPrecioEfectiva: lista.idListaPrecio, ...resolverPrecioLista(lista, cantidad) };
};

export const resolverPrecioVariante = async (idVariante: number, cantidad: number): Promise<ResultadoPrecioVariante> => {
  validarCantidadPrecio(cantidad);
  const contexto = await repository.obtenerContextoListaPrecio(idVariante);
  if (!contexto) throw new ErrorPrecioCantidad('VARIANTE_NO_ENCONTRADA');
  return resolverPrecioVarianteConContexto(contexto, cantidad);
};

export const resolverPrecio = resolverPrecioVariante;

export const resolverPreciosAgrupadosConContextos = (
  lineas: LineaPrecioSolicitada[],
  contextos: ContextoListaPrecio[]
): ResultadoPreciosAgrupados => {
  const porVariante = new Map(contextos.map((contexto) => [contexto.idVariante, contexto]));
  const vistos = new Set<number>();
  const grupos = new Map<string, { idProducto: number; lista: ListaPrecioAplicable; cantidad: number }>();

  for (const linea of lineas) {
    validarCantidadPrecio(linea.cantidad);
    if (vistos.has(linea.idVariante)) throw new ErrorPrecioCantidad('CANTIDAD_INVALIDA');
    vistos.add(linea.idVariante);
    const contexto = porVariante.get(linea.idVariante);
    if (!contexto) throw new ErrorPrecioCantidad('VARIANTE_NO_ENCONTRADA');
    const lista = obtenerListaPrecioEfectivaConContexto(contexto);
    const clave = `${contexto.idProducto}:${lista.idListaPrecio}`;
    const grupo = grupos.get(clave);
    if (grupo) grupo.cantidad += linea.cantidad;
    else grupos.set(clave, { idProducto: contexto.idProducto, lista, cantidad: linea.cantidad });
  }

  const resultadoGrupos = new Map<string, ReturnType<typeof resolverPrecioLista>>();
  const gruposResueltos = [...grupos.entries()].map(([clave, grupo]) => {
    const resultado = resolverPrecioLista(grupo.lista, grupo.cantidad);
    resultadoGrupos.set(clave, resultado);
    return {
      idProducto: grupo.idProducto,
      idListaPrecio: grupo.lista.idListaPrecio,
      cantidadTotal: grupo.cantidad,
      ...resultado,
      subtotalGrupo: resultado.subtotal,
    };
  });

  const lineasResueltas: LineaPrecioResuelta[] = lineas.map((linea) => {
    const contexto = porVariante.get(linea.idVariante)!;
    const lista = obtenerListaPrecioEfectivaConContexto(contexto);
    const grupo = resultadoGrupos.get(`${contexto.idProducto}:${lista.idListaPrecio}`)!;
    return {
      idVariante: linea.idVariante,
      idProducto: contexto.idProducto,
      idListaPrecioEfectiva: lista.idListaPrecio,
      cantidad: linea.cantidad,
      idReglaPrecio: grupo.idReglaPrecio,
      cantidadMinimaAplicada: grupo.cantidadMinimaAplicada,
      precioPorPresentacion: grupo.precioPorPresentacion,
      subtotal: new Prisma.Decimal(linea.cantidad).mul(grupo.precioPorPresentacion),
    };
  });
  const total = lineasResueltas.reduce((acumulado, linea) => acumulado.plus(linea.subtotal), new Prisma.Decimal(0));
  return { grupos: gruposResueltos, lineas: lineasResueltas, total };
};

export const resolverPreciosAgrupados = async (
  lineas: LineaPrecioSolicitada[],
  db?: Prisma.TransactionClient
): Promise<ResultadoPreciosAgrupados> => {
  const contextos = await repository.obtenerContextosListaPrecio(lineas.map((linea) => linea.idVariante), db);
  return resolverPreciosAgrupadosConContextos(lineas, contextos);
};
