const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const userController = require('../controllers/userController');
const Usuario = require('../models/userModel');

// Importar middleware
const { verifyToken } = userController;

// Rutas de autenticación
router.get('/login', (req, res) => res.render('login', { error: null }));
router.get('/register', (req, res) => res.render('register', { error: null }));

router.post('/login', userController.login);
router.post('/register', userController.register);

// Dashboard protegido
router.get('/dashboard', verifyToken, async (req, res) => {
  const users = await Usuario.find();
  
  // CORREGIDO: Pasar el usuario con _id
  const userData = {
    ...req.user,
    _id: req.user._id || req.user.id // Compatibilidad con ambos
  };

  res.render('dashboard', { usuario: userData, users });
});

// Dashboard de mesero
router.get('/dashboard_mesero', verifyToken, async (req, res) => {
  try {
    const users = await Usuario.find();

    // CORREGIDO: Pasar el usuario con _id
    const userData = {
      ...req.user,
      _id: req.user._id || req.user.id // Compatibilidad con ambos
    };

    res.render('dashboard_mesero', {
      usuario: userData,
      users,
    });
  } catch (error) {
    console.error('Error al cargar dashboard del mesero:', error);
    res.render('dashboard_mesero', {
      usuario: req.user,
      users: [],
      error: 'Error al cargar los usuarios',
    });
  }
});

// Dashboard de cajero
router.get('/dashboard_cajero', verifyToken, async (req, res) => {
  try {
    const users = await Usuario.find();
    
    // CORREGIDO: Pasar el usuario con _id
    const userData = {
      ...req.user,
      _id: req.user._id || req.user.id // Compatibilidad con ambos
    };

    res.render('dashboard_cajero', {
      usuario: userData,
      users,
      error: null
    });
  } catch (error) {
    res.render('dashboard_cajero', {
      usuario: req.user,
      users: [],
      error: 'Error al cargar usuarios'
    });
  }
});

// Logout
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

module.exports = router;