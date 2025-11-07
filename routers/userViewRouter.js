const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const userController = require('../controllers/userController');
const Usuario = require('../models/userModel');

// Importar middleware
const { verifyToken } = userController;

router.get('/login', (req, res) => res.render('login', { error: null }));
router.get('/register', (req, res) => res.render('register', { error: null }));

router.post('/login', userController.login);
router.post('/register', userController.register);

router.get('/register_admin', verifyToken, async (req, res) => {
  const users = await Usuario.find();
  res.render('register_admin', { user: req.user, users, error: null, success: null });
});

router.post('/register_admin', verifyToken, async (req, res) => {
  try {
    const { nombre, apellido, email, password, rol } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const nuevoUsuario = new Usuario({ nombre, apellido, email, password: hashedPassword, rol });
    await nuevoUsuario.save();
    const users = await Usuario.find();
    res.render('register_admin', { 
      user: req.user, 
      users, 
      error: null, 
      success: `El usuario registrado correctamente como ${rol}`  
    });
  } catch (error) {
    const users = await Usuario.find();
    res.render('register_admin', { user: req.user, users, error: 'Error al registrar usuario' ,success: null});
  }
});

// Dashboard protegido
router.get('/dashboard', verifyToken, async (req, res) => {
  const users = await Usuario.find(); // todos los usuarios
  res.render('dashboard', { usuario: req.user, users });
});


// 🟢 Dashboard de mesero
router.get('/dashboard_mesero', verifyToken, async (req, res) => {
  try {
    // Si deseas que el mesero vea los clientes registrados:
    const users = await Usuario.find();

    res.render('dashboard_mesero', {
      usuario: req.user, // datos del usuario logueado
      users,             // lista de usuarios para el bucle EJS
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


//  Dashboard de cajero
router.get('/dashboard_cajero', verifyToken, async (req, res) => {
  try {
    const users = await Usuario.find();
    res.render('dashboard_cajero', {
      usuario: req.user || {},
      users,
      error: null
    });
  } catch (error) {
    res.render('dashboard_cajero', {
      usuario: req.user || {},
      users: [],
      error: 'Error al cargar usuarios'
    });
  }
});

router.get('/dashboard_cocinero', verifyToken, async (req, res) => {
  try {
    const users = await Usuario.find();
    res.render('dashboard_cocinero', {
      usuario: req.user || {},
      users,
      error: null
    });
  } catch (error) {
    res.render('dashboard_cocinero', {
      usuario: req.user || {},
      users: [],
      error: 'Error al cargar usuarios'
    });
  }
});


router.get('/logout', (req, res) => {
  res.clearCookie('token'); // elimina la cookie con el JWT
  res.redirect('/login');   // redirige al login
});

module.exports = router;