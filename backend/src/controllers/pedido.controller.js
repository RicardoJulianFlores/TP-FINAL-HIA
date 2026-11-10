const sequelize = require('../../config/database');
const Pedido = require('../models/pedido.models');
const Detalle = require('../models/detalle.model');
const Usuario = require('../models/usuario.models');
const Producto = require('../models/producto.model');

const pedidoCtrl = {};

pedidoCtrl.crearPedido = async (req, res) => {
    const { usuarioId, items, id_mercado_pago } = req.body;
    const t = await sequelize.transaction();
    try {
        const total = items.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0);

        const pedido = await Pedido.create({
            usuarioId,
            total,
            id_mercado_pago
        }, { transaction: t });

        const detalles = items.map(i => ({
            pedidoId: pedido.id,
            productoId: i.productoId,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario
        }));

        await Detalle.bulkCreate(detalles, { transaction: t });

        await t.commit();
        res.status(201).json({ status: '1', pedidoId: pedido.id });
    } catch (error) {
        console.error(error);
        await t.rollback();
        res.status(500).json({ status: '0', msg: 'Error al crear el pedido' });
    }
};

pedidoCtrl.getPedidos = async (req, res) => {
    try {
        const pedidos = await Pedido.findAll({
            include: [
                {
                    model: Usuario,
                    attributes: ['id', 'nombres', 'apellido']
                },
                {
                    model: Detalle,
                    as: 'detalles',
                    include: [
                        {
                            model: Producto,
                            attributes: ['nombre', 'precio']
                        }
                    ]
                }
            ],
            order: [['fecha', 'DESC']]
        });
        res.json(pedidos);
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: '0', msg: 'Error al obtener pedidos' });
    }
};

pedidoCtrl.getPedidoPorId = async (req, res) => {
    try {
        const pedido = await Pedido.findByPk(req.params.id, { include: { model: Detalle, as: 'detalles' } });
        res.json(pedido);
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener el pedido' });
    }
};

pedidoCtrl.actualizarEstado = async (req, res) => {
    try {
        const pedido = await Pedido.findByPk(req.params.id);
        if (!pedido) return res.status(404).json({ status: '0', msg: 'Pedido no encontrado' });
        await pedido.update({ estado_envio: req.body.estado_envio });
        res.json({ status: '1', msg: 'Estado actualizado' });
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al actualizar estado' });
    }
};

module.exports = pedidoCtrl;