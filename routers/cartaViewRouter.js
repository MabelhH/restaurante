const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const axios = require('axios'); 
const jwt = require('jsonwebtoken');
const SECRET_KEY = 'tu_clave_secreta_aqui';

const Plato = require('../models/platosModel');
const Categoria = require('../models/categoriaModel');
const Mesa = require('../models/mesasModel');

// Middleware para verificar el token
function verifyToken(req, res, next) {
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
}


async function obtenerImagenParaPDF(urlImagen) {
  try {
    console.log(`📥 Descargando imagen: ${urlImagen}`);
    
    // Si la imagen es una URL web
    if (urlImagen.startsWith('http')) {
      const response = await axios({
        method: 'GET',
        url: urlImagen,
        responseType: 'arraybuffer',
        timeout: 10000 // 10 segundos timeout
      });
      
      return Buffer.from(response.data);
    }
    // Si la imagen es una ruta local (empieza con /)
    if (urlImagen.startsWith('/')) {
      const fs = require('fs');
      const path = require('path');
      
      // Ajusta esta ruta según tu estructura de archivos
      const rutaCompleta = path.join(__dirname, '..', 'public', urlImagen);
      
      if (fs.existsSync(rutaCompleta)) {
        return fs.readFileSync(rutaCompleta);
      } else {
        console.log(`❌ Archivo no encontrado: ${rutaCompleta}`);
        return null;
      }
    }
    
    return null;
  } catch (error) {
    console.log(`❌ Error descargando imagen ${urlImagen}:`, error.message);
    return null;
  }
}

// Ruta /carta (unificada - elimina la duplicada)
router.get('/', verifyToken, async (req, res) => {
  try {
    console.log('👤 Usuario accediendo a carta:', req.user);
    console.log('🔍 Parámetros query:', req.query);

    const mesaAutoId = req.query.mesaAuto || req.query.mesaId;
    const mesaParam = mesaAutoId;
    const { mesa, pedidoExistente } = req.query;

    // Poblar el campo "categoria" para mostrar nombres
    const platos = await Plato.find({ estado: 'activo', disponible: true })
      .populate('categoria', 'nombre')
      .sort({ nombre: 1 });

    // Obtener todas las categorías
    const categorias = await Categoria.find({ estado: 'activo' }, 'nombre');

    // ✅ Obtener mesas disponibles para el carrito
    let mesas = [];
    let mesaSeleccionada = null;

    if (mesaParam) {
      // Buscar solo la mesa específica
      const mesaEspecifica = await Mesa.findById(mesaParam);
      if (mesaEspecifica) {
        mesas = [mesaEspecifica];
        console.log(` Mesa específica encontrada: Mesa ${mesaEspecifica.numeroMesa} (${mesaEspecifica.estado})`);
      } else {
        console.warn(` Mesa con ID ${mesaParam} no encontrada`);
        // Fallback: obtener mesas disponibles
        mesas = await Mesa.find({
          estado: { $in: ['disponible', 'liberada'] }
        }).sort({ numeroMesa: 1 });
      }
    } else if (mesa) {
      // Para pedidos existentes
      mesaSeleccionada = await Mesa.findById(mesa);
      mesas = await Mesa.find({
        estado: { $in: ['disponible', 'liberada', 'ocupada'] }
      }).sort({ numeroMesa: 1 });
    } else {
      // Si no hay parámetro, obtener todas las mesas disponibles
      mesas = await Mesa.find({
        estado: { $in: ['disponible', 'liberada'] }
      }).sort({ numeroMesa: 1 });
    }

    console.log('📊 Datos cargados:', {
      platos: platos.length,
      categorias: categorias.length,
      mesas: mesas.length,
      mesaParam: mesaParam || 'No hay parámetro'
    });

    // CORREGIDO: Pasar el usuario con _id
    const userData = {
      ...req.user,
      _id: req.user._id || req.user.id, // Compatibilidad con ambos
    };

    const renderData = { 
      usuario: userData, 
      platos, 
      categorias, 
      mesas,
      mesaSeleccionada, 
      esPedidoExistente: !!pedidoExistente 
    };

    // Renderizado según el rol del usuario
    if (req.user.rol === 'admin') {
      res.render('carta', renderData);
    } else if (req.user.rol === 'mesero') {
      res.render('cartaM', renderData);
    } else if (req.user.rol === 'cocinero') {
      res.render('cartac', renderData);
    } else {
      res.status(403).send('Acceso denegado');
    }
  } catch (err) {
    console.error('❌ Error al cargar la carta:', err);
    res.status(500).send('Error al cargar la carta');
  }
});

