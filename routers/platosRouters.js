const express = require('express');
const multer = require('multer');
const router = express.Router();
const platosController = require('../controllers/PlatosController');
const upload = require('../middlewares/upload');


// Usamos .single('imagenFile') para recibir el archivo
router.post('/', upload.single('imagenFile'), platosController.crear);
router.put('/:id', upload.single('imagenFile'), platosController.actualizar);

// Rutas públicas para productos
router.get('/', platosController.listar);
router.get('/:id', platosController.obtener);
router.delete('/:id', platosController.eliminar);

// Stock bajo
router.get('/verificar/stock', platosController.verificarStock);

module.exports = router;
