export class CopyRepository {
  constructor(database) { this.collection = database.collection('copies'); }
  createMany(copies, options) { return this.collection.insertMany(copies, options); }
  findAvailable(videoId, quantity, session) { return this.collection.find({ videoId, status: 'available' }, { session }).limit(quantity).toArray(); }
  findAllAvailable(videoId) { return this.collection.find({ videoId, status: 'available' }).toArray(); }
  rentOne(videoId, loanId, session) { return this.collection.findOneAndUpdate({ videoId, status: 'available' }, { $set: { status: 'rented', loanId }, $push: { history: { action: 'rented', date: new Date(), loanId } } }, { session, returnDocument: 'after' }); }
  returnByLoan(loanId, session) { return this.collection.updateMany({ loanId, status: 'rented' }, { $set: { status: 'available' }, $unset: { loanId: '' }, $push: { history: { action: 'returned', date: new Date() } } }, { session }); }
  remove(id, reason) { return this.collection.updateOne({ _id: id, status: { $ne: 'removed' } }, { $set: { status: 'removed', removedAt: new Date(), removalReason: reason }, $push: { history: { action: 'removed', date: new Date(), reason } } }); }
}