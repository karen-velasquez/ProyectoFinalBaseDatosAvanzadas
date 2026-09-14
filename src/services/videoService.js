import { AppError } from '../utils/errors.js';
export class VideoService {
  constructor(videos, copies) { this.videos = videos; this.copies = copies; }
  async create(data) { return (await this.videos.create({ ...data, acquiredUnits: Number(data.acquiredUnits || 0), createdAt: new Date() })).insertedId; }
  search({ q, genre, actor, oscar }) {
    const filter = {};
    if (q) filter.$text = { $search: q };
    if (genre) filter.genre = genre;
    if (actor) filter['actors.name'] = { $regex: actor, $options: 'i' };
    if (oscar) filter.$or = [{ 'oscar.nominations': oscar }, { 'oscar.wins': oscar }];
    return this.videos.find(filter, q ? { projection: { score: { $meta: 'textScore' } }, sort: { score: { $meta: 'textScore' } } } : {});
  }
  async addCopies(videoId, quantity) { const video = await this.videos.findById(videoId); if (!video) throw new AppError('Película no encontrada', 404, 'VIDEO_NOT_FOUND'); const copies = Array.from({ length: quantity }, () => ({ videoId, status: 'available', acquiredAt: new Date(), history: [{ action: 'acquired', date: new Date() }] })); await this.copies.createMany(copies); await this.videos.updateById(videoId, { $inc: { acquiredUnits: quantity } }); return copies; }
}