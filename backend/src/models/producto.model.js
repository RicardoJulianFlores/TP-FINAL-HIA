const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Detalle = require('../models/detalle.model');

const Producto = sequelize.define('Producto', {

    nombre: { type: DataTypes.STRING, allowNull: false },

    categoria: { type: DataTypes.STRING, allowNull: false },

    precio: { type: DataTypes.FLOAT, allowNull: false },

    descuento: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 0 },

    imagen: { type: DataTypes.STRING, allowNull: false },

    descripcion: { type: DataTypes.TEXT, allowNull: true },

    material: { type: DataTypes.STRING, allowNull: true },

    destacado: { type: DataTypes.BOOLEAN, allowNull: false},

    stock: { type: DataTypes.INTEGER, allowNull: false }
    
}, {
    tableName: 'productos', // Nombre de la tabla en minúsculas y plural
    timestamps: true, // Crea automáticamente los campos createdAt y updatedAt
});

Producto.hasMany(Detalle, { foreignKey: 'productoId' });
Detalle.belongsTo(Producto, { foreignKey: 'productoId' });

module.exports = Producto;
