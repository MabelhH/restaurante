const Platos = require('../models/platosModel');
const Categoria = require('../models/categoriaModel');

class PlatoService {
    async getAll() {
        return await Platos.find({}).populate('categoria', 'nombre');
    }

    async getById(id) {
        return await Platos.findById(id).populate('categoria', 'nombre');
    }

    async create(data) {
        // ✅ VERIFICAR SI data.categoria ES UN ID VÁLIDO (que viene del frontend)
        if (!data.categoria || !data.categoria.match(/^[0-9a-fA-F]{24}$/)) {
            throw new Error('ID de categoría inválido');
        }

        // ✅ VERIFICAR QUE LA CATEGORÍA EXISTA
        const categoriaExistente = await Categoria.findById(data.categoria);
        if (!categoriaExistente) {
            throw new Error('Categoría no encontrada');
        }

        // ✅ CREAR PLATO CON EL ID DE CATEGORÍA
        const plato = new Platos(data);
        const platoGuardado = await plato.save();
        
        // ✅ HACER POPULATE PARA DEVOLVER LA CATEGORÍA COMPLETA
        return await Platos.findById(platoGuardado._id).populate('categoria', 'nombre');
    }

    async update(id, data) {
        if (data.categoria) {
            // ✅ VERIFICAR SI ES UN ID VÁLIDO
            if (!data.categoria.match(/^[0-9a-fA-F]{24}$/)) {
                throw new Error('ID de categoría inválido');
            }

            // ✅ VERIFICAR QUE LA CATEGORÍA EXISTA
            const categoriaExistente = await Categoria.findById(data.categoria);
            if (!categoriaExistente) {
                throw new Error('Categoría no encontrada');
            }
        }

        // ✅ ACTUALIZAR Y HACER POPULATE
        const platoActualizado = await Platos.findByIdAndUpdate(id, data, { 
            new: true 
        }).populate('categoria', 'nombre');

        return platoActualizado;
    }

    async delete(id) {
        return await Platos.findByIdAndDelete(id);
    }

    async verificarStockMinimo() {
        return await Platos.find({ 
            stock: { $lte: '$stockMinimo' } 
        }).populate('categoria', 'nombre');
    }

    async toggleEstado(id) {
        const plato = await Platos.findById(id);
        if (!plato) throw new Error('Plato no encontrado');

        plato.estado = plato.estado === 'activo' ? 'inactivo' : 'activo';
        const platoActualizado = await plato.save();
        
        // ✅ HACER POPULATE DESPUÉS DE GUARDAR
        return await Platos.findById(platoActualizado._id).populate('categoria', 'nombre');
    }
}

module.exports = PlatoService;