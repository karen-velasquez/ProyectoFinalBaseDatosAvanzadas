export class LoanRepository {
  constructor(database) { this.collection = database.collection('loans'); }
  create(loan, session) { return this.collection.insertOne(loan, { session }); }
  findById(id, session) { return this.collection.findOne({ _id: id }, { session }); }
  markReturned(id, returnedAt, total, session) { return this.collection.findOneAndUpdate({ _id: id, status: 'active' }, { $set: { status: 'returned', returnedAt, total } }, { session, returnDocument: 'after' }); }
  find(filter = {}) { return this.collection.find(filter).sort({ rentedAt: -1 }).toArray(); }
  findWithCustomer(filter = {}) {
    return this.collection.aggregate([
      { $match: filter },
      { $sort: { rentedAt: -1 } },
      { $lookup: { from: 'customers', localField: 'customerId', foreignField: '_id', as: 'customer' } },
      { $addFields: { customerName: { $arrayElemAt: ['$customer.fullName', 0] } } },
      { $project: { customer: 0 } }
    ]).toArray();
  }
}