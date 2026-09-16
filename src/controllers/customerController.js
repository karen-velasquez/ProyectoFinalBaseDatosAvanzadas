import { toObjectId, AppError } from '../utils/errors.js';

const PHONE_RE = /^[67]\d{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function customerController(customers) {
  return {
    create: async (req, res) => {
      if (!PHONE_RE.test(req.body.phone)) throw new AppError('Teléfono debe tener 7 dígitos y empezar con 6 o 7', 400, 'INVALID_PHONE');
      if (!EMAIL_RE.test(req.body.email)) throw new AppError('Correo inválido', 400, 'INVALID_EMAIL');
      const customer = { ...req.body, birthDate: new Date(req.body.birthDate), registeredAt: new Date(), blocked: false };
      const result = await customers.create(customer);
      res.status(201).json({ ...customer, _id: result.insertedId });
    },
    list: async (req, res) => res.json(await customers.find(req.query.blocked === undefined ? {} : { blocked: req.query.blocked === 'true' })),
    update: async (req, res) => {
      if (!PHONE_RE.test(req.body.phone)) throw new AppError('Teléfono debe tener 7 dígitos y empezar con 6 o 7', 400, 'INVALID_PHONE');
      if (!EMAIL_RE.test(req.body.email)) throw new AppError('Correo inválido', 400, 'INVALID_EMAIL');
      const id = toObjectId(req.params.id);
      const update = { ...req.body, birthDate: new Date(req.body.birthDate) };
      const result = await customers.updateById(id, { $set: update });
      if (!result.matchedCount) return res.status(404).json({ error: { code: 'CUSTOMER_NOT_FOUND', message: 'Cliente no encontrado' } });
      return res.json(await customers.findById(id));
    },
    block: async (req, res) => {
      const date = req.body.date ? new Date(req.body.date) : new Date();
      if (Number.isNaN(date.getTime()) || date > new Date()) throw new AppError('Fecha de bloqueo inválida, no puede ser futura', 400, 'INVALID_BLOCK_DATE');
      const id = toObjectId(req.params.id);
      const result = await customers.updateById(id, { $set: { blocked: true, blockDate: date, blockReason: req.body.reason } });
      if (!result.matchedCount) return res.status(404).json({ error: { code: 'CUSTOMER_NOT_FOUND', message: 'Cliente no encontrado' } });
      return res.json(await customers.findById(id));
    }
  };
}