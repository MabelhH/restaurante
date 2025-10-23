const Platos = require('../models/platosModel');

class PlatoService {
    async getAll() {
        return await Platos.find({});
    }

    async getById(id) {
        return await Platos.findById(id);
    }

    async create(data) {
        const plato = new Platos(data);
        return await plato.save();
    }

    async update(id, data) {
        return await Platos.findByIdAndUpdate(id, data, { new: true });
    }

    async delete(id) {
        return await Platos.findByIdAndDelete(id);
    }

    async verificarStockMinimo() {
        return await Platos.find({ stock: { $lte: '$stockMinimo' } });
    }
}

module.exports = PlatoService;