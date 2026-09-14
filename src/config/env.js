import 'dotenv/config';

export const env = {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27017/?authSource=admin&replicaSet=rs0',
  mongoDb: process.env.MONGODB_DB || 'proyecto_final'
};