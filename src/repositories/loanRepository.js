export class LoanRepository {
  constructor(database) { this.collection = database.collection('loans'); }
  create(loan, session) { return this.collection.insertOne(loan, { session }); }
  findById(id, session) { return this.collection.findOne({ _id: id }, { session }); }
  markReturned(id, returnedAt, total, daysCharged, session) { return this.collection.findOneAndUpdate({ _id: id, status: 'active' }, { $set: { status: 'returned', returnedAt, total, daysCharged } }, { session, returnDocument: 'after' }); }
  find(filter = {}) { return this.collection.find(filter).sort({ rentedAt: -1 }).toArray(); }
}