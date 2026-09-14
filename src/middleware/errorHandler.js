export function notFound(_request, _response, next) {
  next({ status: 404, code: 'NOT_FOUND', message: 'Recurso no encontrado' });
}

export function errorHandler(error, _request, response, _next) {
  if (error.code === 121) {
    const failed = error.errInfo?.details?.schemaRulesNotSatisfied?.[0]?.propertiesNotSatisfied?.[0]?.propertyName;
    return response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: failed ? `Campo inválido: ${failed}` : 'Documento inválido según el esquema' } });
  }
  const status = error.status || (error.code === 11000 ? 409 : 500);
  response.status(status).json({ error: { code: error.code || 'INTERNAL_ERROR', message: error.message || 'Error interno' } });
}