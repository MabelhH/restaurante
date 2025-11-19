// controllers/platosController.js
const PlatoService = require('../services/platosService');
const platoService = new PlatoService();

class PlatoController {
    async listar(req, res) {
        try {
            const platos = await platoService.getAll();
            res.json(platos);
        } catch (error) {
            res.status(500).json({ message: 'Error al listar platos', error });
        }
    }

    async obtener(req, res) {
        try {
            const plato = await platoService.getById(req.params.id);
            res.json(plato);
        } catch (error) {
            res.status(500).json({ message: 'Error al obtener plato', error });
        }
    }

    async crear(req, res) {
        try {
            console.log('req.body:', req.body);
            console.log('req.file:', req.file);

            const data = req.body;

            if (data.imagenUrl && data.imagenUrl.trim() !== '') {
                data.imagen = data.imagenUrl;
            } else if (req.file) {
                data.imagen = '/uploads/' + req.file.filename;
            } else {
                data.imagen = '';
            }

            const nuevo = await platoService.create(data);
            res.json(nuevo);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error al crear plato', error });
        }
    }

    async actualizar(req, res) {
        try {
            const data = req.body;

            const platoExistente = await platoService.getById(req.params.id);
            if (!platoExistente) return res.status(404).json({ message: 'Plato no encontrado' });

            // Si subieron archivo con Multer
            if (req.file) {
                data.imagen = '/uploads/' + req.file.filename;
            }
            // Si enviaron imagenUrl en el body
            else if (data.imagenUrl) {
                data.imagen = data.imagenUrl;
            }
            // Si no enviaron nada, mantenemos la anterior
            else {
                data.imagen = platoExistente.imagen;
            }

            const actualizado = await platoService.update(req.params.id, data);
            res.json(actualizado);

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error al actualizar plato', error });
        }
    }

    async eliminar(req, res) {
        try {
            await platoService.delete(req.params.id);
            res.json({ mensaje: 'Plato eliminado correctamente' });
        } catch (error) {
            res.status(500).json({ message: 'Error al eliminar plato', error });
        }
    }

    async verificarStock(req, res) {
        try {
            const alertas = await platoService.verificarStockMinimo();
            res.json(alertas);
        } catch (error) {
            res.status(500).json({ message: 'Error al verificar stock', error });
        }
    }

    async cambiarEstado(req, res) {
        try {
            const actualizado = await platoService.toggleEstado(req.params.id);
            res.json(actualizado);
        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Error al cambiar estado del plato', error });
        }
    }

    // Nuevo método para verificar disponibilidad
    async verificarDisponibilidad(req, res) {
        try {
            const { id } = req.params;
            const { cantidad } = req.body;

            const disponible = await platoService.verificarDisponibilidad(id, cantidad);
            res.json({ disponible });
        } catch (error) {
            res.status(500).json({ message: 'Error al verificar disponibilidad', error });
        }
    }

    // Nuevo método para reducir stock
    async reducirStock(req, res) {
        try {
            const { id } = req.params;
            const { cantidad } = req.body;

            const plato = await platoService.reducirStock(id, cantidad);
            res.json(plato);
        } catch (error) {
            res.status(500).json({ message: 'Error al reducir stock', error });
        }
    }

    // Nuevo método para aumentar stock
    async aumentarStock(req, res) {
        try {
            const { id } = req.params;
            const { cantidad } = req.body;

            const plato = await platoService.aumentarStock(id, cantidad);
            res.json(plato);
        } catch (error) {
            res.status(500).json({ message: 'Error al aumentar stock', error });
        }
    }

    async desactivarTodos(req, res) {
        try {
            const resultado = await platoService.desactivarTodosLosPlatos();
            res.json({
                success: true,
                message: `${resultado.modifiedCount} platos desactivados y stock puesto en 0`,
                platosDesactivados: resultado.modifiedCount
            });
        } catch (error) {
            res.status(500).json({ 
                success: false,
                message: 'Error al desactivar platos', 
                error: error.message 
            });
        }
    }

}

module.exports = new PlatoController();