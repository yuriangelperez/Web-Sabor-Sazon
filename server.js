const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();
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
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'sabor123';
const ADMIN_TOKEN_TTL_MS = 1000 * 60 * 60 * 12;
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || 'sabor-sazon-admin-secret';

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

const AdminUserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    salt: { type: String, required: true },
    creadoEn: { type: Date, default: Date.now }
});
const AdminUser = mongoose.model('AdminUser', AdminUserSchema);

const EstadoLocalSchema = new mongoose.Schema({
    key: { type: String, unique: true },
    abierto: { type: Boolean, default: true },
    actualizadoEn: { type: Date, default: Date.now }
});
const EstadoLocal = mongoose.model('EstadoLocal', EstadoLocalSchema);

async function obtenerEstadoLocal() {
    let estado = await EstadoLocal.findOne({ key: 'main' });
    if (!estado) {
        estado = await EstadoLocal.create({ key: 'main', abierto: true });
    }
    return estado;
}

function authAdmin(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
    }

    const payload = verificarTokenAdmin(token);
    if (!payload) {
        return res.status(401).json({ success: false, message: 'Sesión vencida o inválida' });
    }

    req.admin = { username: payload.u };
    next();
}

function toBase64Url(input) {
    return Buffer.from(input).toString('base64url');
}

function fromBase64Url(input) {
    return Buffer.from(input, 'base64url').toString('utf8');
}

function firmarTokenAdmin(payload) {
    const payloadEncoded = toBase64Url(JSON.stringify(payload));
    const signature = crypto
        .createHmac('sha256', ADMIN_TOKEN_SECRET)
        .update(payloadEncoded)
        .digest('base64url');
    return `${payloadEncoded}.${signature}`;
}

function verificarTokenAdmin(token) {
    try {
        const [payloadEncoded, signature] = String(token).split('.');
        if (!payloadEncoded || !signature) return null;

        const expectedSig = crypto
            .createHmac('sha256', ADMIN_TOKEN_SECRET)
            .update(payloadEncoded)
            .digest('base64url');

        const a = Buffer.from(signature);
        const b = Buffer.from(expectedSig);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

        const payload = JSON.parse(fromBase64Url(payloadEncoded));
        if (!payload || !payload.u || !payload.exp || Date.now() > payload.exp) return null;

        return payload;
    } catch {
        return null;
    }
}

function normalizarUsuario(username = '') {
    return String(username).trim().toLowerCase();
}

function generarHashPassword(password, salt = null) {
    const saltFinal = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, saltFinal, 64).toString('hex');
    return { salt: saltFinal, hash };
}

function validarPassword(password, hashEsperado, salt) {
    const { hash } = generarHashPassword(password, salt);
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(hashEsperado, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

app.get('/', (req, res) => {
    res.status(200).json({ success: true, message: "¡Servidor de Sabor & Sazón en línea!" });
});

app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body || {};
    const usernameNorm = normalizarUsuario(username);

    try {
        const user = await AdminUser.findOne({ username: usernameNorm });
        let credencialesValidas = false;

        if (user) {
            credencialesValidas = validarPassword(password || '', user.passwordHash, user.salt);
        } else {
            credencialesValidas = username === ADMIN_USER && password === ADMIN_PASS;
        }

        if (!credencialesValidas) {
            return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
        }

        const token = firmarTokenAdmin({
            u: usernameNorm || username,
            exp: Date.now() + ADMIN_TOKEN_TTL_MS
        });

        return res.status(200).json({ success: true, token });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'No se pudo iniciar sesión' });
    }
});

