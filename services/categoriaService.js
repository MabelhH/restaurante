const Categoria = require('../models/categoriaModel');
const Platos = require('../models/platosModel');

class CategoriaService {
    async getAll() {
        return await Categoria.find({}).sort({ nombre: 1 });
    }

    async getById(id) {
        return await Categoria.findById(id);
    }

    async getByName(nombre) {
        return await Categoria.findOne({ 
            nombre: { $regex: new RegExp(`^${nombre}$`, 'i') } 
        });
    }

    async create(nombre) {
        // Validaciones
        if (!nombre || nombre.trim() === '') {
            throw new Error('El nombre de la categoría es requerido');
        }

        // Verificar si ya existe (case-insensitive)
        const categoriaExistente = await this.getByName(nombre);
        
        if (categoriaExistente) {
            throw new Error('La categoría ya existe');
        }

        const categoria = new Categoria({ nombre: nombre.trim() });
        return await categoria.save();
    }

    async update(id, nombre) {
        if (!nombre || nombre.trim() === '') {
            throw new Error('El nombre de la categoría es requerido');
        }

        // Verificar si ya existe (excluyendo la actual)
        const categoriaExistente = await Categoria.findOne({ 
            _id: { $ne: id },
            nombre: { $regex: new RegExp(`^${nombre}$`, 'i') } 
        });
        
        if (categoriaExistente) {
            throw new Error('La categoría ya existe');
        }

        return await Categoria.findByIdAndUpdate(
            id, 
            { nombre: nombre.trim() }, 
            { new: true, runValidators: true }
        );
    }

    async delete(id) {
        // Verificar si hay platos usando esta categoría
        const platosConCategoria = await Platos.findOne({ categoria: id });
        
        if (platosConCategoria) {
            throw new Error('No se puede eliminar la categoría porque hay platos asociados');
        }

        const categoria = await Categoria.findByIdAndDelete(id);
        if (!categoria) {
            throw new Error('Categoría no encontrada');
        }
        return categoria;
    }

    async countPlatosByCategoria() {
        return await Platos.aggregate([
            {
                $group: {
                    _id: '$categoria',
                    count: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: 'categorias',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'categoriaInfo'
                }
            },
            {
                $unwind: '$categoriaInfo'
            },
            {
                $project: {
                    _id: 0,
                    categoriaId: '$_id',
                    categoriaNombre: '$categoriaInfo.nombre',
                    totalPlatos: '$count'
                }
            },
            {
                $sort: { categoriaNombre: 1 }
            }
        ]);
    }

    async getCategoriasConPlatos() {
        return await this.countPlatosByCategoria();
    }

    async searchCategorias(searchTerm) {
        return await Categoria.find({
            nombre: { $regex: searchTerm, $options: 'i' }
        }).sort({ nombre: 1 });
    }
}

module.exports = CategoriaService;