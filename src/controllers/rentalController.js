import { toObjectId } from '../utils/errors.js';
export function rentalController(rentals, loans) {
  return {
    rent: async (req, res) => res.status(201).json(await rentals.rent({ ...req.body, customerId: toObjectId(req.body.customerId, 'customerId'), items: req.body.items.map((item) => ({ ...item, videoId: toObjectId(item.videoId, 'videoId') })) })),
    returnLoan: async (req, res) => res.json(await rentals.returnLoan(toObjectId(req.params.id, 'loanId'))),
    active: async (_req, res) => res.json(await loans.findWithCustomer({ status: 'active' }))
  };
}