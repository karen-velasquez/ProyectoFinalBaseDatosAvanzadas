import { toObjectId, AppError } from '../utils/errors.js';

export function videoController(videoService, videos, copies) {
  return {
    create: async (req, res) => res.status(201).json({ id: await videoService.create(req.body) }),
    search: async (req, res) => res.json(await videoService.search(req.query)),
    availableForRental: async (req, res) => res.json(await videoService.listAvailableForRental(req.query)),
    addCopies: async (req, res) => res.status(201).json(await videoService.addCopies(toObjectId(req.params.id, 'videoId'), Number(req.body.quantity))),
    removeCopy: async (req, res) => {
      const date = req.body.date ? new Date(req.body.date) : new Date();
      if (Number.isNaN(date.getTime()) || date > new Date()) throw new AppError('Fecha de baja inválida, no puede ser futura', 400, 'INVALID_REMOVAL_DATE');
      const result = await copies.remove(toObjectId(req.params.copyId, 'copyId'), req.body.reason, date);
      if (!result.matchedCount) return res.status(404).json({ error: { code: 'COPY_NOT_FOUND', message: 'Copia no encontrada o ya retirada' } });
      return res.json({ message: 'Copia retirada' });
    },
    available: async (req, res) => res.json(await copies.findAllActive(toObjectId(req.params.id, 'videoId'))),
    removed: async (req, res) => res.json(await copies.findAllRemoved(toObjectId(req.params.id, 'videoId')))
  };
}