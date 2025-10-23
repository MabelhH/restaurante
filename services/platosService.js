const Platos = require('../models/platosModel')
class PlatoService {
    constructor() {}

    async getAll() {
        const platos = await Plato.find({})
        return platos
    }

    async filterById(id) {
        const platos = await Plato.findOne({ _id: id })
        return platos
    }

    async create(data) {
        const plato = new Plato(data)
        return await producto.save()
    }
    async update(id, data) {
        return await Plato.findByIdAndUpdate({
            _id: id
        }, data)
    }
    async delete(id) {
        return await Plato.deleteOne({
            _id: id
        });
    }
}
module.exports = PlatoService