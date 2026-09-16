import { AppError } from '../utils/errors.js';
export class VideoService {
  constructor(videos, copies) { this.videos = videos; this.copies = copies; }
  async create(data) {
    const currentYear = new Date().getFullYear();
    if (!data.year || data.year < 1888 || data.year > currentYear) throw new AppError(`Año debe estar entre 1888 y ${currentYear}`, 400, 'INVALID_YEAR');
    if (typeof data.unitCost !== 'number' || data.unitCost <= 0 || Math.round(data.unitCost * 100) !== data.unitCost * 100) throw new AppError('Costo unitario inválido, debe tener máximo 2 decimales', 400, 'INVALID_UNIT_COST');
    const acquiredUnits = Number(data.acquiredUnits || 0);
    if (acquiredUnits > 999) throw new AppError('Unidades a adquirir no puede superar 999', 400, 'INVALID_ACQUIRED_UNITS');
    return (await this.videos.create({ ...data, unitCost: Math.round(data.unitCost * 100) / 100, acquiredUnits, createdAt: new Date() })).insertedId;
  }
  search({ q, genre, actor, oscar }) {
    const filter = {};
    if (q) filter.$text = { $search: q };
    if (genre) filter.genre = genre;
    if (actor) filter['actors.name'] = { $regex: actor, $options: 'i' };
    if (oscar) filter['oscar.categories.categoria'] = { $regex: oscar, $options: 'i' };
    return this.videos.find(filter, q ? { projection: { score: { $meta: 'textScore' } }, sort: { score: { $meta: 'textScore' } } } : {});
  }
  async listAvailableForRental({ q, genre, actor, oscar } = {}) {
    const filter = {};
    if (q) filter.$text = { $search: q };
    if (genre) filter.genre = genre;
    if (actor) filter['actors.name'] = { $regex: actor, $options: 'i' };
    if (oscar) filter['oscar.categories.categoria'] = { $regex: oscar, $options: 'i' };
    const withCount = await this.videos.findWithAvailableCount(filter);
    return withCount.filter((v) => v.availableCount > 0);
  }
  async addCopies(videoId, quantity) { if (quantity > 999) throw new AppError('Unidades a adquirir no puede superar 999', 400, 'INVALID_ACQUIRED_UNITS'); const video = await this.videos.findById(videoId); if (!video) throw new AppError('Película no encontrada', 404, 'VIDEO_NOT_FOUND'); const copies = Array.from({ length: quantity }, () => ({ videoId, status: 'available', acquiredAt: new Date(), history: [{ action: 'acquired', date: new Date() }] })); await this.copies.createMany(copies); await this.videos.updateById(videoId, { $inc: { acquiredUnits: quantity } }); return copies; }
}