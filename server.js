const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
// 1. Importamos Mercado Pago
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 5000;
const MERCADOPAGO_ACCESS_TOKEN = String(
    process.env.MERCADOPAGO_ACCESS_TOKEN
    || process.env.MERCADO_PAGO_ACCESS_TOKEN
    || process.env.MP_ACCESS_TOKEN
    || process.env.ACCESS_TOKEN
    || ''
).trim();

// 2. Configurar Mercado Pago desde variables de entorno.
// Usa MERCADOPAGO_ACCESS_TOKEN en tu entorno local o en Render.
const client = MERCADOPAGO_ACCESS_TOKEN
    ? new MercadoPagoConfig({ accessToken: MERCADOPAGO_ACCESS_TOKEN })
    : null;

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
    items: [{
        producto: String,
        cantidad: Number,
        precio: Number,
        gustos: [{
            componente: String,
            sabor: String
        }],
        tipoArepa: String
    }],
    tipoEntrega: { type: String, default: 'retiro' },
    metodoPago: { type: String, default: 'mercadopago' },
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
const PrecioProductoSchema = new mongoose.Schema({
    producto: { type: String, required: true, unique: true },
    precio: { type: Number, required: true },
    actualizadoEn: { type: Date, default: Date.now }
});
const PrecioProducto = mongoose.model('PrecioProducto', PrecioProductoSchema);
const PrecioEnvioSchema = new mongoose.Schema({
    zona: { type: String, required: true, unique: true },
    precio: { type: Number, required: true },
    actualizadoEn: { type: Date, default: Date.now }
});
const PrecioEnvio = mongoose.model('PrecioEnvio', PrecioEnvioSchema);
const DisponibilidadSchema = new mongoose.Schema({
    tipo: { type: String, enum: ['producto', 'relleno'], required: true },
    nombre: { type: String, required: true },
    habilitado: { type: Boolean, default: true },
    actualizadoEn: { type: Date, default: Date.now }
});
DisponibilidadSchema.index({ tipo: 1, nombre: 1 }, { unique: true });
const Disponibilidad = mongoose.model('Disponibilidad', DisponibilidadSchema);
const clientesSSEPedidos = new Set();
const RELLENOS_PREMIUM_BASE = ['Catira', 'Pelua', 'Pabellon'];

function obtenerCatalogoPreciosBase() {
    try {
        const indexPath = path.join(__dirname, 'index.html');
        const contenido = fs.readFileSync(indexPath, 'utf8');
        const regex = /data-producto="([^"]+)"\s+data-precio="(\d+)"/g;
        const vistos = new Set();
        const productos = [];

        let match;
        while ((match = regex.exec(contenido)) !== null) {
            const producto = String(match[1] || '').trim();
            const precio = Number(match[2]);

            if (!producto || Number.isNaN(precio) || vistos.has(producto)) continue;

            vistos.add(producto);
            productos.push({ producto, precio });
        }

        return productos;
    } catch {
        return [];
    }
}

function obtenerRellenosBase() {
    try {
        const indexPath = path.join(__dirname, 'index.html');
        const contenido = fs.readFileSync(indexPath, 'utf8');
        const regex = /<option\s+value="([^"]+)"/g;
        const excluir = new Set(['asada', 'frita', '']);
        const rellenos = new Set();

        let match;
        while ((match = regex.exec(contenido)) !== null) {
            const valor = String(match[1] || '').trim();
            const normalizado = valor.toLowerCase();

            if (!valor || excluir.has(normalizado)) continue;
            if (/^\d+$/.test(valor)) continue;
            if (normalizado.includes('no-delivery')) continue;
            if (valor.length > 40) continue;

            rellenos.add(valor);
        }

        // Asegura que los rellenos premium siempre aparezcan en el portal de disponibilidad.
        RELLENOS_PREMIUM_BASE.forEach((relleno) => rellenos.add(relleno));

        return Array.from(rellenos);
    } catch {
        return [...RELLENOS_PREMIUM_BASE];
    }
}

