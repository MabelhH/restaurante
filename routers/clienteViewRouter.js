const express = require('express');
const router = express.Router();

// Ruta para mostrar la vista de clientes
router.get('/', (req, res) => {
    console.log('🔍 Session:', req.session);
    console.log('🔍 User:', req.user);
    console.log('🔍 Session usuario:', req.session.usuario);
    
    // Probar diferentes opciones
    const usuario = req.user || req.session.usuario || { nombre: 'Administrador' };
    
    res.render('clientes', { usuario: usuario });
});

module.exports = router;