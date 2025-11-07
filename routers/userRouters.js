const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// Dashboard protegido
router.get('/dashboard', userController.verifyToken, userController.dashboard);
router.get('/dashboard_cocinero', userController.verifyToken, userController.dashboard);
router.get('/dashboard_mesero', userController.verifyToken, userController.dashboard);
// CRUD (solo admin)
router.get('/', userController.verifyToken, userController.onlyAdmin, userController.getAllUsers);
router.get('/:id', userController.verifyToken, userController.onlyAdmin, userController.getUser);
router.post('/', userController.verifyToken, userController.onlyAdmin, userController.createUser);
router.put('/:id', userController.verifyToken, userController.onlyAdmin, userController.updateUser);
router.delete('/:id', userController.verifyToken, userController.onlyAdmin, userController.deleteUser);

// ==== NUEVAS RUTAS ====
router.get('/register_admin', userController.verifyToken, userController.onlyAdmin, userController.viewRegisterAdmin);
router.post('/register_admin', userController.verifyToken, userController.onlyAdmin, userController.createUser);

module.exports = router;