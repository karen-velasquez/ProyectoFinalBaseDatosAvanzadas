export function parametroController(parametros) {
  return {
    listByTipo: async (req, res) => res.json(await parametros.findByTipo(req.params.tipo)),
    create: async (req, res) => { const result = await parametros.create(req.body); res.status(201).json({ ...req.body, _id: result.insertedId }); }
  };
}
