const ClienteService = require('../services/clienteService');
const clienteService = new ClienteService();

class ClienteController {
  // --- Funciones de Cliente ---
  async listar(req, res) {
    try {
      const clientes = await clienteService.getAll();
      res.json(clientes);
    } catch (error) {
      res.status(500).json({ mensaje: error.message });
    }
  }

  async obtener(req, res) {
    try {
      const cliente = await clienteService.getById(req.params.id);
      res.json(cliente);
    } catch (error) {
      res.status(404).json({ mensaje: error.message });
    }
  }

  async crear(req, res) {
    try {
      const nuevo = await clienteService.create(req.body);
      res.status(201).json(nuevo);
    } catch (error) {
      res.status(400).json({ mensaje: error.message });
    }
  }

  async actualizar(req, res) {
    try {
      const actualizado = await clienteService.update(req.params.id, req.body);
      res.json(actualizado);
    } catch (error) {
      res.status(404).json({ mensaje: error.message });
    }
  }

  async eliminar(req, res) {
    try {
      await clienteService.delete(req.params.id);
      res.json({ mensaje: 'Cliente eliminado correctamente' });
    } catch (error) {
      res.status(404).json({ mensaje: error.message });
    }
  }
}

module.exports = new ClienteController();
