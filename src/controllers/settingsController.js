import { AppError } from '../utils/errors.js';

export function settingsController(settings) {
  return {
    get: async (_req, res) => res.json(await settings.getPolicy()),
    update: async (req, res) => {
      for (const r of req.body.ratesByDays || []) {
        if (typeof r.rate !== 'number' || r.rate <= 0 || Math.round(r.rate * 100) !== r.rate * 100) {
          throw new AppError('Tarifa inválida, debe tener máximo 2 decimales', 400, 'INVALID_RATE');
        }
      }
      const discounts = [...(req.body.discounts || [])].sort((a, b) => a.minimumItems - b.minimumItems);
      for (const d of discounts) {
        if (typeof d.percentage !== 'number' || d.percentage < 0 || d.percentage > 100) {
          throw new AppError('Porcentaje de descuento debe estar entre 0 y 100', 400, 'INVALID_DISCOUNT_PERCENTAGE');
        }
        if (d.maximumItems != null && d.maximumItems < d.minimumItems) {
          throw new AppError(`El rango ${d.minimumItems}-${d.maximumItems} es inválido: "hasta" debe ser mayor o igual a "desde"`, 400, 'INVALID_DISCOUNT_RANGE');
        }
      }
      for (let i = 1; i < discounts.length; i += 1) {
        const prev = discounts[i - 1];
        const curr = discounts[i];
        if (prev.maximumItems == null || prev.maximumItems >= curr.minimumItems) {
          throw new AppError(`Los rangos de descuento se solapan o no tienen máximo definido antes de "${curr.minimumItems}"`, 400, 'OVERLAPPING_DISCOUNT_RANGE');
        }
      }
      const body = {
        ...req.body,
        ratesByDays: req.body.ratesByDays.map((r) => ({ ...r, rate: Math.round(r.rate * 100) / 100 })),
        discounts
      };
      res.json(await settings.updatePolicy(body));
    }
  };
}