const Producto = require('../models/producto.model');
const productoCtrl = {};

// Recuperar todos
productoCtrl.getProductos = async (req, res) => {
    /*
    #swagger.tags = ['Producto']
    #swagger.summary = 'Obtener todos los productos'
    */
    try {
        const productos = await Producto.findAll();
        res.json(productos);
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener los Productos.' });
    }
};

//get Productos destacados
productoCtrl.getDestacados = async (req, res) => {
    /*
    #swagger.tags = ['Producto']
    #swagger.summary = 'Obtener productos destacados'
    */
    try {
        const productos = await Producto.findAll({
            where: {
                destacado: true
            }
        });

        res.json(productos);
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener los Productos.' });
    }
};

//get por categoria
productoCtrl.getProductosPorCategoria = async (req, res) => {
    /*
    #swagger.tags = ['Producto']
    #swagger.summary = 'Obtener productos por categoría'
    #swagger.parameters['categoria'] = {
        in: 'path',
        required: true,
        type: 'string'
    }
    */
    try {
        const productos = await Producto.findAll({
            where: {
                categoria: req.params.categoria
            }
        });

        res.json(productos);
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener los Productos.' });
    }
};

// getProductoPorId
productoCtrl.getProductoPorId = async (req, res) => {
    /*
    #swagger.tags = ['Producto']
    #swagger.summary = 'Obtener producto por ID'
    #swagger.parameters['id'] = {
        in: 'path',
        required: true,
        type: 'integer'
    }
    */
    try {
        const productos = await Producto.findOne({
            where: {
                id: req.params.id
            }
        });

        res.json(productos);
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al obtener los Productos.' });
    }
};

//CREAR
productoCtrl.crearProducto = async (req, res) => {
    /*
    #swagger.tags = ['Producto']
    #swagger.summary = 'Crear un producto'
    #swagger.parameters['body'] = {
        in: 'body',
        required: true,
        schema: { $ref: '#/definitions/Producto' }
    }
    */
    try {
        await Producto.create(req.body);

        res.json({ status: '1', msg: 'producto Guardado.' });
    } catch (error) {
        res.status(500).json({ status: '0', msg: 'Error al agregar.' });
    }
};

//MODIFICAR
productoCtrl.modificarProducto = async (req, res) => {
    /*
    #swagger.tags = ['Producto']
    #swagger.summary = 'Modificar un Producto'
    #swagger.parameters['id'] = {
        in: 'path',
        required: true,
        type: 'integer'
    }
    #swagger.parameters['body'] = {
        in: 'body',
        required: true,
        schema: { $ref: '#/definitions/Producto' }
    }
    */
    const data = req.body;
    try {
        const producto = await Producto.findByPk(req.params.id);
        if (producto) {
            await producto.update(data);
            res.status(200).json({ status: '1', msg: 'Producto actualizado' });
        } else {
            res.status(404).json({ status: '0', msg: 'Producto no encontrado' });
        }
    }
    catch (error) {
        res.status(500).json({ message: 'Error al actualiza Producto', error: error.message });
    }
}

//DELETE
productoCtrl.deleteProducto = async (req, res) => {
    /*
    #swagger.tags = ['Producto']
    #swagger.summary = 'Eliminar un Producto'
    #swagger.parameters['id'] = {
        in: 'path',
        required: true,
        type: 'integer'
    }
    */
    try {
        // .destroy() elimina el registro que coincida con el ID enviado por parámetro
        await Producto.destroy({
            where: { id: req.params.id }
        });
        res.json({ status: '1', msg: 'Producto removed' });
    } catch (error) {
        res.status(400).json({ status: '0', msg: 'Error procesando la operacion' });
    }
};



module.exports = productoCtrl;