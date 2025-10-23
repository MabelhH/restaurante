const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');


// 📊 Rutas CRUD principales
router.get('/', clienteController.listar);          // Obtener todos los clientes
router.get('/:id', clienteController.obtener);       // Obtener cliente por ID
router.post('/', clienteController.crear);           // Crear nuevo cliente
router.put('/:id', clienteController.actualizar);    // Actualizar cliente
router.delete('/:id', clienteController.eliminar);   // Eliminar cliente

module.exports = router;
