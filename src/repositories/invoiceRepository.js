export class InvoiceRepository {
  constructor(database) { this.collection = database.collection('invoices'); }
  create(invoice, session) { return this.collection.insertOne(invoice, { session }); }
  updateTotal(loanId, total, returnedAt, session) { return this.collection.updateOne({ loanId }, { $set: { total, returnedAt } }, { session }); }
}