const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const Usuario = require('../models/userModel');

// Importar middleware
const { verifyToken } = userController;

router.get('/login', (req, res) => res.render('login', { error: null }));
router.get('/register', (req, res) => res.render('register', { error: null }));

router.post('/login', userController.login);
router.post('/register', userController.register);

// Dashboard protegido
router.get('/dashboard', verifyToken, async (req, res) => {
    const users = await Usuario.find(); // todos los usuarios
    res.render('dashboard', { usuario: req.user, users });
});

router.get('/logout', (req, res) => {
    res.clearCookie('token'); // elimina la cookie con el JWT
    res.redirect('/login');   // redirige al login
});

module.exports = router;
