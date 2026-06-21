const API_BASE = 'https://web-sabor-sazon.onrender.com';
const TOKEN_KEY = 'portal_admin_token';

const authCard = document.getElementById('auth-card');
const adminPanel = document.getElementById('admin-panel');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

const estadoInput = document.getElementById('estado-local');
const estadoLabel = document.getElementById('estado-label');
const saveStatusBtn = document.getElementById('save-status-btn');
const statusFeedback = document.getElementById('status-feedback');
const createUserForm = document.getElementById('create-user-form');
const createUserFeedback = document.getElementById('create-user-feedback');

const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');
const ordersList = document.getElementById('orders-list');
const ordersCount = document.getElementById('orders-count');

function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
}

function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
}

function setAuthenticatedUI(isAuthenticated) {
    authCard.classList.toggle('hidden', isAuthenticated);
    adminPanel.classList.toggle('hidden', !isAuthenticated);
}

function tokenPareceLegacy(token) {
    // Tokens viejos eran hex sin separador; el token nuevo tiene formato payload.firma
    return token && !token.includes('.');
}

function updateEstadoLabel() {
    estadoLabel.textContent = estadoInput.checked ? 'Abierto' : 'Cerrado';
}

function formatDate(value) {
    return new Date(value).toLocaleString('es-AR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });
}

function renderPedidos(pedidos) {
    ordersCount.textContent = `${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'}`;

    if (!pedidos.length) {
        ordersList.innerHTML = '<p class="helper-text">No hay pedidos registrados por ahora.</p>';
        return;
    }

    ordersList.innerHTML = pedidos.map((pedido) => {
        const items = (pedido.items || []).map((item) => `${item.cantidad}x ${item.producto}`).join(' • ');
        return `
            <article class="order-item">
                <div class="order-top">
                    <strong>#${pedido._id}</strong>
                    <span>${formatDate(pedido.fecha)}</span>
                </div>
                <div class="order-meta">
                    ${pedido.cliente?.nombre || 'Sin nombre'} | ${pedido.cliente?.telefono || 'Sin telefono'}
                </div>
                <div class="order-meta">
                    Entrega: ${pedido.tipoEntrega || 'retiro'} | ${pedido.cliente?.direccion || 'Sin direccion'}
                </div>
                <div class="order-items">${items || 'Sin items'}</div>
                <div class="order-total">Total: $${Number(pedido.total || 0).toLocaleString('es-AR')}</div>
            </article>
        `;
    }).join('');
}

async function fetchAdmin(path, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
    };

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        clearToken();
        setAuthenticatedUI(false);
        throw new Error('Sesion expirada');
    }

    const raw = await response.text();
    let data = {};
    if (raw) {
        try {
            data = JSON.parse(raw);
        } catch {
            data = { message: `Respuesta no valida del servidor (${response.status})` };
        }
    }
    if (!response.ok || !data.success) {
        throw new Error(data.message || 'Error de servidor');
    }

    return data;
}

async function cargarEstado() {
    const data = await fetchAdmin('/api/estado-local');
    estadoInput.checked = Boolean(data.abierto);
    updateEstadoLabel();
}

async function cargarPedidos() {
    const data = await fetchAdmin('/api/admin/pedidos?limit=150');
    renderPedidos(data.pedidos || []);
}

async function inicializarPanel() {
    await Promise.all([cargarEstado(), cargarPedidos()]);
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.textContent = '';

    const formData = new FormData(loginForm);
    const username = String(formData.get('username') || '').trim();
    const password = String(formData.get('password') || '').trim();

    try {
        const response = await fetch(`${API_BASE}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (!response.ok || !data.success || !data.token) {
            throw new Error(data.message || 'Credenciales invalidas');
        }

        setToken(data.token);
        setAuthenticatedUI(true);
        await inicializarPanel();
    } catch (error) {
        loginError.textContent = error.message || 'Usuario o contraseña incorrectos.';
    }
});

estadoInput.addEventListener('change', updateEstadoLabel);

saveStatusBtn.addEventListener('click', async () => {
    statusFeedback.textContent = 'Guardando estado...';
    try {
        await fetchAdmin('/api/admin/estado-local', {
            method: 'PUT',
            body: JSON.stringify({ abierto: estadoInput.checked })
        });
        statusFeedback.textContent = `Estado actualizado: ${estadoInput.checked ? 'abierto' : 'cerrado'}.`;
    } catch (error) {
        statusFeedback.textContent = `No se pudo guardar el estado: ${error.message}`;
    }
});

if (createUserForm) {
    createUserForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        createUserFeedback.textContent = 'Creando usuario...';

        const formData = new FormData(createUserForm);
        const username = String(formData.get('new-username') || '').trim();
        const password = String(formData.get('new-password') || '');

        try {
            const result = await fetchAdmin('/api/admin/usuarios', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });

            createUserFeedback.textContent = result.message || 'Usuario creado correctamente.';
            createUserForm.reset();
        } catch (error) {
            createUserFeedback.textContent = `No se pudo crear usuario: ${error.message}`;
        }
    });
}

refreshBtn.addEventListener('click', async () => {
    statusFeedback.textContent = 'Actualizando datos...';
    try {
        await inicializarPanel();
        statusFeedback.textContent = 'Datos actualizados.';
    } catch (error) {
        statusFeedback.textContent = 'No se pudieron actualizar los datos.';
    }
});

logoutBtn.addEventListener('click', () => {
    clearToken();
    setAuthenticatedUI(false);
    loginForm.reset();
    statusFeedback.textContent = '';
    if (createUserFeedback) createUserFeedback.textContent = '';
});

async function bootstrap() {
    const token = getToken();

    if (tokenPareceLegacy(token)) {
        clearToken();
        setAuthenticatedUI(false);
        loginError.textContent = 'Tu sesión anterior venció por una actualización. Iniciá sesión nuevamente.';
        return;
    }

    if (!token) {
        setAuthenticatedUI(false);
        return;
    }

    setAuthenticatedUI(true);
    try {
        await inicializarPanel();
        setInterval(async () => {
            try {
                await cargarPedidos();
            } catch (error) {
                statusFeedback.textContent = 'No se pudo refrescar pedidos automaticamente.';
            }
        }, 20000);
    } catch (error) {
        clearToken();
        setAuthenticatedUI(false);
        loginError.textContent = 'Sesión expirada. Iniciá sesión nuevamente.';
    }
}

bootstrap();
