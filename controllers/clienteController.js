const ClienteService = require('../services/clienteService');
const clienteService = new ClienteService();

class ClienteController {
  async listar(req, res) {
    const clientes = await clienteService.getAll();
    res.json(clientes);
  }

  async obtener(req, res) {
    const cliente = await clienteService.getById(req.params.id);
    res.json(cliente);
  }

  async crear(req, res) {
    const nuevo = await clienteService.create(req.body);
    res.json(nuevo);
  }

  async actualizar(req, res) {
    const actualizado = await clienteService.update(req.params.id, req.body);
    res.json(actualizado);
  }

  async eliminar(req, res) {
    await clienteService.delete(req.params.id);
    res.json({ mensaje: 'Cliente eliminado correctamente' });
  }
}

module.exports = new ClienteController();
