export const normalizarNombreAtributo = (valor: string) =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

export const esAtributoColor = (nombre: string) => normalizarNombreAtributo(nombre) === 'color';
