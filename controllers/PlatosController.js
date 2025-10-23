const PlatoService = require('../services/platosService');
const platoService = new PlatoService(); // instancia


class PlatoController {
  async listar(req, res) {
    const platos= await platoService.getAll();
    res.json(productos);
  }

  async obtener(req, res) {
    const plato = await platoService.getById(req.params.id);
    res.json(producto);
  }

  async crear(req, res) {
    const nuevo = await platoService.create(req.body);
    res.json(nuevo);
  }

  async actualizar(req, res) {
    const actualizado = await platoService.update(req.params.id, req.body);
    res.json(actualizado);
  }

  async eliminar(req, res) {
    await platoService.delete(req.params.id);
    res.json({ mensaje: 'Producto eliminado correctamente' });
  }

  // ✅ Verificar stock bajo
  async verificarStock(req, res) {
    const alertas = await platoService.verificarStockMinimo();
    res.json(alertas);
  }
}

module.exports = new PlatoController();