function obtenerZonasEnvioBase() {
    try {
        const indexPath = path.join(__dirname, 'index.html');
        const contenido = fs.readFileSync(indexPath, 'utf8');
        const matchSelect = contenido.match(/<select\s+id="zona-entrega"[^>]*>([\s\S]*?)<\/select>/i);
        const bloque = matchSelect ? matchSelect[1] : contenido;
        const regex = /<option\s+value="([^"]+)"[^>]*>([^<]+)<\/option>/gi;
        const zonas = [];
        const vistos = new Set();

        let match;
        while ((match = regex.exec(bloque)) !== null) {
            const rawValue = String(match[1] || '').trim();
            const texto = String(match[2] || '').trim();

            if (!rawValue || rawValue.toLowerCase() === 'no-delivery') continue;

            const precio = Number(rawValue);
            if (!Number.isFinite(precio) || precio <= 0) continue;

            const zona = texto.replace(/\s*\(\+\$?[^)]*\)\s*/i, '').trim();
            if (!zona || vistos.has(zona)) continue;

            vistos.add(zona);
            zonas.push({ zona, precio: Math.round(precio) });
        }

        return zonas;
    } catch {
        return [];
    }
}

async function obtenerCatalogoPreciosFinal() {
    const base = obtenerCatalogoPreciosBase();
    const baseMap = new Map(base.map((item) => [item.producto, item.precio]));
    const baseSet = new Set(base.map((item) => item.producto));

    const overrides = await PrecioProducto.find({}).lean();

    overrides.forEach((item) => {
        if (!item?.producto || typeof item?.precio !== 'number') return;
        baseMap.set(item.producto, item.precio);
    });

    const catalogo = base.map((item) => ({
        producto: item.producto,
        precio: baseMap.get(item.producto)
    }));

    overrides.forEach((item) => {
        if (!item?.producto || typeof item?.precio !== 'number') return;
        if (!baseSet.has(item.producto)) {
            catalogo.push({ producto: item.producto, precio: item.precio });
        }
    });

    return catalogo;
}

async function obtenerCatalogoEnviosFinal() {
    const base = obtenerZonasEnvioBase();
    const baseSet = new Set(base.map((item) => item.zona));
    const baseMap = new Map(base.map((item) => [item.zona, item.precio]));
    const overrides = await PrecioEnvio.find({}).lean();

    overrides.forEach((item) => {
        if (!item?.zona || typeof item?.precio !== 'number') return;
        if (!baseSet.has(item.zona)) return;
        baseMap.set(item.zona, item.precio);
    });

    return base.map((item) => ({
        zona: item.zona,
        precio: baseMap.get(item.zona)
    }));
}

async function obtenerCatalogoDisponibilidad() {
    const productosBase = obtenerCatalogoPreciosBase().map((item) => item.producto);
    const rellenosBase = obtenerRellenosBase();
    const overrides = await Disponibilidad.find({}).lean();

    const mapProductos = new Map(productosBase.map((nombre) => [nombre, true]));
    const mapRellenos = new Map(rellenosBase.map((nombre) => [nombre, true]));

    overrides.forEach((item) => {
        if (!item?.nombre || typeof item?.habilitado !== 'boolean') return;
        if (item.tipo === 'producto') mapProductos.set(item.nombre, item.habilitado);
        if (item.tipo === 'relleno') mapRellenos.set(item.nombre, item.habilitado);
    });

    return {
        productos: Array.from(mapProductos.entries()).map(([nombre, habilitado]) => ({ nombre, habilitado })),
        rellenos: Array.from(mapRellenos.entries()).map(([nombre, habilitado]) => ({ nombre, habilitado }))
    };
}

async function obtenerEstadoLocal() {
    let estado = await EstadoLocal.findOne({ key: 'main' });
    if (!estado) {
        estado = await EstadoLocal.create({ key: 'main', abierto: true });
    }
    return estado;
}

// Retorna true si el horario actual (Argentina UTC-3) está entre 10:00 y 22:00
function estaEnHorario() {
    const ahora = new Date();
    const horasArg = ((ahora.getUTCHours() - 3) + 24) % 24;
    return horasArg >= 10 && horasArg < 22;
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

function authAdminSSE(req, res, next) {
    const token = String(req.query?.token || '');
    if (!token) {
        return res.status(401).json({ success: false, message: 'No autorizado' });
    }

    const payload = verificarTokenAdmin(token);
    if (!payload) {
        return res.status(401).json({ success: false, message: 'Sesion vencida o invalida' });
    }

    req.admin = { username: payload.u };
    next();
}

function emitirPedidoNuevoSSE(pedido) {
    const data = JSON.stringify({
        type: 'pedido_nuevo',
        pedido
    });

    clientesSSEPedidos.forEach((res) => {
        res.write(`event: pedido_nuevo\n`);
        res.write(`data: ${data}\n\n`);
    });
}

function tokenMercadoPagoPareceValido(token) {
    return /^(APP_USR|TEST)-/.test(String(token || '').trim());
}

function limpiarTextoMercadoPago(value, maxLength = 120) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 .,_-]/g, '')
        .trim()
        .slice(0, maxLength);
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

