export class GeneroRepository {
  constructor(database) { this.collection = database.collection('generos'); }
  findAll() { return this.collection.find({}).sort({ valor: 1 }).toArray(); }
  create(genero) { return this.collection.insertOne(genero); }
}
