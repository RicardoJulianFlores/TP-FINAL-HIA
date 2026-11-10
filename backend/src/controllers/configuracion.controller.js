const Configuracion = require("../models/configuracion.model");

const configuracionCtrl = {};

// Obtener la configuración
configuracionCtrl.getConfiguracion = async (req, res) => {
    try {
        let configuracion = await Configuracion.findByPk(1);
        // Si todavía no existe, la crea con los valores por defecto
        if (!configuracion) {
            configuracion = await Configuracion.create({
                id: 1
            });
        }
        res.json(configuracion);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 0,
            msg: "Error al obtener la configuración"
        });
    }
};

// Actualizar la configuración
configuracionCtrl.updateConfiguracion = async (req, res) => {
    try {
        let configuracion = await Configuracion.findByPk(1);
        if (!configuracion) {
            configuracion = await Configuracion.create({
                id: 1
            });
        }
        await configuracion.update(req.body);
        res.json({
            status: 1,
            msg: "Configuración actualizada correctamente",
            data: configuracion
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: 0,
            msg: "Error al actualizar la configuración"
        });
    }
};

module.exports = configuracionCtrl;