export class VideoRepository {
  constructor(database) { this.collection = database.collection('videos'); }
  create(video) { return this.collection.insertOne(video); }
  find(filter, options = {}) { return this.collection.find(filter, options).toArray(); }
  findById(id) { return this.collection.findOne({ _id: id }); }
  updateById(id, update) { return this.collection.updateOne({ _id: id }, update); }
}