app.get('/api/debug/mercadopago-status', (req, res) => {
    const token = MERCADOPAGO_ACCESS_TOKEN;
    const configured = Boolean(token);
    const validFormat = tokenMercadoPagoPareceValido(token);

    res.status(200).json({
        success: true,
        configured,
        validFormat,
        tokenSuffix: configured ? token.slice(-6) : null,
        tokenPrefix: configured ? token.slice(0, 7) : null,
        envSource: process.env.MERCADOPAGO_ACCESS_TOKEN ? 'MERCADOPAGO_ACCESS_TOKEN'
            : process.env.MERCADO_PAGO_ACCESS_TOKEN ? 'MERCADO_PAGO_ACCESS_TOKEN'
            : process.env.MP_ACCESS_TOKEN ? 'MP_ACCESS_TOKEN'
            : process.env.ACCESS_TOKEN ? 'ACCESS_TOKEN'
            : null
    });
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
        const dentroHorario = estaEnHorario();
        // Si está fuera del horario automático (10-22 Arg), el local siempre está cerrado
        const abiertoFinal = dentroHorario ? estado.abierto : false;
        res.status(200).json({
            success: true,
            abierto: abiertoFinal,
            fueraDeHorario: !dentroHorario,
            horario: '10:00 - 22:00',
            actualizadoEn: estado.actualizadoEn
        });
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

app.get('/api/precios', async (req, res) => {
    try {
        const precios = await obtenerCatalogoPreciosFinal();
        res.status(200).json({ success: true, precios });
    } catch {
        res.status(500).json({ success: false, message: 'No se pudieron obtener los precios' });
    }
});

app.get('/api/envios', async (req, res) => {
    try {
        const envios = await obtenerCatalogoEnviosFinal();
        res.status(200).json({ success: true, envios });
    } catch {
        res.status(500).json({ success: false, message: 'No se pudieron obtener los precios de envio' });
    }
});

app.get('/api/admin/precios', authAdmin, async (req, res) => {
    try {
        const precios = await obtenerCatalogoPreciosFinal();
        res.status(200).json({ success: true, precios });
    } catch {
        res.status(500).json({ success: false, message: 'No se pudieron obtener los precios' });
    }
});

app.get('/api/admin/envios', authAdmin, async (req, res) => {
    try {
        const envios = await obtenerCatalogoEnviosFinal();
        res.status(200).json({ success: true, envios });
    } catch {
        res.status(500).json({ success: false, message: 'No se pudieron obtener los precios de envio' });
    }
});

app.get('/api/disponibilidad', async (req, res) => {
    try {
        const catalogo = await obtenerCatalogoDisponibilidad();
        res.status(200).json({ success: true, ...catalogo });
    } catch {
        res.status(500).json({ success: false, message: 'No se pudo obtener disponibilidad' });
    }
});

app.get('/api/admin/catalogo', authAdmin, async (req, res) => {
    try {
        const precios = await obtenerCatalogoPreciosFinal();
        const envios = await obtenerCatalogoEnviosFinal();
        const disponibilidad = await obtenerCatalogoDisponibilidad();
        res.status(200).json({ success: true, precios, envios, ...disponibilidad });
    } catch {
        res.status(500).json({ success: false, message: 'No se pudo obtener el catalogo' });
    }
});

app.put('/api/admin/precios/:producto', authAdmin, async (req, res) => {
    try {
        const producto = decodeURIComponent(String(req.params.producto || '')).trim();
        const precio = Number(req.body?.precio);

        if (!producto) {
            return res.status(400).json({ success: false, message: 'Producto inválido' });
        }

        if (!Number.isFinite(precio) || precio <= 0) {
            return res.status(400).json({ success: false, message: 'El precio debe ser un número mayor a 0' });
        }

        const catalogoBase = obtenerCatalogoPreciosBase();
        const existeEnBase = catalogoBase.some((item) => item.producto === producto);
        if (!existeEnBase) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado en el catálogo' });
        }

        await PrecioProducto.findOneAndUpdate(
            { producto },
            { $set: { producto, precio: Math.round(precio), actualizadoEn: new Date() } },
            { upsert: true, new: true }
        );

        return res.status(200).json({
            success: true,
            message: `Precio actualizado para ${producto}`,
            producto,
            precio: Math.round(precio)
        });
    } catch {
        return res.status(500).json({ success: false, message: 'No se pudo actualizar el precio del producto' });
    }
});

app.put('/api/admin/envios/:zona', authAdmin, async (req, res) => {
    try {
        const zona = decodeURIComponent(String(req.params.zona || '')).trim();
        const precio = Number(req.body?.precio);

        if (!zona) {
            return res.status(400).json({ success: false, message: 'Zona invalida' });
        }

        if (!Number.isFinite(precio) || precio <= 0) {
            return res.status(400).json({ success: false, message: 'El precio debe ser un numero mayor a 0' });
        }

        const zonasBase = obtenerZonasEnvioBase();
        const existeEnBase = zonasBase.some((item) => item.zona === zona);
        if (!existeEnBase) {
            return res.status(404).json({ success: false, message: 'Zona no encontrada en el catalogo' });
        }

        await PrecioEnvio.findOneAndUpdate(
            { zona },
            { $set: { zona, precio: Math.round(precio), actualizadoEn: new Date() } },
            { upsert: true, new: true }
        );

        return res.status(200).json({
            success: true,
            message: `Precio de envio actualizado para ${zona}`,
            zona,
            precio: Math.round(precio)
        });
    } catch {
        return res.status(500).json({ success: false, message: 'No se pudo actualizar el precio de envio' });
    }
});

app.put('/api/admin/disponibilidad/productos/:nombre', authAdmin, async (req, res) => {
    try {
        const nombre = decodeURIComponent(String(req.params.nombre || '')).trim();
        const habilitado = Boolean(req.body?.habilitado);

        if (!nombre) {
            return res.status(400).json({ success: false, message: 'Producto invalido' });
        }

        const existeEnBase = obtenerCatalogoPreciosBase().some((item) => item.producto === nombre);
        if (!existeEnBase) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado' });
        }

        await Disponibilidad.findOneAndUpdate(
            { tipo: 'producto', nombre },
            { $set: { tipo: 'producto', nombre, habilitado, actualizadoEn: new Date() } },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true, nombre, habilitado });
    } catch {
        return res.status(500).json({ success: false, message: 'No se pudo actualizar disponibilidad del producto' });
    }
});

