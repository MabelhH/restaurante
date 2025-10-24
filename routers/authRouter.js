// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const verifyToken = require('../middlewares/verifyToken');

// Login
router.get('/login', (req, res) => res.render('login'));
router.post('/login', userController.login);

// Registro (solo admin logueado o si aún no existe ningún admin)
router.get('/register', userController.registerView);
router.post('/register', userController.register);

// Dashboard protegido
router.get('/dashboard', verifyToken, userController.dashboard);

module.exports = router;