// Ruta para generar PDF CON imágenes funcional
router.get('/pdf', async (req, res) => {
  let doc;
  try {
    console.log('🔹 Iniciando generación de PDF con imágenes...');
    
    const platos = await Plato.find({ estado: 'activo' }).populate('categoria');
    const categorias = await Categoria.find();

    if (!platos || platos.length === 0) {
      return res.status(404).json({ error: 'No hay platos disponibles' });
    }

    console.log(`📋 Encontrados ${platos.length} platos`);

    // Crear documento PDF
    doc = new PDFDocument({
      margin: 30,
      size: 'A4'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="carta-restaurante-con-imagenes.pdf"');

    doc.pipe(res);

    // Encabezado
    doc.fillColor('#2c5530')
       .rect(0, 0, doc.page.width, 80)
       .fill();
    
    doc.fillColor('#ffffff')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('CARTA DEL RESTAURANTE', 0, 30, { align: 'center' });
    
    doc.fontSize(10)
       .text(`Generado el: ${new Date().toLocaleDateString('es-PE')}`, 0, 60, { align: 'center' });

    let yPosition = 100;

    // Agrupar platos por categoría
    const platosPorCategoria = {};
    
    categorias.forEach(categoria => {
      const platosCategoria = platos.filter(plato => 
        plato.categoria && plato.categoria._id.toString() === categoria._id.toString()
      );
      if (platosCategoria.length > 0) {
        platosPorCategoria[categoria.nombre] = platosCategoria;
      }
    });

    const platosSinCategoria = platos.filter(plato => !plato.categoria);
    if (platosSinCategoria.length > 0) {
      platosPorCategoria['Otros'] = platosSinCategoria;
    }

    // Cache de imágenes
    const cacheImagenes = {};

    // Generar contenido
    for (const [categoriaNombre, platosCategoria] of Object.entries(platosPorCategoria)) {
      if (platosCategoria.length > 0) {
        // Nueva página si es necesario
        if (yPosition > 650) {
          doc.addPage();
          yPosition = 50;
        }

        // Título de categoría
        doc.fillColor('#2c5530')
           .fontSize(16)
           .font('Helvetica-Bold')
           .text(categoriaNombre.toUpperCase(), 30, yPosition);
        
        yPosition += 25;

        // Línea divisoria
        doc.moveTo(30, yPosition)
           .lineTo(doc.page.width - 30, yPosition)
           .strokeColor('#2c5530')
           .lineWidth(1)
           .stroke();
        
        yPosition += 20;

        // Listar platos
        for (const plato of platosCategoria) {
          if (yPosition > 700) {
            doc.addPage();
            yPosition = 50;
          }

          // Intentar cargar imagen
          let imagenBuffer = null;
          if (plato.imagen && !cacheImagenes[plato.imagen]) {
            imagenBuffer = await obtenerImagenParaPDF(plato.imagen);
            cacheImagenes[plato.imagen] = imagenBuffer;
          } else if (plato.imagen) {
            imagenBuffer = cacheImagenes[plato.imagen];
          }

          // Diseño con imagen a la izquierda
          const anchoImagen = 60;
          const altoImagen = 60;
          const margen = 10;

          // Fondo del item
          const altoItem = Math.max(80, altoImagen + margen * 2);
          
          doc.fillColor('#f8f9fa')
             .roundedRect(30, yPosition, doc.page.width - 60, altoItem, 5)
             .fill();

          // Mostrar imagen o placeholder
          if (imagenBuffer) {
            try {
              doc.image(imagenBuffer, 40, yPosition + margen, {
                width: anchoImagen,
                height: altoImagen,
                fit: [anchoImagen, altoImagen]
              });
            } catch (imageError) {
              console.log(`❌ Error insertando imagen para ${plato.nombre}:`, imageError.message);
              // Placeholder si falla la imagen
              doc.fillColor('#dee2e6')
                 .rect(40, yPosition + margen, anchoImagen, altoImagen)
                 .fill();
              
              doc.fillColor('#666666')
                 .fontSize(8)
                 .text('Imagen\nno disponible', 45, yPosition + margen + 20, {
                   width: anchoImagen - 10,
                   align: 'center'
                 });
            }
          } else if (plato.imagen) {
            // Placeholder si no se pudo cargar
            doc.fillColor('#dee2e6')
               .rect(40, yPosition + margen, anchoImagen, altoImagen)
               .fill();
            
            doc.fillColor('#666666')
               .fontSize(8)
               .text('Imagen\nno disponible', 45, yPosition + margen + 20, {
                 width: anchoImagen - 10,
                 align: 'center'
               });
          } else {
            // Placeholder si no hay imagen
            doc.fillColor('#dee2e6')
               .rect(40, yPosition + margen, anchoImagen, altoImagen)
               .fill();
            
            doc.fillColor('#666666')
               .fontSize(8)
               .text('Sin\nimagen', 45, yPosition + margen + 20, {
                 width: anchoImagen - 10,
                 align: 'center'
               });
          }

          // Información del plato (a la derecha de la imagen)
          const xTexto = 40 + anchoImagen + 15;
          const anchoTexto = doc.page.width - xTexto - 40;

          // Nombre
          doc.fillColor('#000000')
             .fontSize(12)
             .font('Helvetica-Bold')
             .text(plato.nombre, xTexto, yPosition + 10, {
               width: anchoTexto
             });

          // Precio
          doc.fillColor('#2c5530')
             .fontSize(14)
             .font('Helvetica-Bold')
             .text(`S/. ${plato.precio.toFixed(2)}`, xTexto, yPosition + 30);

          // Descripción
          if (plato.descripcion) {
            doc.fillColor('#666666')
               .fontSize(9)
               .font('Helvetica')
               .text(plato.descripcion, xTexto, yPosition + 50, {
                 width: anchoTexto,
                 height: 20,
                 ellipsis: '...'
               });
          }

          yPosition += altoItem + 10;
        }

        yPosition += 10;
      }
    }

    // Pie de página
    doc.fillColor('#888888')
       .fontSize(10)
       .text('¡Gracias por su preferencia!', 0, 750, { align: 'center' });

    doc.end();
    console.log('✅ PDF con imágenes generado correctamente');

  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    
    if (doc && !res.headersSent) {
      res.status(500).json({ 
        error: 'Error generando PDF', 
        message: error.message
      });
    } else {
      res.status(500).send('Error generando PDF');
    }
  }
});


// Función auxiliar para verificar URLs
function esUrlValida(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }

}

module.exports = router;