const express = require('express');
const router = express.Router();
const platosController = require('../controllers/PlatosController');

// Rutas públicas para productos
router.get('/', platosController.listar);
router.get('/:id', platosController.obtener);
router.post('/', platosController.crear);
router.put('/:id', platosController.actualizar);
router.delete('/:id', platosController.eliminar);

// Stock bajo
router.get('/verificar/stock', platosController.verificarStock);

module.exports = router;
