const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// 1. Importamos Mercado Pago
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 5000;

// 2. Configurar Mercado Pago con tu Access Token
// REEMPLAZA ESTO CON TU ACCESS TOKEN REAL DE PRODUCCIÓN o usa una variable de entorno (.env)
const client = new MercadoPagoConfig({ 
    accessToken: 'APP_USR-4141284821887377-061814-56c9600e7a237642acc3dd8a1e46fba4-751607359' 
});

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Conexión a MongoDB Atlas
mongoose.connect('mongodb+srv://yuriangelperezedu_db_user:vVs9x7ZbJ2znTaaQ@cluster0.qfrevux.mongodb.net/saborysazon?appName=Cluster0')
.then(() => console.log('Conectado exitosamente a MongoDB Atlas'))
.catch(err => console.error('Error al conectar a la base de datos:', err));

// Esquema de Pedido
const PedidoSchema = new mongoose.Schema({
    cliente: { nombre: String, telefono: String, direccion: String },
    items: [{ producto: String, cantidad: Number, precio: Number }],
    tipoEntrega: { type: String, default: 'retiro' },
    costoEnvio: { type: Number, default: 0 },
    total: Number,
    estado: { type: String, default: 'Pendiente' },
    payment_status: { type: String, default: 'pending' }, // Control de pago
    fecha: { type: Date, default: Date.now }
});
const Pedido = mongoose.model('Pedido', PedidoSchema);

app.get('/', (req, res) => {
    res.status(200).json({ success: true, message: "¡Servidor de Sabor & Sazón en línea!" });
});

// 3. RUTA POST ACTUALIZADA: Guarda el pedido y genera el link de Mercado Pago
app.post('/api/pedidos', async (req, res) => {
    try {
        // Guardamos primero en la base de datos
        const nuevoPedido = new Pedido(req.body);
        await nuevoPedido.save();

        // Estructuramos los items para Mercado Pago a partir del carrito recibido
        const itemsMP = req.body.items.map(item => ({
            title: item.producto,
            quantity: Number(item.cantidad),
            unit_price: Number(item.precio),
            currency_id: 'ARS'
        }));

        // Si hay costo de envío, lo sumamos como un ítem para que se cobre
        if (req.body.costoEnvio > 0) {
            itemsMP.push({
                title: '🛵 Costo de Envío',
                quantity: 1,
                unit_price: Number(req.body.costoEnvio),
                currency_id: 'ARS'
            });
        }

        // Creamos la preferencia de Mercado Pago
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: itemsMP,
                back_urls: {
                    // Links a donde vuelve el cliente tras pagar (pueden ser tu misma web de Vercel)
                    success: 'https://web-sabor-sazon.vercel.app/?status=success',
                    failure: 'https://web-sabor-sazon.vercel.app/?status=failure',
                    pending: 'https://web-sabor-sazon.vercel.app/?status=pending'
                },
                auto_return: 'approved', // Redirección automática al finalizar el pago exitoso
                external_reference: nuevoPedido._id.toString() // Asociamos el ID del pedido de Mongo
            }
        });

        // Devolvemos el ID de pedido y el link de pago (init_point) al frontend
        res.status(201).json({ 
            success: true, 
            pedidoId: nuevoPedido._id, 
            initPoint: result.init_point // URL de la pasarela de Mercado Pago
        });

    } catch (error) {
        console.error("Error al crear preferencia:", error);
        res.status(500).json({ success: false, message: 'Error al procesar el pedido', error: error.message });
    }
});

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));