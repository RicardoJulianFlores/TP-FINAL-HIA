const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const Contacto = sequelize.define('Contacto', {
    
    nombre: { type: DataTypes.STRING, allowNull: false },

    email: { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },

    telefono: { type: DataTypes.STRING, allowNull: true },

    mensaje: { type: DataTypes.TEXT, allowNull: false }

}, {
    tableName: 'contactos', // Nombre de la tabla en minúsculas y plural
    timestamps: true, // Crea automáticamente los campos createdAt y updatedAt
});

module.exports = Contacto;