app.put('/api/admin/disponibilidad/rellenos/:nombre', authAdmin, async (req, res) => {
    try {
        const nombre = decodeURIComponent(String(req.params.nombre || '')).trim();
        const habilitado = Boolean(req.body?.habilitado);

        if (!nombre) {
            return res.status(400).json({ success: false, message: 'Relleno invalido' });
        }

        const existeEnBase = obtenerRellenosBase().includes(nombre);
        if (!existeEnBase) {
            return res.status(404).json({ success: false, message: 'Relleno no encontrado' });
        }

        await Disponibilidad.findOneAndUpdate(
            { tipo: 'relleno', nombre },
            { $set: { tipo: 'relleno', nombre, habilitado, actualizadoEn: new Date() } },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true, nombre, habilitado });
    } catch {
        return res.status(500).json({ success: false, message: 'No se pudo actualizar disponibilidad del relleno' });
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

app.get('/api/admin/pedidos/stream', authAdminSSE, (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`event: ready\n`);
    res.write(`data: ${JSON.stringify({ ok: true })}\n\n`);

    clientesSSEPedidos.add(res);

    req.on('close', () => {
        clientesSSEPedidos.delete(res);
    });
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

app.put('/api/admin/pedidos/:id/pago', authAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const paymentRaw = String(req.body?.paymentStatus || req.body?.payment_status || '').trim().toLowerCase();

        const pagosPermitidos = {
            pending: 'pending',
            paid: 'paid',
            approved: 'paid',
            rejected: 'rejected',
            cancelled: 'rejected',
            failed: 'rejected'
        };

        const paymentStatus = pagosPermitidos[paymentRaw];
        if (!paymentStatus) {
            return res.status(400).json({
                success: false,
                message: 'Estado de pago invalido. Usa pending, paid o rejected.'
            });
        }

        const pedido = await Pedido.findByIdAndUpdate(
            id,
            { $set: { payment_status: paymentStatus } },
            { new: true }
        );

        if (!pedido) {
            return res.status(404).json({ success: false, message: 'Pedido no encontrado.' });
        }

        const mensaje = paymentStatus === 'paid'
            ? 'Pago marcado como realizado.'
            : paymentStatus === 'rejected'
                ? 'Pago marcado como rechazado.'
                : 'Pago marcado como pendiente.';

        return res.status(200).json({
            success: true,
            message: mensaje,
            pedido
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'No se pudo actualizar el estado de pago.' });
    }
});

// 3. RUTA POST ACTUALIZADA: Guarda el pedido y genera el link de Mercado Pago
app.post('/api/pedidos', async (req, res) => {
    try {
        if (!client || !tokenMercadoPagoPareceValido(MERCADOPAGO_ACCESS_TOKEN)) {
            return res.status(500).json({
                success: false,
                code: 'MERCADOPAGO_CONFIG_INVALIDA',
                message: 'Mercado Pago no está configurado correctamente en el servidor. Revisá la variable MERCADOPAGO_ACCESS_TOKEN y reiniciá el backend.'
            });
        }

        const estadoLocal = await obtenerEstadoLocal();
        const dentroHorario = estaEnHorario();
        if (!dentroHorario || !estadoLocal.abierto) {
            return res.status(403).json({
                success: false,
                code: 'LOCAL_CERRADO',
                message: 'El local se encuentra cerrado. No se aceptan pedidos en este momento.'
            });
        }

        const nuevoPedido = new Pedido({
            _id: new mongoose.Types.ObjectId(),
            ...req.body
        });

        // Estructuramos los items para Mercado Pago a partir del carrito recibido
        const itemsMP = req.body.items.map(item => ({
            title: limpiarTextoMercadoPago(item.producto || 'Producto'),
            quantity: Number(item.cantidad),
            unit_price: Number(item.precio),
            currency_id: 'ARS'
        }));

        // Si hay costo de envío, lo sumamos como un ítem para que se cobre
        if (req.body.costoEnvio > 0) {
            itemsMP.push({
                title: 'Costo de Envio',
                quantity: 1,
                unit_price: Number(req.body.costoEnvio),
                currency_id: 'ARS'
            });
        }

        const nombreCliente = String(req.body?.cliente?.nombre || '').trim();
        const telefonoCliente = String(req.body?.cliente?.telefono || '').replace(/\D/g, '');

        // Creamos la preferencia de Mercado Pago
        const preference = new Preference(client);
        const result = await preference.create({
            body: {
                items: itemsMP,
                payer: {
                    name: limpiarTextoMercadoPago(nombreCliente, 60) || undefined,
                    phone: telefonoCliente ? { number: telefonoCliente } : undefined
                },
                statement_descriptor: 'SABORYSAZON',
                back_urls: {
                    // Links a donde vuelve el cliente tras pagar (pueden ser tu misma web de Vercel)
                    success: 'https://web-sabor-sazon.vercel.app/?status=success',
                    failure: 'https://web-sabor-sazon.vercel.app/?status=failure',
                    pending: 'https://web-sabor-sazon.vercel.app/?status=pending'
                },
                auto_return: 'approved', // Redirección automática al finalizar el pago exitoso
                external_reference: nuevoPedido._id.toString(), // Asociamos el ID del pedido de Mongo
                metadata: {
                    pedido_id: nuevoPedido._id.toString(),
                    tipo_entrega: String(req.body?.tipoEntrega || 'retiro')
                }
            }
        });

        await nuevoPedido.save();
        emitirPedidoNuevoSSE(nuevoPedido);

        // Devolvemos el ID de pedido y el link de pago (init_point) al frontend
        const initPoint = result.init_point || result.sandbox_init_point;

        if (!initPoint) {
            return res.status(500).json({
                success: false,
                code: 'MERCADOPAGO_SIN_URL',
                message: 'Mercado Pago no devolvió una URL de pago válida.'
            });
        }

        res.status(201).json({ 
            success: true, 
            pedidoId: nuevoPedido._id, 
            initPoint // URL de la pasarela de Mercado Pago
        });

    } catch (error) {
        console.error('Error al crear preferencia:', {
            message: error?.message,
            cause: error?.cause,
            status: error?.status,
            response: error?.response?.data || error?.cause
        });
        res.status(500).json({ success: false, message: 'Error al procesar el pedido', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
    if (!MERCADOPAGO_ACCESS_TOKEN) {
        console.warn('MERCADOPAGO_ACCESS_TOKEN no está definido. Mercado Pago no funcionará.');
    } else {
        console.log(`Mercado Pago configurado con token terminado en ${MERCADOPAGO_ACCESS_TOKEN.slice(-6)}`);
    }
});