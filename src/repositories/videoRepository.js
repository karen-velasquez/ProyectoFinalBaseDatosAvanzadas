export class VideoRepository {
  constructor(database) { this.collection = database.collection('videos'); }
  create(video) { return this.collection.insertOne(video); }
  find(filter, options = {}) { return this.collection.find(filter, options).toArray(); }
  findWithAvailableCount(filter) {
    return this.collection.aggregate([
      { $match: filter },
      { $lookup: { from: 'copies', let: { videoId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$videoId', '$$videoId'] }, { $eq: ['$status', 'available'] }] } } }, { $count: 'n' }], as: 'availableCopies' } },
      { $addFields: { availableCount: { $ifNull: [{ $arrayElemAt: ['$availableCopies.n', 0] }, 0] } } },
      { $project: { availableCopies: 0 } }
    ]).toArray();
  }
  findById(id) { return this.collection.findOne({ _id: id }); }
  updateById(id, update) { return this.collection.updateOne({ _id: id }, update); }
}