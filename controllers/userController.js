const Usuario = require('../models/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const UserService = require('../services/userService');
const userService = new UserService();

const SECRET_KEY = 'tu_clave_secreta_aqui'; // Usa .env idealmente

// ==================== Middleware JWT ====================
exports.verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token inválido:', err.message);
    res.clearCookie('token');
    return res.redirect('/login');
  }
};

// ==================== Dashboard protegido ====================
exports.dashboard = async (req, res) => {
  try {
    const users = await Usuario.find();
    res.render('dashboard', { user: req.user, users });
  } catch (err) {
    console.error(err);
    res.render('dashboard', { user: req.user, users: [], error: 'Error al obtener usuarios' });
  }
};

// ==================== Registro ====================
exports.registerView = async (req, res) => {
  try {
    // Si ya existe un admin, verificamos si el usuario logueado es admin
    const adminExistente = await Usuario.findOne({ rol: 'admin' });

    if (adminExistente) {
      const token = req.cookies.token;

      if (!token) {
        return res.status(403).send('Acceso denegado. Solo el admin puede registrar nuevos usuarios.');
      }

      try {
        const decoded = jwt.verify(token, SECRET_KEY);
        if (decoded.rol !== 'admin') {
          return res.status(403).send('Acceso denegado. Solo el admin puede registrar nuevos usuarios.');
        }
      } catch (err) {
        return res.status(403).send('Token inválido.');
      }
    }

    res.render('register', { error: null });
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Error al cargar la vista' });
  }
};

// ==================== Registro de usuario ====================
exports.register = async (req, res) => {
  try {
    const { nombre, apellido, email, password, rol } = req.body;

    const existingUser = await Usuario.findOne({ email });
    if (existingUser)
      return res.render('register', { error: 'Usuario ya registrado' });

    // Solo permitir crear admin si no existe uno
    if (rol === 'admin') {
      const adminExistente = await Usuario.findOne({ rol: 'admin' });
      if (adminExistente)
        return res.render('register', { error: 'Ya existe un administrador registrado' });
    } else {
      // Si no es admin, validar que quien crea sea un admin
      const token = req.cookies.token;
      if (!token) return res.render('register', { error: 'Acceso denegado. Solo el admin puede registrar nuevos usuarios.' });

      const decoded = jwt.verify(token, SECRET_KEY);
      if (decoded.rol !== 'admin') {
        return res.render('register', { error: 'Solo el admin puede registrar nuevos usuarios.' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new Usuario({ nombre, apellido, email,password: hashedPassword, rol});
    await newUser.save();

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('register', { error: 'Error al registrar el usuario' });
  }
};
// ==================== Vista para registrar usuarios desde el panel del admin ====================
exports.viewRegisterAdmin = async (req, res) => {
  try {
    const users = await Usuario.find();
    res.render('register_admin', { user: req.user, users, error: null });
  } catch (err) {
    console.error(err);
    res.render('register_admin', { user: req.user, users: [], error: 'Error al cargar usuarios' });
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

    // Crear token con datos del usuario y rol
    const token = jwt.sign(
      { id: user._id, nombre: user.nombre, email: user.email, rol: user.rol },
      SECRET_KEY,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, { httpOnly: true });
    switch (user.rol) {
      case 'admin':
        return res.redirect('/dashboard');
      case 'mesero':
        return res.redirect('/dashboard_mesero');
      // case 'cocinero':
      //   return res.redirect('/cocinero');
      // case 'cajero':
      //   return res.redirect('/cajero');
      default:
        return res.redirect('/login');
    }
  } catch (err) {
    console.error(err);
    res.render('login', { error: err.message });
  }
};

// ==================== Middleware de autorización por rol ====================
exports.onlyAdmin = (req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).send('Acceso denegado. Solo el administrador puede realizar esta acción.');
  }
  next();
};

// ==================== CRUD Usuarios (solo admin) ====================
exports.getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAll();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await userService.filterById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    // Solo admin puede crear usuarios
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo el administrador puede crear usuarios' });
    }

    // Validar que no haya más de un admin
    if (req.body.rol === 'admin') {
      const adminExistente = await Usuario.findOne({ rol: 'admin' });
      if (adminExistente)
        return res.status(400).json({ error: 'Ya existe un administrador registrado' });
    }

    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const newUser = await userService.create(req.body);
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo el administrador puede editar usuarios' });
    }

    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const updatedUser = await userService.update(req.params.id, req.body);
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo el administrador puede eliminar usuarios' });
    }

    const deleted = await userService.delete(req.params.id);
    res.json(deleted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};