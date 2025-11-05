// services/mesasService.js
const Mesa = require('../models/mesasModel');

class MesasService {

  // Traer todas las mesas
  async getAll() {
    return await Mesa.find().sort({ numeroMesa: 1 });
  }

  // Traer una mesa por ID
  async getById(id) {
    const mesa = await Mesa.findById(id);
    if (!mesa) throw new Error('Mesa no encontrada');
    return mesa;
  }

  // Crear una nueva mesa
  async create(data) {
    // Validar que se haya proporcionado un número de mesa
      if (!data.numeroMesa || data.numeroMesa < 1) {
          throw new Error('El número de mesa debe ser mayor o igual a 1.');
      }

      // Validar que no exista una mesa con ese número
      const mesaExistente = await Mesa.findOne({ numeroMesa: data.numeroMesa });
      if (mesaExistente) {
          throw new Error(`El número de mesa ${data.numeroMesa} ya existe.`);
      }

      // Validar piso
      if (!['piso 1', 'piso 2', 'piso 3'].includes(data.piso)) {
          throw new Error('Piso inválido');
      }

      // Validar sector
      if (!['vid', 'valcon', 'normal'].includes(data.sector)) {
          throw new Error('Sector inválido');
      }

      // Crear nueva mesa
      const mesa = new Mesa({
          numeroMesa: data.numeroMesa,
          piso: data.piso,
          sector: data.sector,
          estado: data.estado || 'liberada'
      });

      return await mesa.save();
  }


  // Actualizar mesa
  async update(id, data) {
    const mesa = await Mesa.findById(id);
    if (!mesa) throw new Error('Mesa no encontrada');

    if (data.numeroMesa) {
        if (data.numeroMesa < 1) {
            throw new Error('El número de mesa no puede ser menor a 1.');
        }

        // Buscar otra mesa con el mismo número distinto al id actual
        const mesaExistente = await Mesa.findOne({ numeroMesa: data.numeroMesa, _id: { $ne: id } });
        if (mesaExistente) {
            throw new Error(`El número de mesa ${data.numeroMesa} ya existe.`);
        }

        mesa.numeroMesa = data.numeroMesa;
    }

    if (data.piso) {
      if (!['piso 1', 'piso 2', 'piso 3'].includes(data.piso)) {
        throw new Error('Piso inválido');
      }
      mesa.piso = data.piso;
    }

    if (data.sector) {
      if (!['vid', 'valcon', 'normal'].includes(data.sector)) {
        throw new Error('Sector inválido');
      }
      mesa.sector = data.sector;
    }

    if (data.estado) {
      if (!['atendida', 'liberada', 'ocupada','reparacion'].includes(data.estado)) {
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

module.exports = MesasService;