const Contacto = require('../models/contacto.model');
const contactoCtrl = {};

// Dar de alta
contactoCtrl.crearContacto = async (req, res) => {
    /*
    #swagger.tags = ['Contacto']
    #swagger.summary = 'Crear un mensaje de contacto'
    #swagger.parameters['body'] = {
        in: 'body',
        required: true,
        schema: { $ref: '#/definitions/Contacto' }
    }
    */
    try {
    // Sequelize usa .create() para instanciar y guardar en un solo paso
        await Contacto.create(req.body);
        res.json({ status: '1', msg: 'MensajeContacto Guardado.' });
    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando operacion.' });
    }
};

//mostrar todos
contactoCtrl.getContactos = async (req, res) => {
    /*
    #swagger.tags = ['Contacto']
    #swagger.summary = 'Obtener todos los contactos'
    */
    try {
        const contactos = await Contacto.findAll();
        res.json(contactos);
    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error al obtener Contactos.' });
    }
};


module.exports = contactoCtrl;