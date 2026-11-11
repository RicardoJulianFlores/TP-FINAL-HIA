const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Pedido = require('../models/pedido.models');

const Detalle = sequelize.define('Detalle', {
    
    cantidad: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } },

    precio_unitario: { type: DataTypes.DECIMAL(10, 2), allowNull: false } // Histórico al momento de comprar

}, { 
    tableName: 'detalles', 
    timestamps: false 
});

Pedido.hasMany(Detalle, { foreignKey: 'pedidoId', as: 'detalles' });
Detalle.belongsTo(Pedido, { foreignKey: 'pedidoId' });

module.exports = Detalle;