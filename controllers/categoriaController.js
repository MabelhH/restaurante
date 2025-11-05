const Categoria = require('../models/categoriaModel');

const categoriaController = {
  async getAll(req, res) {
    try {
      const categorias = await Categoria.find({}).sort({ nombre: 1 }); // Ordenar por nombre
      res.json(categorias);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async create(req, res) {
    try {
      const { nombre } = req.body;

      if (!nombre || nombre.trim() === '') {
        return res.status(400).json({ error: 'El nombre de la categoría es requerido' });
      }

      // Búsqueda case-insensitive
      const categoriaExistente = await Categoria.findOne({ 
        nombre: { $regex: new RegExp(`^${nombre}$`, 'i') } 
      });
      
      if (categoriaExistente) {
        return res.status(400).json({ error: 'La categoría ya existe' });
      }

      const categoria = new Categoria({ nombre: nombre.trim() });
      await categoria.save();
      res.status(201).json(categoria);
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({ error: 'La categoría ya existe' });
      }
      res.status(500).json({ error: error.message });
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // Verificar si hay platos usando esta categoría antes de eliminar
      const Platos = require('../models/platosModel');
      const platosConCategoria = await Platos.findOne({ categoria: id });
      
      if (platosConCategoria) {
        return res.status(400).json({ 
          error: 'No se puede eliminar la categoría porque hay platos asociados' 
        });
      }

      const categoria = await Categoria.findByIdAndDelete(id);
      if (!categoria) {
        return res.status(404).json({ error: 'Categoría no encontrada' });
      }
      res.json({ message: 'Categoría eliminada correctamente' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = categoriaController;