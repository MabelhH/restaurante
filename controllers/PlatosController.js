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
            const nuevo = await platoService.create(req.body);
            res.json(nuevo);
        } catch (error) {
            res.status(500).json({ message: 'Error al crear plato', error });
        }
    }

    async actualizar(req, res) {
        try {
            const actualizado = await platoService.update(req.params.id, req.body);
            res.json(actualizado);
        } catch (error) {
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
}

module.exports = new PlatoController();