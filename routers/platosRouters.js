const express = require('express');
const router = express.Router();
const platosController = require('../controllers/PlatosController');
const upload = require('../middlewares/upload');

// Usar el middleware upload para el campo 'imagen'
router.post('/', upload, platosController.crear);
router.put('/:id', upload, platosController.actualizar);

// El resto de las rutas permanecen igual
router.get('/', platosController.listar);
router.get('/:id', platosController.obtener);
router.delete('/:id', platosController.eliminar);
router.get('/verificar/stock', platosController.verificarStock);
router.put('/:id/toggle-estado', platosController.cambiarEstado);

module.exports = router;