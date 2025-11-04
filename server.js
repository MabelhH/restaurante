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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== Motor de plantillas EJS =====
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ===== Clave secreta JWT =====
const SECRET_KEY = 'tu_clave_secreta_aqui'; // ⚠️ luego mover a .env

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

// =====================================================================
// ======== RUTAS API (para manejar datos tipo REST) ===================
// =====================================================================
const clienteRouter = require('./routers/clientesRouters');
const platosRouter = require('./routers/platosRouters');
const ventaRouter = require('./routers/ventasRouters');
const userRouter = require('./routers/userRouters');
const mesasRouter = require('./routers/mesasRouter');

app.use('/api/clientes', clienteRouter);
app.use('/api/platos', platosRouter);
app.use('/api/ventas', ventaRouter);
app.use('/api/users', userRouter);
app.use('/api/mesas', mesasRouter);

// =====================================================================
// ======== RUTAS DE VISTAS (para renderizar páginas EJS) ==============
// =====================================================================
const cartaViewRouter = require('./routers/cartaViewRouter');
const clienteViewRouter = require('./routers/clienteViewRouter');
const platosViewRouter = require('./routers/platosViewRouter');
const ventaViewRouter = require('./routers/ventaViewRouter');
const userViewRouter = require('./routers/userViewRouter');
const mesasViewRouter = require('./routers/mesasViewRouter');
const pagosRouter = require('./routers/pagosRouter');

// Vistas principales
app.use('/clientes', clienteViewRouter);
app.use('/platos', platosViewRouter);
app.use('/ventas', ventaViewRouter);
app.use('/mesas', mesasViewRouter);
app.use('/carta', cartaViewRouter);
app.use('/pagos', pagosRouter);
app.use('/', userViewRouter); // login, register, dashboard general

// =====================================================================
// ======== VISTA PERSONALIZADA DEL CAJERO =============================
// =====================================================================
// (crea el archivo views/dashboard-cajero.ejs si no existe)
app.get('/dashboard_cajero', verifyToken, (req, res) => {
  res.render('dashboard_cajero', { usuario: req.user });
});

// =====================================================================
// ======== RUTAS PRINCIPALES (dashboard general y raíz) ===============
// =====================================================================

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

// Dashboard principal (genérico)
app.get('/dashboard', verifyToken, (req, res) => {
  res.render('dashboard', { usuario: req.user });
});

// MANEJO DE ERRORES
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`)
);
