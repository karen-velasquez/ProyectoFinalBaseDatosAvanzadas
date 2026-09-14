export function settingsController(settings) {
  return {
    get: async (_req, res) => res.json(await settings.getPolicy()),
    update: async (req, res) => res.json(await settings.updatePolicy(req.body))
  };
}