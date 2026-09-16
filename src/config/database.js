import { MongoClient } from 'mongodb';
import { env } from './env.js';

const client = new MongoClient(env.mongoUri, {
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority' }
});

export async function connectDatabase() {
  await client.connect();
  const database = client.db(env.mongoDb);
  await ensureCollections(database);
  return { client, database };
}

async function ensureCollections(database) {
  await ensureCollection(database, 'videos', videoValidator);
  await ensureCollection(database, 'customers', customerValidator);
  await ensureCollection(database, 'copies', copyValidator);
  await ensureCollection(database, 'loans', loanValidator);
  await ensureCollection(database, 'invoices');
  await ensureCollection(database, 'settings');

  await Promise.all([
    database.collection('videos').createIndex({ title: 'text', alternateTitles: 'text', 'actors.name': 'text' }, { name: 'video_text_search' }),
    database.collection('videos').createIndex({ genre: 1, year: -1 }, { name: 'video_genre_year' }),
    database.collection('videos').createIndex({ 'oscar.nominations': 1 }, { name: 'video_oscar_nominations' }),
    database.collection('videos').createIndex({ 'oscar.wins': 1 }, { name: 'video_oscar_wins' }),
    database.collection('copies').createIndex({ videoId: 1, status: 1 }, { name: 'copies_by_video_status' }),
    database.collection('customers').createIndex({ blocked: 1, fullName: 1 }, { name: 'customers_blocked_name' }),
    database.collection('customers').createIndex({ email: 1 }, { unique: true, name: 'customers_email_unique' }),
    database.collection('loans').createIndex({ customerId: 1, status: 1 }, { name: 'loans_customer_status' }),
    database.collection('loans').createIndex({ 'items.videoId': 1, status: 1 }, { name: 'loans_video_status' }),
    database.collection('loans').createIndex({ status: 1, dueDate: 1 }, { name: 'loans_active_due_date' }),
    database.collection('invoices').createIndex({ loanId: 1 }, { unique: true, name: 'invoice_loan_unique' })
  ]);

  await database.collection('settings').updateOne(
    { _id: 'rental-policy' },
    {
      $setOnInsert: {
        maxDays: 5,
        ratesByDays: [{ days: 1, rate: 2 }, { days: 2, rate: 3 }, { days: 3, rate: 4 }, { days: 4, rate: 5 }, { days: 5, rate: 6 }],
        discounts: [{ minimumItems: 3, maximumItems: 5, percentage: 5 }, { minimumItems: 6, maximumItems: null, percentage: 10 }]
      }
    },
    { upsert: true }
  );

  const existingPolicy = await database.collection('settings').findOne({ _id: 'rental-policy' });
  if (existingPolicy?.discounts?.some((d) => d.maximumItems === undefined)) {
    const sorted = [...existingPolicy.discounts].sort((a, b) => a.minimumItems - b.minimumItems);
    const migrated = sorted.map((d, i) => ({ ...d, maximumItems: sorted[i + 1] ? sorted[i + 1].minimumItems - 1 : null }));
    await database.collection('settings').updateOne({ _id: 'rental-policy' }, { $set: { discounts: migrated } });
  }

  await database.command({ collMod: 'settings', validator: { $jsonSchema: settingValidator }, validationLevel: 'moderate', validationAction: 'error' });
}

async function ensureCollection(database, name, validator) {
  const exists = await database.listCollections({ name }, { nameOnly: true }).hasNext();
  if (!exists) {
    await database.createCollection(name, validator ? { validator: { $jsonSchema: validator }, validationLevel: 'moderate', validationAction: 'error' } : undefined);
  } else if (validator) {
    await database.command({ collMod: name, validator: { $jsonSchema: validator }, validationLevel: 'moderate', validationAction: 'error' });
  }
}

const objectId = { bsonType: 'objectId' };
const date = { bsonType: 'date' };
const videoValidator = { bsonType: 'object', required: ['title', 'genre', 'durationMinutes', 'year', 'unitCost', 'acquiredUnits'], properties: { title: { bsonType: 'string', minLength: 1 }, alternateTitles: { bsonType: 'array', items: { bsonType: 'string' } }, genre: { bsonType: 'string' }, durationMinutes: { bsonType: 'int', minimum: 1 }, year: { bsonType: 'int', minimum: 1888 }, actors: { bsonType: 'array', items: { bsonType: 'object', required: ['name'], properties: { name: { bsonType: 'string' } } } }, oscar: { bsonType: 'object', properties: { nominations: { bsonType: 'array', items: { bsonType: 'string' } }, wins: { bsonType: 'array', items: { bsonType: 'string' } } } }, unitCost: { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0 }, acquiredUnits: { bsonType: 'int', minimum: 0 } } };
const customerValidator = { bsonType: 'object', required: ['fullName', 'phone', 'email', 'birthDate', 'registeredAt', 'blocked'], properties: { fullName: { bsonType: 'string', minLength: 1 }, phone: { bsonType: 'string', pattern: '^[67]\\d{6}$' }, email: { bsonType: 'string', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' }, birthDate: date, registeredAt: date, blocked: { bsonType: 'bool' }, address: { bsonType: 'object' }, location: { bsonType: 'object', properties: { type: { enum: ['Point'] }, coordinates: { bsonType: 'array', minItems: 2, maxItems: 2 } } } } };
const copyValidator = { bsonType: 'object', required: ['videoId', 'status', 'history'], properties: { videoId: objectId, status: { enum: ['available', 'rented', 'removed'] }, history: { bsonType: 'array' } } };
const loanValidator = { bsonType: 'object', required: ['customerId', 'items', 'status', 'rentedAt', 'total'], properties: { customerId: objectId, items: { bsonType: 'array', minItems: 1 }, status: { enum: ['active', 'returned'] }, rentedAt: date, total: { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0 } } };
const settingValidator = { bsonType: 'object', required: ['maxDays', 'ratesByDays', 'discounts'], properties: { maxDays: { bsonType: 'int', minimum: 1 }, ratesByDays: { bsonType: 'array', minItems: 1, items: { bsonType: 'object', required: ['days', 'rate'], properties: { days: { bsonType: 'int', minimum: 1 }, rate: { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0 } } } }, discounts: { bsonType: 'array', items: { bsonType: 'object', required: ['minimumItems', 'maximumItems', 'percentage'], properties: { minimumItems: { bsonType: 'int', minimum: 1 }, maximumItems: { bsonType: ['int', 'null'] }, percentage: { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0, maximum: 100 } } } } } };