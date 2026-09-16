export function generoController(generos) {
  return {
    list: async (_req, res) => res.json(await generos.findAll()),
    create: async (req, res) => { const result = await generos.create(req.body); res.status(201).json({ ...req.body, _id: result.insertedId }); }
  };
}
