export class SettingsRepository {
  constructor(database) { this.collection = database.collection('settings'); }
  getPolicy() { return this.collection.findOne({ _id: 'rental-policy' }); }
  updatePolicy(policy) { return this.collection.findOneAndUpdate({ _id: 'rental-policy' }, { $set: policy }, { returnDocument: 'after' }); }
}