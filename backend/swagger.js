const swaggerAutogen = require('swagger-autogen')();

const doc = {
    info: {
        title: 'API Tienda de Ropa',
        description: 'Documentación de la API para la gestión de productos y contactos.'
    },

    host: 'localhost:3000',
    basePath: '/',
    schemes: ['http', 'https'],

    tags: [
        {
            name: 'Producto',
            description: 'Operaciones relacionadas con los productos.'
        },
        {
            name: 'Contacto',
            description: 'Operaciones relacionadas con los mensajes de contacto.'
        },
        {
            name: 'Usuario',
            description: 'Operaciones relacionadas con los usuarios.'
        }
    ],

    definitions: {

        Producto: {
            nombre: 'Remera Oversize',
            categoria: 'Remeras',
            precio: 25000,
            descuento: 10,
            imagen: 'https://misitio.com/imagenes/remera.jpg',
            descripcion: 'Remera de algodón oversize.',
            material: 'Algodón',
            destacado: true,
            stock: true
        },

        Contacto: {
            nombre: 'Juan Pérez',
            email: 'juan@gmail.com',
            telefono: '3884123456',
            mensaje: 'Quisiera consultar por la disponibilidad de un producto.'
        },

        Usuario: {
            username: 'juanperez',
            password: '123456',
            nombres: 'Juan',
            apellido: 'Pérez',
            perfil: 'administrador'
        },

        Login: {
            username: 'juanperez',
            password: '123456'
        }
    }
};

const outputFile = './swagger_output.json';
const endpointsFiles = ['./index.js'];

swaggerAutogen(outputFile, endpointsFiles, doc).then(() => {
    console.log(`Documentación generada en ${outputFile}`);
    // require('./index.js');
});