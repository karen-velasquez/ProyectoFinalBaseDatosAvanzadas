export class CopyRepository {
  constructor(database) { this.collection = database.collection('copies'); }
  createMany(copies, options) { return this.collection.insertMany(copies, options); }
  findAvailable(videoId, quantity, session) { return this.collection.find({ videoId, status: 'available' }, { session }).limit(quantity).toArray(); }
  findAllAvailable(videoId) { return this.collection.find({ videoId, status: 'available' }).toArray(); }
  findAllActive(videoId) { return this.collection.find({ videoId, status: { $in: ['available', 'rented'] } }).sort({ status: 1 }).toArray(); }
  findAllRemoved(videoId) { return this.collection.find({ videoId, status: 'removed' }).sort({ removedAt: -1 }).toArray(); }
  rentOne(videoId, loanId, session) { return this.collection.findOneAndUpdate({ videoId, status: 'available' }, { $set: { status: 'rented', loanId }, $push: { history: { action: 'rented', date: new Date(), loanId } } }, { session, returnDocument: 'after' }); }
  returnByLoan(loanId, session) { return this.collection.updateMany({ loanId, status: 'rented' }, { $set: { status: 'available' }, $unset: { loanId: '' }, $push: { history: { action: 'returned', date: new Date() } } }, { session }); }
  remove(id, reason, date = new Date()) { return this.collection.updateOne({ _id: id, status: { $ne: 'removed' } }, { $set: { status: 'removed', removedAt: date, removalReason: reason }, $push: { history: { action: 'removed', date, reason } } }); }
}