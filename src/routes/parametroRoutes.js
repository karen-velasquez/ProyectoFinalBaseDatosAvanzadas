import { Router } from 'express';
export function parametroRoutes(controller) { const router = Router(); router.get('/:tipo', controller.listByTipo); router.post('/', controller.create); return router; }
