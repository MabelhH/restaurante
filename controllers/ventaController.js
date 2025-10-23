const VentaService = require('../services/ventaService');
const ventaService = new VentaService();

class VentaController {
  async listar(req, res) {
    const ventas = await ventaService.getAll();
    res.json(ventas);
  }

  async obtener(req, res) {
    const venta = await ventaService.getById(req.params.id);
    res.json(venta);
  }

  async crear(req, res) {
    const nueva = await ventaService.create(req.body);
    res.json(nueva);
  }

  async eliminar(req, res) {
    await ventaService.delete(req.params.id);
    res.json({ mensaje: 'Venta eliminada correctamente' });
  }
}

module.exports = new VentaController();
