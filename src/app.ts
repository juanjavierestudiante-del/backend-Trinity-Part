import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import routes from './routes/index.js';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware.js';
import { env } from './config/env.js';

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || env.cors.origins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
}));
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
