// controllers/userController.js

const Usuario = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserService = require('../services/userService');
const userService = new UserService();

const SECRET_KEY = 'tu_clave_secreta_aqui'; // Mejor usar .env

// ==================== Middleware JWT ====================
exports.verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/login');
  }
};


// ==================== Dashboard protegido ====================
exports.dashboard = async (req, res) => {
  try {
    const users = await Usuario.find(); // todos los usuarios
    res.render('dashboard', {
      user: req.user, // usuario logueado
      users          // lista de usuarios
    });
  } catch (err) {
    console.error(err);
    res.render('dashboard', { user: req.user, users: [], error: 'Error al obtener usuarios' });
  }
};

// ==================== Registro ====================
exports.register = async (req, res) => {
  try {
    const { nombre, apellido, email, password } = req.body;

    const existingUser = await Usuario.findOne({ email });
    if (existingUser) return res.render('register', { error: 'Usuario ya registrado' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new Usuario({ nombre, apellido, email, password: hashedPassword });
    await newUser.save();

    res.redirect('/login');
  } catch (err) {
    res.render('register', { error: err.message });
  }
};
// ==================== Login ====================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Usuario.findOne({ email });
    if (!user) return res.render('login', { error: 'Usuario no encontrado' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render('login', { error: 'Contraseña incorrecta' });

    // Crear JWT
    const token = jwt.sign(
      { id: user._id, nombre: user.nombre, email: user.email },
      SECRET_KEY,
      { expiresIn: '1h' }
    );

    // Guardar token en cookie
    res.cookie('token', token, { httpOnly: true });

    res.redirect('/dashboard');
  } catch (err) {
    res.render('login', { error: err.message });
  }
};

// ==================== CRUD Usuarios ====================

// Obtener todos los usuarios
exports.getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAll();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Obtener usuario por ID
exports.getUser = async (req, res) => {
  try {
    const user = await userService.filterById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Crear usuario
exports.createUser = async (req, res) => {
  try {
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }
    const newUser = await userService.create(req.body);
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Actualizar usuario
exports.updateUser = async (req, res) => {
  try {
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }
    const updatedUser = await userService.update(req.params.id, req.body);
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Eliminar usuario
exports.deleteUser = async (req, res) => {
  try {
    const deleted = await userService.delete(req.params.id);
    res.json(deleted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
