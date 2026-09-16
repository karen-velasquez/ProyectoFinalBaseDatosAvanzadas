export class ParametroRepository {
  constructor(database) { this.collection = database.collection('parametros'); }
  findByTipo(tipo) { return this.collection.find({ tipo }).sort({ valor: 1 }).toArray(); }
  create(parametro) { return this.collection.insertOne(parametro); }
}
