import type { RequestHandler } from 'express';

interface RateLimitOptions {
  windowMs: number;
  maxAttempts: number;
}

interface AttemptWindow {
  count: number;
  resetAt: number;
}

export const createRateLimiter = ({ windowMs, maxAttempts }: RateLimitOptions): RequestHandler => {
  const attempts = new Map<string, AttemptWindow>();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = attempts.get(key);
    const active = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;

    if (active.count >= maxAttempts) {
      res.set('Retry-After', String(Math.ceil((active.resetAt - now) / 1000)));
      res.status(429).json({ error: 'Demasiados intentos. Intenta nuevamente más tarde.' });
      return;
    }

    active.count += 1;
    attempts.set(key, active);
    next();
  };
};

export const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
});
