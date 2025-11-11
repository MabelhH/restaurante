// services/clienteService.js
const Cliente = require('../models/clienteModel');


class ClienteService {

  // Obtener todos los clientes
  async getAll() {
    return await Cliente.find();
  }

  // Obtener cliente por ID
  async getById(id) {
    const cliente = await Cliente.findById(id);
    if (!cliente) throw new Error('Cliente no encontrado');
    return cliente;
  }

  // Crear un nuevo cliente
  async create(data) {
    const nuevoCliente = new Cliente(data);
    await nuevoCliente.save();
    return nuevoCliente;
  }

  // Actualizar un cliente existente
  async update(id, data) {
    const actualizado = await Cliente.findByIdAndUpdate(id, data, { new: true });
    if (!actualizado) throw new Error('Cliente no encontrado para actualizar');
    return actualizado;
  }

  // Eliminar un cliente
  async delete(id) {
    const eliminado = await Cliente.findByIdAndDelete(id);
    if (!eliminado) throw new Error('Cliente no encontrado para eliminar');
    return eliminado;
  }
}
module.exports = ClienteService;
