import { ObjectId } from 'mongodb';

export class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function toObjectId(value, field = 'id') {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new AppError(`${field} no es válido`, 400, 'INVALID_ID');
  return new ObjectId(value);
}

export { ObjectId } from 'mongodb';