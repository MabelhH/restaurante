const Platos = require('../models/platosModel');
const Categoria = require('../models/categoriaModel');

class PlatoService {
    async getAll() {
        return await Platos.find({})
            .populate('categoria', 'nombre')
            .sort({ nombre: 1 });
    }

    async getById(id) {
        return await Platos.findById(id).populate('categoria', 'nombre');
    }

    async create(data) {
        // CAMBIO: Validar que la categoría existe
        if (!data.categoria) {
            throw new Error('La categoría es requerida');
        }

        const categoriaExistente = await Categoria.findById(data.categoria);
        if (!categoriaExistente) {
            throw new Error('Categoría no encontrada');
        }

        // CAMBIO: Crear con campos del modelo actualizado
        const plato = new Platos({
            nombre: data.nombre,
            categoria: data.categoria,
            descripcion: data.descripcion,
            precio: data.precio,
            stock: data.stock || 0,
            stockMinimo: data.stockMinimo || 5,
            imagen: data.imagen,
            tiempoPreparacion: data.tiempoPreparacion || 15,
            estado: data.estado || 'activo',
            disponible: data.disponible !== undefined ? data.disponible : true
        });

        const platoGuardado = await plato.save();
        return await Platos.findById(platoGuardado._id).populate('categoria', 'nombre');
    }

    async update(id, data) {
        // CAMBIO: Validar categoría si se está actualizando
        if (data.categoria) {
            const categoriaExistente = await Categoria.findById(data.categoria);
            if (!categoriaExistente) {
                throw new Error('Categoría no encontrada');
            }
        }

        const platoActualizado = await Platos.findByIdAndUpdate(
            id, 
            data, 
            { new: true, runValidators: true }
        ).populate('categoria', 'nombre');

        if (!platoActualizado) {
            throw new Error('Plato no encontrado');
        }

        return platoActualizado;
    }

    async delete(id) {
        const plato = await Platos.findByIdAndDelete(id);
        if (!plato) throw new Error('Plato no encontrado');
        return plato;
    }

    // CAMBIO: Verificar stock mínimo corregido
    async verificarStockMinimo() {
        return await Platos.find({ 
            stock: { $lte: { $expr: '$stockMinimo' } } // CORRECCIÓN: Sintaxis corregida
        }).populate('categoria', 'nombre');
    }

    async toggleEstado(id) {
        const plato = await Platos.findById(id);
        if (!plato) throw new Error('Plato no encontrado');

        plato.estado = plato.estado === 'activo' ? 'inactivo' : 'activo';
        // CAMBIO: Actualizar disponibilidad según estado
        if (plato.estado === 'inactivo') {
            plato.disponible = false;
        }
        
        const platoActualizado = await plato.save();
        return await Platos.findById(platoActualizado._id).populate('categoria', 'nombre');
    }

    // NUEVO: Método para verificar disponibilidad
    async verificarDisponibilidad(id, cantidad = 1) {
        const plato = await Platos.findById(id);
        if (!plato) throw new Error('Plato no encontrado');

        return {
            disponible: plato.disponible && plato.estado === 'activo',
            stock: plato.stock,
            suficiente: plato.stock >= cantidad
        };
    }

    // NUEVO: Método para actualizar stock
    async actualizarStock(id, nuevoStock) {
        const plato = await Platos.findById(id);
        if (!plato) throw new Error('Plato no encontrado');

        plato.stock = nuevoStock;
        plato.disponible = nuevoStock > 0;
        
        return await plato.save();
    }
}

module.exports = PlatoService;