const express = require('express');
const router = express.Router();
const Mesa = require('../models/mesasModel');
const Pedido = require('../models/pedidosModel');
const Platos = require('../models/platosModel');
const mongoose = require('mongoose');

// Obtener todas las mesas
router.get('/', async (req, res) => {
  try {
    const mesas = await Mesa.find().sort({ numeroMesa: 1 });
    res.json({
      success: true,
      mesas: mesas
    });
  } catch (error) {
    console.error('Error al obtener mesas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener mesa por ID
router.get('/:id', async (req, res) => {
  try {
    const mesa = await Mesa.findById(req.params.id);
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }
    res.json({
      success: true,
      mesa: mesa
    });
  } catch (error) {
    console.error('Error al obtener mesa:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Crear nueva mesa
router.post('/', async (req, res) => {
  try {
    const { numeroMesa, piso, sector, capacidad } = req.body;

    // Validar que el número de mesa sea único
    const mesaExistente = await Mesa.findOne({ numeroMesa });
    if (mesaExistente) {
      return res.status(400).json({ 
        error: `El número de mesa ${numeroMesa} ya existe` 
      });
    }

    const mesa = new Mesa({
      numeroMesa,
      piso,
      sector,
      capacidad: capacidad || 4,
      estado: 'disponible'
    });

    const mesaGuardada = await mesa.save();
    
    res.status(201).json({
      success: true,
      message: 'Mesa creada exitosamente',
      mesa: mesaGuardada
    });
  } catch (error) {
    console.error('Error al crear mesa:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        error: 'Datos de mesa inválidos: ' + error.message 
      });
    }
    
    res.status(500).json({ 
      error: 'Error interno del servidor: ' + error.message 
    });
  }
});

// Actualizar mesa
router.put('/:id', async (req, res) => {
  try {
    const { numeroMesa, piso, sector, capacidad, estado } = req.body;
    
    const mesa = await Mesa.findById(req.params.id);
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    // Validar número de mesa único al actualizar
    if (numeroMesa && numeroMesa !== mesa.numeroMesa) {
      const mesaExistente = await Mesa.findOne({ 
        numeroMesa, 
        _id: { $ne: req.params.id } 
      });
      if (mesaExistente) {
        return res.status(400).json({ 
          error: `El número de mesa ${numeroMesa} ya existe` 
        });
      }
      mesa.numeroMesa = numeroMesa;
    }

    if (piso) mesa.piso = piso;
    if (sector) mesa.sector = sector;
    if (capacidad) mesa.capacidad = capacidad;
    if (estado) mesa.estado = estado;

    const mesaActualizada = await mesa.save();
    
    res.json({
      success: true,
      message: 'Mesa actualizada exitosamente',
      mesa: mesaActualizada
    });
  } catch (error) {
    console.error('Error al actualizar mesa:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Eliminar mesa
router.delete('/:id', async (req, res) => {
  try {
    const mesa = await Mesa.findByIdAndDelete(req.params.id);
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }
    
    res.json({
      success: true,
      message: 'Mesa eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar mesa:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Filtrar mesas por estado
router.get('/filtrar/estado', async (req, res) => {
  try {
    const { estado } = req.query;
    const filtro = estado ? { estado } : {};
    
    const mesas = await Mesa.find(filtro).sort({ numeroMesa: 1 });
    
    res.json({
      success: true,
      mesas: mesas
    });
  } catch (error) {
    console.error('Error al filtrar mesas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Cambiar estado de mesa
router.patch('/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    
    const mesa = await Mesa.findById(req.params.id);
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    mesa.estado = estado;
    const mesaActualizada = await mesa.save();
    
    res.json({
      success: true,
      message: `Mesa ${estado} exitosamente`,
      mesa: mesaActualizada
    });
  } catch (error) {
    console.error('Error al cambiar estado de mesa:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Contar mesas por estado
router.get('/conteo/estado', async (req, res) => {
  try {
    const conteo = await Mesa.aggregate([
      {
        $group: {
          _id: '$estado',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      conteo: conteo
    });
  } catch (error) {
    console.error('Error al contar mesas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener historial de mesa
router.get('/:id/historial', async (req, res) => {
  try {
    const mesa = await Mesa.findById(req.params.id)
      .populate('historialPedidos.pedido')
      .populate('pedidoActual');
    
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }
    
    res.json({
      success: true,
      historial: mesa.historialPedidos,
      pedidoActual: mesa.pedidoActual
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ NUEVA RUTA: Liberar mesa (usada en el botón "Liberar Mesa")
router.post('/:id/liberar', async (req, res) => {
  try {
    const { pedidoId } = req.body;
    const mesa = await Mesa.findById(req.params.id);
    
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    // Verificar que el pedido esté pagado si se proporciona pedidoId
    if (pedidoId) {
      const pedido = await Pedido.findById(pedidoId);
      if (pedido && pedido.estadoPago !== 'pagado') {
        return res.status(400).json({ 
          error: 'No se puede liberar la mesa si el pedido no está pagado' 
        });
      }
    }

    // Liberar mesa
    mesa.estado = 'liberada';
    mesa.pedidoActual = null;
    await mesa.save();

    res.json({ 
      success: true, 
      message: 'Mesa liberada correctamente',
      mesa: mesa
    });

  } catch (error) {
    console.error('Error al liberar mesa:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ NUEVA RUTA: Marcar mesa como atendida
router.post('/:id/marcar-atendida', async (req, res) => {
  try {
    const mesa = await Mesa.findById(req.params.id);
    
    if (!mesa) {
      return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    mesa.estado = 'atendida';
    await mesa.save();

    res.json({ 
      success: true, 
      message: 'Mesa marcada como atendida',
      mesa: mesa
    });

  } catch (error) {
    console.error('Error al marcar mesa como atendida:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ✅ NUEVA RUTA: Obtener mesas disponibles
router.get('/estado/disponibles', async (req, res) => {
  try {
    const mesas = await Mesa.find({ 
      estado: { $in: ['disponible', 'liberada'] } 
    }).sort({ numeroMesa: 1 });

    res.json({
      success: true,
      mesas: mesas
    });
  } catch (error) {
    console.error('Error al obtener mesas disponibles:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;