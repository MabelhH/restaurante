// ===== Dependencias =====
const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const Usuario = require('./models/userModel');
require('./database/connection'); // conexión a MongoDB

// ===== Inicializar app =====
const app = express();

// ===== Middlewares =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cookieParser());

// ===== Archivos estáticos =====
app.use(express.static(path.join(__dirname, 'public')));

// ===== Motor de plantillas EJS =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ===== Clave secreta JWT =====
const SECRET_KEY = 'tu_clave_secreta_aqui'; // ⚠️ pon esto en .env luego

// ===== Middleware para verificar token =====
function verifyToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/login');
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.user = decoded; // datos del usuario (id, email, nombre)
        next();
    } catch (err) {
        res.clearCookie('token');
        return res.redirect('/login');
    }
}

// ===== Routers API =====
const clienteRouter = require('./routers/clientesRouters');
const platosRouter = require('./routers/platosRouters');
const ventaRouter = require('./routers/ventasRouters');
const userApiRouter = require('./routers/userRouters'); // CRUD API usuarios

app.use('/api/clientes', clienteRouter);
app.use('/api/platos', platosRouter);
app.use('/api/ventas', ventaRouter);
app.use('/api/users', userApiRouter); // API REST protegida con JWT

// ===== Routers de vistas =====
const clienteViewRouter = require('./routers/clienteViewRouter');
const platosViewRouter = require('./routers/platosViewRouter');
const ventaViewRouter = require('./routers/ventaViewRouter');
const userViewRouter = require('./routers/userViewRouter'); // Login, Register, Dashboard

app.use('/clientes', clienteViewRouter);
app.use('/platos', platosViewRouter);
app.use('/ventas', ventaViewRouter);
app.use('/', userViewRouter); // rutas de usuario

// ===== Rutas de vistas principales =====

// Ruta raíz → login o dashboard según token
app.get('/', async (req, res) => {
  const token = req.cookies.token;
  if (!token) return res.redirect('/login');

  try {
    const usuario = jwt.verify(token, SECRET_KEY); // usuario logueado
    const users = await Usuario.find(); // lista de todos los usuarios

    res.render('dashboard', { usuario, users }); // pasar ambos
  } catch (err) {
    res.clearCookie('token');
    res.redirect('/login');
  }
});
// Ruta protegida (solo con token válido)
app.get('/dashboard', verifyToken, (req, res) => {
    res.render('dashboard', { usuario: req.user });
});

// ===== Manejo de errores básicos =====
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// ===== Servidor =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en http://localhost:${PORT}`));
