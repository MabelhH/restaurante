const Platos = require('../models/platosModel');
const Categoria = require('../models/categoriaModel');
const cron = require('node-cron');

class PlatoService {
    constructor() {
        this.iniciarDesactivacionAutomatica();
    }
    async getAll() {
        return await Platos.find({})
            .populate('categoria', 'nombre')
            .sort({ nombre: 1 });
    }

    async getById(id) {
        return await Platos.findById(id).populate('categoria', 'nombre');
    }

    async create(data) {
        // CAMBIO: Validar que la categoría existe
        if (!data.categoria) {
            throw new Error('La categoría es requerida');
        }

        const categoriaExistente = await Categoria.findById(data.categoria);
        if (!categoriaExistente) {
            throw new Error('Categoría no encontrada');
        }

        // CAMBIO: Crear con campos del modelo actualizado
        const plato = new Platos({
            nombre: data.nombre,
            categoria: data.categoria,
            descripcion: data.descripcion,
            precio: data.precio,
            stock: data.stock || 0,
            stockMinimo: data.stockMinimo || 5,
            imagen: data.imagen,
            tiempoPreparacion: data.tiempoPreparacion || 15,
            estado: data.estado || 'activo',
            disponible: data.disponible !== undefined ? data.disponible : true
        });

        const platoGuardado = await plato.save();
        return await Platos.findById(platoGuardado._id).populate('categoria', 'nombre');
    }

    async update(id, data) {
        // CAMBIO: Validar categoría si se está actualizando
        if (data.categoria) {
            const categoriaExistente = await Categoria.findById(data.categoria);
            if (!categoriaExistente) {
                throw new Error('Categoría no encontrada');
            }
        }

        const platoActualizado = await Platos.findByIdAndUpdate(
            id, 
            data, 
            { new: true, runValidators: true }
        ).populate('categoria', 'nombre');

        if (!platoActualizado) {
            throw new Error('Plato no encontrado');
        }

        return platoActualizado;
    }

    async delete(id) {
        const plato = await Platos.findByIdAndDelete(id);
        if (!plato) throw new Error('Plato no encontrado');
        return plato;
    }

    // CAMBIO: Verificar stock mínimo corregido
    async verificarStockMinimo() {
        return await Platos.find({ 
            stock: { $lte: { $expr: '$stockMinimo' } } // CORRECCIÓN: Sintaxis corregida
        }).populate('categoria', 'nombre');
    }

    async toggleEstado(id) {
        const plato = await Platos.findById(id);
        if (!plato) throw new Error('Plato no encontrado');

        plato.estado = plato.estado === 'activo' ? 'inactivo' : 'activo';
        // CAMBIO: Actualizar disponibilidad según estado
        if (plato.estado === 'inactivo') {
            plato.disponible = false;
        }
        
        const platoActualizado = await plato.save();
        return await Platos.findById(platoActualizado._id).populate('categoria', 'nombre');
    }

    // NUEVO: Método para verificar disponibilidad
    async verificarDisponibilidad(id, cantidad = 1) {
        const plato = await Platos.findById(id);
        if (!plato) throw new Error('Plato no encontrado');

        return {
            disponible: plato.disponible && plato.estado === 'activo',
            stock: plato.stock,
            suficiente: plato.stock >= cantidad
        };
    }

    // NUEVO: Método para actualizar stock
    async actualizarStock(id, nuevoStock) {
        const plato = await Platos.findById(id);
        if (!plato) throw new Error('Plato no encontrado');

        plato.stock = nuevoStock;
        plato.disponible = nuevoStock > 0;
        
        return await plato.save();
    }
    
    async desactivarTodosLosPlatos() {
        try {
            const resultado = await Platos.updateMany(
                { estado: 'activo' },
                {
                    $set: {
                        estado: 'inactivo',
                        disponible: false,
                        stock: 0
                    }
                }
            );
            
            console.log(`✅ ${resultado.modifiedCount} platos desactivados y stock puesto en 0`);
            return resultado;
        } catch (error) {
            console.error('❌ Error al desactivar platos:', error);
            throw error;
        }
    }

    iniciarDesactivacionAutomatica() {
        console.log('⏰ Iniciando desactivación automática de platos...');

        // 🔹 DESACTIVACIÓN NOCTURNA: 9:00 PM (21:00)
        cron.schedule('30 21 * * *', async () => {
            await this.ejecutarDesactivacionAutomatica('9:00 PM');
        });

        // 🔹 DESACTIVACIÓN MATUTINA: 6:00 AM 
        cron.schedule('0 6 * * *', async () => {
            await this.ejecutarDesactivacionAutomatica('6:00 AM');
        });

        // 🔹 MODO DESARROLLO: Cada 5 minutos para pruebas
        if (process.env.NODE_ENV === 'development') {
            cron.schedule('*/5 * * * *', async () => {
                console.log('🧪 [DESARROLLO] Verificación de desactivación automática de platos');
                // Opcional: ejecutar en desarrollo
                // await this.ejecutarDesactivacionAutomatica('Prueba Desarrollo');
            });
        }

        console.log('✅ Desactivación automática de platos programada: 9:30 PM , 6:00 AM' );
    }

    async ejecutarDesactivacionAutomatica(hora = 'Manual') {
        try {
            console.log(`🍽️ Iniciando desactivación automática de platos (${hora})...`);
            
            const statsAntes = await this.obtenerEstadisticasPlatos();
            const resultado = await this.desactivarTodosLosPlatos();
            const statsDespues = await this.obtenerEstadisticasPlatos();

            console.log(`✅ Desactivación completada: ${resultado.modifiedCount} platos desactivados`);
            console.log(`📊 Estadísticas - Antes: ${statsAntes.platosActivos} activos, Después: ${statsDespues.platosActivos} activos`);

            return {
                success: true,
                horaEjecucion: hora,
                platosDesactivados: resultado.modifiedCount,
                estadisticas: {
                    antes: statsAntes,
                    despues: statsDespues
                }
            };
        } catch (error) {
            console.error(`❌ Error en desactivación automática (${hora}):`, error.message);
            return {
                success: false,
                horaEjecucion: hora,
                error: error.message
            };
        }
    }

     async obtenerEstadisticasPlatos() {
        const totalPlatos = await Platos.countDocuments();
        const platosActivos = await Platos.countDocuments({ estado: 'activo' });
        const platosInactivos = await Platos.countDocuments({ estado: 'inactivo' });
        const platosDisponibles = await Platos.countDocuments({ disponible: true });
        const platosSinStock = await Platos.countDocuments({ stock: 0 });
        
        return {
            totalPlatos,
            platosActivos,
            platosInactivos,
            platosDisponibles,
            platosSinStock
        };
    }


    async desactivacionManual() {
        return await this.ejecutarDesactivacionAutomatica('Manual');
    }

    // NUEVO: Obtener estado del servicio de desactivación
     getEstadoDesactivacion() {
        return {
            servicioActivo: true,
            horariosProgramados: [
                '0 6 * * *',   // 6:00 AM
                '30 9 * * *' // 9:30 AM
            ],
            horariosLegibles: [
                '6:00 AM - Desactivación matutina',
                '9:30 AM - Desactivación mañana'
            ],
            descripcion: 'Desactivación automática de platos 3 veces al día',
            ultimaEjecucion: new Date()
        };
    }

}

module.exports = PlatoService;