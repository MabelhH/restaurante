const express = require('express');
const router = express.Router();
const categoriaController = require('../controllers/categoriaController');

// GET /api/categorias - Obtener todas las categorías
router.get('/', categoriaController.getAll);

// POST /api/categorias - Crear nueva categoría
router.post('/', categoriaController.create);

// DELETE /api/categorias/:id - Eliminar categoría
router.delete('/:id', categoriaController.delete);

module.exports = router;