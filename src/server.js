import express from 'express';
import cors from 'cors';
import { connectDatabase } from './config/database.js';
import { VideoRepository } from './repositories/videoRepository.js';
import { CustomerRepository } from './repositories/customerRepository.js';
import { CopyRepository } from './repositories/copyRepository.js';
import { LoanRepository } from './repositories/loanRepository.js';
import { InvoiceRepository } from './repositories/invoiceRepository.js';
import { SettingsRepository } from './repositories/settingsRepository.js';
import { ParametroRepository } from './repositories/parametroRepository.js';
import { GeneroRepository } from './repositories/generoRepository.js';
import { VideoService } from './services/videoService.js';
import { RentalService } from './services/rentalService.js';
import { videoController } from './controllers/videoController.js';
import { customerController } from './controllers/customerController.js';
import { rentalController } from './controllers/rentalController.js';
import { settingsController } from './controllers/settingsController.js';
import { parametroController } from './controllers/parametroController.js';
import { generoController } from './controllers/generoController.js';
import { videoRoutes } from './routes/videoRoutes.js';
import { customerRoutes } from './routes/customerRoutes.js';
import { rentalRoutes } from './routes/rentalRoutes.js';
import { settingsRoutes } from './routes/settingsRoutes.js';
import { parametroRoutes } from './routes/parametroRoutes.js';
import { generoRoutes } from './routes/generoRoutes.js';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const { client, database } = await connectDatabase();
const repositories = { videos: new VideoRepository(database), customers: new CustomerRepository(database), copies: new CopyRepository(database), loans: new LoanRepository(database), invoices: new InvoiceRepository(database), settings: new SettingsRepository(database), parametros: new ParametroRepository(database), generos: new GeneroRepository(database) };
await repositories.parametros.collection.updateOne({ tipo: 'genero', valor: 'M' }, { $setOnInsert: { tipo: 'genero', valor: 'M', descripcion: 'Masculino' } }, { upsert: true });
await repositories.parametros.collection.updateOne({ tipo: 'genero', valor: 'F' }, { $setOnInsert: { tipo: 'genero', valor: 'F', descripcion: 'Femenino' } }, { upsert: true });
await repositories.parametros.collection.updateOne({ tipo: 'genero', valor: 'O' }, { $setOnInsert: { tipo: 'genero', valor: 'O', descripcion: 'Otro' } }, { upsert: true });
for (const g of ['Acción', 'Comedia', 'Drama', 'Terror', 'Ciencia ficción', 'Animación', 'Documental']) {
  await repositories.generos.collection.updateOne({ valor: g }, { $setOnInsert: { valor: g, descripcion: g } }, { upsert: true });
}
for (const c of ['Mejor Película', 'Mejor Director', 'Mejor Actor', 'Mejor Actriz', 'Mejor Guion Original', 'Mejor Fotografía', 'Mejor Banda Sonora']) {
  await repositories.parametros.collection.updateOne({ tipo: 'categoria_oscar', valor: c }, { $setOnInsert: { tipo: 'categoria_oscar', valor: c, descripcion: c } }, { upsert: true });
}
for (const a of ['Leonardo DiCaprio', 'Meryl Streep', 'Tom Hanks', 'Scarlett Johansson']) {
  await repositories.parametros.collection.updateOne({ tipo: 'actor', valor: a }, { $setOnInsert: { tipo: 'actor', valor: a, descripcion: a } }, { upsert: true });
}
const services = { videos: new VideoService(repositories.videos, repositories.copies), rentals: new RentalService({ client, ...repositories }) };
const controllers = { videos: videoController(services.videos, repositories.videos, repositories.copies), customers: customerController(repositories.customers), rentals: rentalController(services.rentals, repositories.loans), settings: settingsController(repositories.settings), parametros: parametroController(repositories.parametros), generos: generoController(repositories.generos) };
const app = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', database: database.databaseName, replicaSet: 'rs0' }));
app.use('/api/videos', videoRoutes(controllers.videos));
app.use('/api/customers', customerRoutes(controllers.customers));
app.use('/api/loans', rentalRoutes(controllers.rentals));
app.use('/api/settings', settingsRoutes(controllers.settings));
app.use('/api/parametros', parametroRoutes(controllers.parametros));
app.use('/api/generos', generoRoutes(controllers.generos));
app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.port, () => console.log(`Club Videos API listening on http://localhost:${env.port}`));
process.on('SIGTERM', async () => { server.close(); await client.close(); });