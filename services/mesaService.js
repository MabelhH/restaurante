const Mesa = require('../models/mesaModel');

class MesaService {

  // Traer todas las mesas
  async getAll() {
    return await Mesa.find();
  }

  // Traer una mesa por ID
  async getById(id) {
    const mesa = await Mesa.findById(id);
    if (!mesa) throw new Error('Mesa no encontrada');
    return mesa;
  }

  // Crear una nueva mesa
  async create(data) {
    // Validar piso
    if (!['piso 1', 'piso 2', 'piso 3'].includes(data.piso)) {
      throw new Error('Piso inválido');
    }

    // Crear nueva mesa
    const mesa = new Mesa({
      piso: data.piso,
      estado: data.estado || 'liberada' // por defecto liberada
    });

    return await mesa.save();
  }

  // Actualizar mesa
  async update(id, data) {
    const mesa = await Mesa.findById(id);
    if (!mesa) throw new Error('Mesa no encontrada');

    if (data.piso) {
      if (!['piso 1', 'piso 2', 'piso 3'].includes(data.piso)) {
        throw new Error('Piso inválido');
      }
      mesa.piso = data.piso;
    }

    if (data.estado) {
      if (!['atendida', 'liberada', 'ocupada'].includes(data.estado)) {
        throw new Error('Estado inválido');
      }
      mesa.estado = data.estado;
    }

    return await mesa.save();
  }

  // Eliminar mesa
  async delete(id) {
    const mesa = await Mesa.findByIdAndDelete(id);
    if (!mesa) throw new Error('Mesa no encontrada');
    return mesa;
  }
}

module.exports = MesaService;