const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware - CORS totalmente abierto para que Vercel conecte sin trabas
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json()); // Habilita la lectura de JSON

// Conexión a tu Base de Datos limpia en MongoDB Atlas
mongoose.connect('mongodb+srv://yuriangelperezedu_db_user:vVs9x7ZbJ2znTaaQ@cluster0.qfrevux.mongodb.net/saborysazon?appName=Cluster0')
.then(() => console.log('Conectado exitosamente a MongoDB Atlas'))
.catch(err => console.error('Error al conectar a la base de datos:', err));

// --- ESQUEMA ACTUALIZADO (Soporta tipoEntrega, costoEnvio y gustos) ---
const PedidoSchema = new mongoose.Schema({
    cliente: {
        nombre: String,
        telefono: String,
        direccion: { type: String, default: "" }
    },
    items: { type: Array, default: [] }, // Al definirlo como Array genérico, guarda gustos y subtotales sin chocar
    tipoEntrega: { type: String, default: 'retiro' },
    costoEnvio: { type: Number, default: 0 },
    total: Number,
    estado: { type: String, default: 'Pendiente' },
    fecha: { type: Date, default: Date.now }
});

const Pedido = mongoose.model('Pedido', PedidoSchema);

// --- SOLUCIÓN AL "CANNOT GET /" ---
// Esto le da una respuesta amigable a la raíz del servidor
app.get('/', (req, res) => {
    res.status(200).json({ success: true, message: "¡Servidor de Sabor & Sazón en línea y funcionando!" });
});

// 1. Recibir y guardar un nuevo pedido desde el Frontend
app.post('/api/pedidos', async (req, res) => {
    try {
        console.log("Datos recibidos en el backend:", req.body); // Ver los datos en los logs de Render
        const nuevoPedido = new Pedido(req.body);
        await nuevoPedido.save();
        res.status(201).json({ success: true, message: 'Pedido registrado con éxito', pedidoId: nuevoPedido._id });
    } catch (error) {
        console.error("Error crítico de Mongoose al guardar:", error); // Esto saldrá en letras rojas en Render
        res.status(500).json({ success: false, message: 'Error al procesar el pedido', error: error.message });
    }
});

// 2. Obtener la lista de todos los pedidos (para tu panel)
app.get('/api/pedidos', async (req, res) => {
    try {
        const listaPedidos = await Pedido.find().sort({ fecha: -1 });
        res.status(200).json(listaPedidos);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener pedidos', error: error.message });
    }
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor de Sabor & Sazón corriendo en el puerto ${PORT}`);
});