import { toObjectId } from '../utils/errors.js';

export function videoController(videoService, videos, copies) {
  return {
    create: async (req, res) => res.status(201).json({ id: await videoService.create(req.body) }),
    search: async (req, res) => res.json(await videoService.search(req.query)),
    addCopies: async (req, res) => res.status(201).json(await videoService.addCopies(toObjectId(req.params.id, 'videoId'), Number(req.body.quantity))),
    removeCopy: async (req, res) => { const result = await copies.remove(toObjectId(req.params.copyId, 'copyId'), req.body.reason); if (!result.matchedCount) return res.status(404).json({ error: { code: 'COPY_NOT_FOUND', message: 'Copia no encontrada o ya retirada' } }); return res.json({ message: 'Copia retirada' }); },
    available: async (req, res) => res.json(await copies.findAllAvailable(toObjectId(req.params.id, 'videoId')))
  };
}