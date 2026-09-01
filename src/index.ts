import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import cors from 'cors';
import { setupDatabase } from './seeders';
import { routes } from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorMiddleware';
import { requestLoggingMiddleware } from './middleware/requestLogging';
import { logger, registerProcessErrorHandlers } from './lib/logger';
import { initializeSocketServer } from './lib/socketServer';
import {runTest} from './scripts/testDataVerification';

const app = express();
const server = http.createServer(app);
registerProcessErrorHandlers();

app.use(cors({ exposedHeaders: ['X-Total-Count'] }));
app.use(express.json({ limit: '50mb' }));
app.use(requestLoggingMiddleware);

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', requestId: req.requestId });
});

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await setupDatabase();
  initializeSocketServer(server);
  // await runTest();
  server.listen(PORT, () => {
    logger.info('server_started', { port: Number(PORT) });
  });
};

startServer().catch((error) => {
  logger.error('server_startup_failed', { error });
  process.exit(1);
});

export default app;
