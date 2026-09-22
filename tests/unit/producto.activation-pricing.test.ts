import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  tienePrecioPrincipalInicial: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../src/repositories/producto.repository.js', () => ({
  findById: mocks.findById,
  tienePrecioPrincipalInicial: mocks.tienePrecioPrincipalInicial,
  update: mocks.update,
  atributoExiste: vi.fn(),
  productoUsaAtributo: vi.fn(),
}));
vi.mock('../../src/repositories/categoria.repository.js', () => ({ getIdsDescendientes: vi.fn() }));

const productoService = await import('../../src/services/producto.service.js');
const { crearVarianteSchema, actualizarVarianteSchema } = await import('../../src/validations/productoVariante.validation.js');

const producto = { idProducto: 4, listaPrecios: [], variantes: [], rating: 4 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findById.mockResolvedValue(producto);
  mocks.update.mockResolvedValue(producto);
});

describe('activación de producto con pricing', () => {
  it('rechaza activar un producto sin lista principal y regla 1+', async () => {
    mocks.tienePrecioPrincipalInicial.mockResolvedValue(false);

    await expect(productoService.actualizar(4, { estado: 'Activo' })).rejects.toMatchObject({
      message: 'Configura una lista de precios principal con precio desde 1 presentación antes de activar el producto.',
      statusCode: 400,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('permite activar un producto con precio principal desde una presentación', async () => {
    mocks.tienePrecioPrincipalInicial.mockResolvedValue(true);

    await productoService.actualizar(4, { estado: 'Activo' });

    expect(mocks.update).toHaveBeenCalledWith(4, { estado: 'Activo' });
  });

  it('no permite crear un producto activo antes de configurar precios', () => {
    expect(() => productoService.crear({ idCategoria: 1, nombre: 'Producto nuevo', estado: 'Activo' })).toThrow(
      'Configura una lista de precios principal con precio desde 1 presentación antes de activar el producto.',
    );
  });
});

describe('contrato de variante sin precio legacy', () => {
  it('crea y actualiza una variante sin campos monetarios', () => {
    expect(crearVarianteSchema.parse({ idProducto: 4, sku: 'LISTA-001' })).toMatchObject({
      idProducto: 4,
      sku: 'LISTA-001',
      cantidadContenido: 1,
    });
    expect(actualizarVarianteSchema.parse({ sku: 'LISTA-002' })).toEqual({ sku: 'LISTA-002' });
  });
});
