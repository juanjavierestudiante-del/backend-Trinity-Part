import type { PrismaClient, Prisma } from '@prisma/client';

const enabled = process.env.VENTAS_POSTGRES_DIAGNOSTICO === '1';
type Timing = { operation: string; ms: number; code?: string };
type Session = { app: string; state: string | null; wait_type: string | null; wait: string | null; connections: number; transaction_ms: number | null };
let name = 'setup';
let started = performance.now();
let running = 0;
let peak = 0;
let timings: Timing[] = [];

export const diagnostics = {
  async operation<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now(); let failed = false;
    try { return await fn(); }
    catch (error) { failed = true; throw error; }
    finally {
      if (enabled) console.log('[postgres-diagnostic]', JSON.stringify({ test: name, operation,
        duration_ms: Math.round(performance.now()-start), failed }));
    }
  },
  attach(client: PrismaClient, label: string) {
    if (!enabled) return;
    const middleware: Prisma.Middleware = async (params, next) => {
      const start = performance.now();
      let code: string | undefined;
      try { return await next(params); }
      catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error) code = String(error.code);
        throw error;
      } finally {
        const raw = params.args as { query?: unknown } | undefined;
        const table = typeof raw?.query === 'string' ? raw.query.match(/\b(?:FROM|UPDATE|INTO)\s+"?([a-z_]+)/i)?.[1] : undefined;
        const operation = `${label}.${params.model ?? table ?? 'raw'}.${params.action}`;
        timings.push({ operation, ms: Math.round(performance.now() - start), ...(code ? { code } : {}) });
      }
    };
    client.$use(middleware);
  },
  async sessions(db: PrismaClient, stage: string) {
    const rows = await db.$queryRaw<Session[]>`SELECT application_name AS app, state, wait_event_type AS wait_type, wait_event AS wait,
      count(*)::int AS connections,
      max(EXTRACT(epoch FROM clock_timestamp()-xact_start)*1000)::float8 AS transaction_ms
      FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()
      GROUP BY application_name,state,wait_event_type,wait_event`;
    if (enabled) console.log('[postgres-diagnostic]', JSON.stringify({ test: name, stage, sessions: rows }));
    return rows;
  },
  begin(test: string) {
    name = test; started = performance.now(); timings = []; running++; peak = Math.max(peak, running);
  },
  end() {
    if (enabled) console.log('[postgres-diagnostic]', JSON.stringify({ test: name,
      duration_ms: Math.round(performance.now() - started), active_tests_peak: peak,
      operations: timings.length, operation_total_ms: timings.reduce((sum, t) => sum + t.ms, 0),
      slow: timings.filter(t => t.ms >= 500), errors: timings.filter(t => t.code) }));
    running--;
  },
  blocked(blocker: number, blocked: number, waitMs: number) {
    if (enabled) console.log('[postgres-diagnostic]', JSON.stringify({ test: name, blocker, blocked, observation_ms: Math.round(waitMs) }));
  },
};
