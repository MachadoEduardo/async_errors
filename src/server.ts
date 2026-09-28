import { randomUUID } from 'node:crypto';
import express, { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from './app-error';
import { logger, storage } from './logger';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export const app = express();

app.use((req, res, next) => {
  const incoming = req.header('x-request-id');
  const id = incoming?.trim() || randomUUID();
  req.requestId = id;
  res.setHeader('x-request-id', id);
  storage.run({ requestId: id }, () => {
    logger.info('requisição recebida');
    next();
  });
});

const asyncRoute = (route: RequestHandler): RequestHandler => (req, res, next) => {
  Promise.resolve(route(req, res, next)).catch(next);
};

async function findUser(id: string): Promise<{ id: string; name: string } | null> {
  if (id === 'erro') throw new Error('detalhe interno do banco');
  return id === '1' ? { id, name: 'Ana' } : null;
}

async function buscarPedido(id: string): Promise<{ id: string; total: number }> {
  logger.info('buscando pedido');
  await new Promise((resolve) => setTimeout(resolve, id === '1' ? 30 : id === '2' ? 10 : 20));
  if (id === 'erro') throw new Error('detalhe interno do pedido');
  logger.info('pedido encontrado');
  return { id, total: 100 };
}

app.get('/usuarios/:id', asyncRoute(async (req, res) => {
  const user = await findUser(req.params.id);
  if (!user) throw new AppError('usuário não encontrado', 404);
  res.json(user);
  logger.info('resposta enviada');
}));

app.get('/pedidos/:id', asyncRoute(async (req, res) => {
  const pedido = await buscarPedido(req.params.id);
  res.json(pedido);
  logger.info('resposta enviada');
}));

app.get('/rejeicao', asyncRoute(async () => {
  await Promise.resolve();
  throw new Error('falha assíncrona interna');
}));

app.use((_req, _res, next) => next(new AppError('rota não encontrada', 404)));

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) return next(error);
  logger.error('falha na requisição', error);
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  res.status(statusCode).json({
    statusCode,
    message: error instanceof AppError ? error.message : 'erro interno do servidor',
    timestamp: new Date().toISOString()
  });
};

app.use(errorHandler);

if (require.main === module) {
  app.listen(3000, () => console.log('Servidor em http://localhost:3000'));
}
