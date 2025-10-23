const Producto = require('../models/clienteModel');

class ProductoService {
  async getAll() {
    return await Producto.find();
  }

  async getById(id) {
    return await Producto.findById(id);
  }

  async create(data) {
    const producto = new Producto(data);
    return await producto.save();
  }

  async update(id, data) {
    return await Producto.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return await Producto.findByIdAndDelete(id);
  }

  // Verificar productos con stock bajo
  async verificarStockMinimo() {
    return await Producto.find({ $expr: { $lte: ["$stock", "$stockMinimo"] } });
  }


}

module.exports = ProductoService;
