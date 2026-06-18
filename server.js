const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json()); // Para poder leer formato JSON en las peticiones

// Conexión a la Base de Datos limpia (Para versiones modernas de Mongoose)
mongoose.connect('mongodb+srv://yuriangelperezedu_db_user:vVs9x7ZbJ2znTaaQ@cluster0.qfrevux.mongodb.net/saborysazon?appName=Cluster0')
.then(() => console.log('Conectado exitosamente a MongoDB Atlas'))
.catch(err => console.error('Error al conectar a la base de datos:', err));

// Esquema de Pedido para MongoDB
const PedidoSchema = new mongoose.Schema({
    cliente: {
        nombre: String,
        telefono: String,
        direccion: String
    },
    items: [{
        producto: String,
        cantidad: Number,
        precio: Number
    }],
    total: Number,
    estado: { type: String, default: 'Pendiente' },
    fecha: { type: Date, default: Date.now }
});

const Pedido = mongoose.model('Pedido', PedidoSchema);

// RUTAS (API ENDPOINTS)

// 1. Recibir y guardar un nuevo pedido desde el Frontend
app.post('/api/pedidos', async (req, res) => {
    try {
        const nuevoPedido = new Pedido(req.body);
        await nuevoPedido.save();
        res.status(201).json({ success: true, message: 'Pedido registrado con éxito', pedidoId: nuevoPedido._id });
    } catch (error) {
        // Al agregar error.message vas a poder ver en la respuesta exactamente qué falló (ej: si faltó un campo obligatorio)
        res.status(500).json({ success: false, message: 'Error al procesar el pedido', error: error.message });
    }
});

// 2. Obtener la lista de todos los pedidos (para tu panel de administración)
app.get('/api/pedidos', async (req, res) => {
    try {
        const listaPedidos = await Pedido.find().sort({ fecha: -1 });
        res.status(200).json(listaPedidos);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener pedidos', error });
    }
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor de Sabor & Sazón corriendo en el puerto ${PORT}`);
});