// Logger simple. Si más adelante necesitas algo más robusto, podrías
// reemplazar esto por winston o pino sin tocar el resto del proyecto.

export const logger = {
  info: (msg: string, ...args: unknown[]) => console.log(`ℹ️  ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => console.warn(`⚠️  ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => console.error(`❌ ${msg}`, ...args),
};
