import { Router } from 'express';
export function generoRoutes(controller) { const router = Router(); router.get('/', controller.list); router.post('/', controller.create); return router; }
