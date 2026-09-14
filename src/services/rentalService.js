import { AppError, ObjectId } from '../utils/errors.js';

export class RentalService {
  constructor({ client, customers, copies, loans, invoices, settings, videos }) {
    this.client = client; this.customers = customers; this.copies = copies; this.loans = loans; this.invoices = invoices; this.settings = settings; this.videos = videos;
  }

  async rent({ customerId, items, days = 1 }) {
    const policy = await this.settings.getPolicy();
    if (!Number.isInteger(days) || days < 1 || days > policy.maxDays) throw new AppError(`Los días deben estar entre 1 y ${policy.maxDays}`, 400, 'INVALID_RENTAL_DAYS');
    const rateEntry = policy.ratesByDays.find((entry) => entry.days === days);
    if (!rateEntry) throw new AppError(`No hay tarifa configurada para ${days} días`, 400, 'RATE_NOT_CONFIGURED');
    const customer = await this.customers.findById(customerId);
    if (!customer) throw new AppError('Cliente no encontrado', 404, 'CUSTOMER_NOT_FOUND');
    if (customer.blocked) throw new AppError('El cliente está bloqueado', 409, 'CUSTOMER_BLOCKED');
    if (!Array.isArray(items) || items.length === 0) throw new AppError('Debe solicitar al menos una película', 400, 'EMPTY_RENTAL');

    const loanId = new ObjectId();
    const session = this.client.startSession();
    try {
      let rentedItems = [];
      let itemCount = 0;
      await session.withTransaction(async () => {
        for (const requested of items) {
          const video = await this.videos.findById(requested.videoId);
          const quantity = Number(requested.quantity || 1);
          if (!video || !Number.isInteger(quantity) || quantity < 1) throw new AppError('Película o cantidad inválida', 400, 'INVALID_RENTAL_ITEM');
          const copyIds = [];
          for (let index = 0; index < quantity; index += 1) {
            const copy = await this.copies.rentOne(video._id, loanId, session);
            if (!copy) throw new AppError(`Stock insuficiente para: ${video.title}`, 409, 'OUT_OF_STOCK');
            copyIds.push(copy._id);
          }
          itemCount += quantity;
          rentedItems.push({ videoId: video._id, title: video.title, copyIds, unitRate: rateEntry.rate });
        }
        const discount = [...policy.discounts].sort((a, b) => b.minimumItems - a.minimumItems).find((entry) => itemCount >= entry.minimumItems)?.percentage || 0;
        const subtotal = itemCount * rateEntry.rate;
        const total = subtotal * (1 - discount / 100);
        const rentedAt = new Date();
        const dueDate = new Date(rentedAt.getTime() + days * 86400000);
        await this.loans.create({ _id: loanId, customerId, items: rentedItems, status: 'active', rentedAt, dueDate, days, subtotal, discountPercentage: discount, total }, session);
        await this.invoices.create({ loanId, customerId, issuedAt: rentedAt, subtotal, discountPercentage: discount, total, status: 'unpaid' }, session);
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
      return this.loans.findById(loanId);
    } finally { await session.endSession(); }
  }

  async returnLoan(loanId) {
    const policy = await this.settings.getPolicy();
    const session = this.client.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const loan = await this.loans.findById(loanId, session);
        if (!loan) throw new AppError('Préstamo no encontrado', 404, 'LOAN_NOT_FOUND');
        if (loan.status !== 'active') throw new AppError('El préstamo ya fue devuelto', 409, 'LOAN_ALREADY_RETURNED');
        const returnedAt = new Date();
        const days = Math.min(policy.maxDays, Math.max(1, Math.ceil((returnedAt - loan.rentedAt) / 86400000)));
        const rateEntry = policy.ratesByDays.find((entry) => entry.days === days) || policy.ratesByDays.reduce((max, entry) => (entry.days > max.days ? entry : max));
        const discount = loan.discountPercentage || 0;
        const total = loan.items.length * rateEntry.rate * (1 - discount / 100);
        result = await this.loans.markReturned(loanId, returnedAt, total, days, session);
        await this.copies.returnByLoan(loanId, session);
        await this.invoices.updateTotal(loanId, total, returnedAt, session);
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
      return result;
    } finally { await session.endSession(); }
  }
}