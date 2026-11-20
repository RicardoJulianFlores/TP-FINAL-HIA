const sequelize = require("../../config/database");
const Detalle = require("../models/detalle.model");
const PagoMercadoPago = require("../models/pago.models");
const Pedido = require("../models/pedido.models");
const Producto = require("../models/producto.model");
const estadisticaCtrl = {};

estadisticaCtrl.getVentasPorCategoria = async (req, res) => {
    try {
        const datos = await Detalle.findAll({
            attributes: [
                // Sumamos la cantidad de productos vendidos en total por categoría
                [sequelize.fn('SUM', sequelize.col('cantidad')), 'total_vendido'],
                // Traemos el nombre de la categoría
                [sequelize.col('Producto.categoria'), 'categoria']
            ],
            include: [{
                model: Producto,
                attributes: [], // No queremos campos sueltos del producto, solo la relación
            }],
            // Agrupamos para que el SUM funcione por grupo
            group: [
                sequelize.col('Producto.categoria')
            ],
            raw: true // Esto nos devuelve un JSON plano y limpio, ideal para el frontend
        });

        res.json(datos);
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error en el servidor al compilar los datos.'
        });
    }
};

estadisticaCtrl.getIngresosPorFecha = async (req, res) => {
    try {
        const ingresos = await Pedido.findAll({
            attributes: [
                [sequelize.fn('DATE', sequelize.col('fecha')), 'fecha_dia'],
                // Sumamos el total recaudado ese día
                [sequelize.fn('SUM', sequelize.col('total')), 'total_ingresos']
            ],
            include: [{
                model: PagoMercadoPago,
                where: {
                    estado_pago: 'APROBADO'
                },
                attributes: []
            }],
            group: [sequelize.fn('DATE', sequelize.col('fecha'))],
            order: [[sequelize.fn('DATE', sequelize.col('fecha')), 'ASC']],
            raw: true
        });

        res.json(ingresos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ ok: false, msg: 'Error al obtener ingresos por fecha' });
    }
};

estadisticaCtrl.getTotalVentas = async (req, res) => {
    try {
        const total = await Pedido.sum("total", {
            include: [{
                model: PagoMercadoPago,
                attributes: [],
                where: {
                    estado_pago: "APROBADO"
                }
            }]
        });
        res.json({
            total
        });
    } catch (error) {
        console.error("Error en getTotalVentas:", error);
        res.status(500).json({
            mensaje: error.message
        });
    }
};

estadisticaCtrl.getPedidosPendientes = async (req, res) => {
    try {
        const cantidad = await Pedido.count({
            where: {
                estado_envio: 'Pendiente'
            }
        });
        res.json({
            cantidad
        });
    } catch (error) {
        res.status(500).json(error);
    }
};

estadisticaCtrl.getProductosSinStock = async (req, res) => {
    try {
        const cantidad = await Producto.count({
            where: {
                stock: 0
            }
        });
        res.json({
            cantidad
        });
    } catch (error) {
        res.status(500).json(error);
    }
};

estadisticaCtrl.getProductosMasVendidos = async (req, res) => {
    try {
        const datos = await Detalle.findAll({
            attributes: [
                [sequelize.col('Producto.nombre'), 'producto'],
                [sequelize.fn('SUM', sequelize.col('cantidad')), 'vendidos']
            ],
            include: [{
                model: Producto,
                attributes: []
            }],
            group: [
                sequelize.col('Producto.id'),
                sequelize.col('Producto.nombre')
            ],
            order: [
                [sequelize.literal('vendidos'), 'DESC']
            ],
            limit: 5,
            raw: true
        });
        res.json(datos);
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error en el servidor al compilar los datos.'
        });
    }
};

module.exports = estadisticaCtrl;