app.post('/api/admin/usuarios', authAdmin, async (req, res) => {
    try {
        const usernameNorm = normalizarUsuario(req.body?.username);
        const password = String(req.body?.password || '');

        if (!/^[a-z0-9._-]{4,30}$/.test(usernameNorm)) {
            return res.status(400).json({
                success: false,
                message: 'Usuario inválido. Usa 4-30 caracteres: letras, números, punto, guion o guion bajo.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
        }

        const existe = await AdminUser.findOne({ username: usernameNorm });
        if (existe) {
            return res.status(409).json({ success: false, message: 'Ese usuario ya existe.' });
        }

        const { salt, hash } = generarHashPassword(password);
        await AdminUser.create({ username: usernameNorm, passwordHash: hash, salt });

        return res.status(201).json({ success: true, message: 'Usuario admin creado correctamente.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'No se pudo crear el usuario admin.' });
    }
});

app.get('/api/estado-local', async (req, res) => {
    try {
        const estado = await obtenerEstadoLocal();
        res.status(200).json({ success: true, abierto: estado.abierto, actualizadoEn: estado.actualizadoEn });
    } catch (error) {
        res.status(500).json({ success: false, message: 'No se pudo obtener el estado del local' });
    }
});

app.put('/api/admin/estado-local', authAdmin, async (req, res) => {
    try {
        const { abierto } = req.body || {};
        if (typeof abierto !== 'boolean') {
            return res.status(400).json({ success: false, message: 'El campo abierto debe ser booleano' });
        }

        const estado = await EstadoLocal.findOneAndUpdate(
            { key: 'main' },
            { $set: { abierto, actualizadoEn: new Date() } },
            { new: true, upsert: true }
        );

        res.status(200).json({ success: true, abierto: estado.abierto, actualizadoEn: estado.actualizadoEn });
    } catch (error) {
        res.status(500).json({ success: false, message: 'No se pudo actualizar el estado del local' });
    }
});

app.get('/api/admin/pedidos', authAdmin, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
        const { fechaDesde, fechaHasta } = req.query;

        const filtros = {};
        if (fechaDesde || fechaHasta) {
            filtros.fecha = {};

            if (fechaDesde) {
                const desde = new Date(fechaDesde);
                if (!Number.isNaN(desde.getTime())) {
                    filtros.fecha.$gte = desde;
                }
            }

            if (fechaHasta) {
                const hasta = new Date(fechaHasta);
                if (!Number.isNaN(hasta.getTime())) {
                    filtros.fecha.$lte = hasta;
                }
            }

            if (Object.keys(filtros.fecha).length === 0) {
                delete filtros.fecha;
            }
        }

        const pedidos = await Pedido.find(filtros).sort({ fecha: -1 }).limit(limit);
        res.status(200).json({ success: true, pedidos });
    } catch (error) {
        res.status(500).json({ success: false, message: 'No se pudieron obtener los pedidos' });
    }
});

app.delete('/api/admin/pedidos/:id', authAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const eliminado = await Pedido.findByIdAndDelete(id);

        if (!eliminado) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
        }

        return res.status(200).json({ success: true, message: 'Pedido eliminado correctamente.' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'No se pudo eliminar el pedido.' });
    }
});

app.delete('/api/admin/pedidos', authAdmin, async (req, res) => {
    try {
        const { fechaDesde, fechaHasta, todos } = req.query;

        const filtros = {};
        if (todos !== 'true') {
            if (!fechaDesde && !fechaHasta) {
                return res.status(400).json({
                    success: false,
                    message: 'Para borrar pedidos debés indicar un rango de fechas o usar todos=true.'
                });
            }

            filtros.fecha = {};
            if (fechaDesde) {
                const desde = new Date(fechaDesde);
                if (!Number.isNaN(desde.getTime())) filtros.fecha.$gte = desde;
            }
            if (fechaHasta) {
                const hasta = new Date(fechaHasta);
                if (!Number.isNaN(hasta.getTime())) filtros.fecha.$lte = hasta;
            }

            if (Object.keys(filtros.fecha).length === 0) {
                delete filtros.fecha;
            }
        }

        const resultado = await Pedido.deleteMany(filtros);
        return res.status(200).json({
            success: true,
            message: `Se eliminaron ${resultado.deletedCount} pedido(s).`,
            deletedCount: resultado.deletedCount
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'No se pudieron borrar los pedidos.' });
    }
});

app.put('/api/admin/pedidos/:id/estado', authAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const estadoRaw = String(req.body?.estado || '').trim();
        const estadoNormalizado = estadoRaw.toLowerCase();

        const estadosPermitidos = {
            pendiente: 'Pendiente',
            hecho: 'Hecho',
            cancelado: 'Cancelado'
        };

        if (!estadosPermitidos[estadoNormalizado]) {
            return res.status(400).json({
                success: false,
                message: 'Estado inválido. Usa Pendiente, Hecho o Cancelado.'
            });
        }

        const pedido = await Pedido.findByIdAndUpdate(
            id,
            { $set: { estado: estadosPermitidos[estadoNormalizado] } },
            { new: true }
        );

        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
        }

        return res.status(200).json({
            success: true,
            message: `Estado actualizado a ${pedido.estado}.`,
            pedido
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'No se pudo actualizar el estado del pedido.' });
    }
});

// 3. RUTA POST ACTUALIZADA: Guarda el pedido y genera el link de Mercado Pago
app.post('/api/pedidos', async (req, res) => {
    try {
        const estadoLocal = await obtenerEstadoLocal();
        if (!estadoLocal.abierto) {
            return res.status(403).json({
                success: false,
                code: 'LOCAL_CERRADO',
                message: 'El local se encuentra cerrado. No se aceptan pedidos en este momento.'
            });
        }

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