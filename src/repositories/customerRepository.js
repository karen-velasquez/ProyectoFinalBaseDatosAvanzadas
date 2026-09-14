export class CustomerRepository {
  constructor(database) { this.collection = database.collection('customers'); }
  create(customer) { return this.collection.insertOne(customer); }
  findById(id) { return this.collection.findOne({ _id: id }); }
  updateById(id, update) { return this.collection.updateOne({ _id: id }, update); }
  find(filter = {}) { return this.collection.find(filter).sort({ fullName: 1 }).toArray(); }
}