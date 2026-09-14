import { toObjectId } from '../utils/errors.js';

export function customerController(customers) {
  return {
    create: async (req, res) => { const customer = { ...req.body, birthDate: new Date(req.body.birthDate), registeredAt: new Date(), blocked: false }; const result = await customers.create(customer); res.status(201).json({ ...customer, _id: result.insertedId }); },
    list: async (req, res) => res.json(await customers.find(req.query.blocked === undefined ? {} : { blocked: req.query.blocked === 'true' })),
    update: async (req, res) => { const id = toObjectId(req.params.id); const result = await customers.updateById(id, { $set: req.body }); if (!result.matchedCount) return res.status(404).json({ error: { code: 'CUSTOMER_NOT_FOUND', message: 'Cliente no encontrado' } }); return res.json(await customers.findById(id)); },
    block: async (req, res) => { const id = toObjectId(req.params.id); const result = await customers.updateById(id, { $set: { blocked: true, blockDate: new Date(), blockReason: req.body.reason } }); if (!result.matchedCount) return res.status(404).json({ error: { code: 'CUSTOMER_NOT_FOUND', message: 'Cliente no encontrado' } }); return res.json(await customers.findById(id)); }
  };
}