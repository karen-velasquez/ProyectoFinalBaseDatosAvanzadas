import { AppError, ObjectId } from '../utils/errors.js';

export class RentalService {
  constructor({ client, customers, copies, loans, invoices, settings, videos }) {
    this.client = client; this.customers = customers; this.copies = copies; this.loans = loans; this.invoices = invoices; this.settings = settings; this.videos = videos;
  }

  async rent({ customerId, items }) {
    const policy = await this.settings.getPolicy();
    const rentedAt = new Date();
    if (!Array.isArray(items) || items.length === 0) throw new AppError('Debe solicitar al menos una película', 400, 'EMPTY_RENTAL');

    const parsedItems = items.map((requested) => {
      const dueDate = new Date(requested.dueDate);
      if (Number.isNaN(dueDate.getTime()) || dueDate <= rentedAt) throw new AppError('Fecha de devolución inválida, debe ser posterior a hoy', 400, 'INVALID_DUE_DATE');
      const days = Math.ceil((dueDate - rentedAt) / 86400000);
      if (days < 1 || days > policy.maxDays) throw new AppError(`La fecha de devolución debe estar entre 1 y ${policy.maxDays} días desde hoy`, 400, 'INVALID_RENTAL_DAYS');
      const rateEntry = policy.ratesByDays.find((entry) => entry.days === days);
      if (!rateEntry) throw new AppError(`No hay tarifa configurada para ${days} días`, 400, 'RATE_NOT_CONFIGURED');
      const quantity = Number(requested.quantity || 1);
      if (!Number.isInteger(quantity) || quantity < 1) throw new AppError('Cantidad inválida', 400, 'INVALID_RENTAL_ITEM');
      return { videoId: requested.videoId, quantity, dueDate, days, unitRate: rateEntry.rate };
    });

    const customer = await this.customers.findById(customerId);
    if (!customer) throw new AppError('Cliente no encontrado', 404, 'CUSTOMER_NOT_FOUND');
    if (customer.blocked) throw new AppError('El cliente está bloqueado', 409, 'CUSTOMER_BLOCKED');

    const loanId = new ObjectId();
    const session = this.client.startSession();
    try {
      let rentedItems = [];
      let itemCount = 0;
      let subtotal = 0;
      await session.withTransaction(async () => {
        for (const requested of parsedItems) {
          const video = await this.videos.findById(requested.videoId);
          if (!video) throw new AppError('Película no encontrada', 404, 'VIDEO_NOT_FOUND');
          const copyIds = [];
          for (let index = 0; index < requested.quantity; index += 1) {
            const copy = await this.copies.rentOne(video._id, loanId, session);
            if (!copy) throw new AppError(`Stock insuficiente para: ${video.title}`, 409, 'OUT_OF_STOCK');
            copyIds.push(copy._id);
          }
          itemCount += requested.quantity;
          subtotal += requested.quantity * requested.unitRate;
          rentedItems.push({ videoId: video._id, title: video.title, copyIds, quantity: requested.quantity, dueDate: requested.dueDate, days: requested.days, unitRate: requested.unitRate });
        }
        const discount = policy.discounts.find((entry) => itemCount >= entry.minimumItems && (entry.maximumItems == null || itemCount <= entry.maximumItems))?.percentage || 0;
        const total = subtotal * (1 - discount / 100);
        const dueDate = rentedItems.reduce((latest, it) => (it.dueDate > latest ? it.dueDate : latest), rentedItems[0].dueDate);
        await this.loans.create({ _id: loanId, customerId, items: rentedItems, status: 'active', rentedAt, dueDate, subtotal, discountPercentage: discount, total }, session);
        await this.invoices.create({ loanId, customerId, issuedAt: rentedAt, subtotal, discountPercentage: discount, total, status: 'unpaid' }, session);
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
      return this.loans.findById(loanId);
    } finally { await session.endSession(); }
  }

  async returnLoan(loanId) {
    const session = this.client.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        const loan = await this.loans.findById(loanId, session);
        if (!loan) throw new AppError('Préstamo no encontrado', 404, 'LOAN_NOT_FOUND');
        if (loan.status !== 'active') throw new AppError('El préstamo ya fue devuelto', 409, 'LOAN_ALREADY_RETURNED');
        const returnedAt = new Date();
        result = await this.loans.markReturned(loanId, returnedAt, loan.total, session);
        await this.copies.returnByLoan(loanId, session);
        await this.invoices.updateTotal(loanId, loan.total, returnedAt, session);
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
      return result;
    } finally { await session.endSession(); }
  }
}