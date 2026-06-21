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
const newPasswordInput = document.getElementById('new-password');
const newPasswordConfirmInput = document.getElementById('new-password-confirm');
const toggleCreatePasswordsBtn = document.getElementById('toggle-create-passwords-btn');
const usersCard = document.getElementById('users-card');
const toggleUsersBtn = document.getElementById('toggle-users-btn');

const refreshBtn = document.getElementById('refresh-btn');
const logoutBtn = document.getElementById('logout-btn');
const ordersList = document.getElementById('orders-list');
const ordersCount = document.getElementById('orders-count');
const filterDateFrom = document.getElementById('filter-date-from');
const filterDateTo = document.getElementById('filter-date-to');
const applyFilterBtn = document.getElementById('apply-filter-btn');
const clearFilterBtn = document.getElementById('clear-filter-btn');
const exportXlsxBtn = document.getElementById('export-xlsx-btn');
const deleteFilteredBtn = document.getElementById('delete-filtered-btn');
const deleteAllBtn = document.getElementById('delete-all-btn');

let pedidosActuales = [];
let autoRefreshTimer = null;
let pedidosConocidos = new Set();
let audioContext = null;
let pedidosStream = null;
let pedidosStreamReconnectTimer = null;

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

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function detectarCoccionArepa(item) {
    const gustos = Array.isArray(item?.gustos) ? item.gustos : [];
    const texto = gustos
        .map((g) => `${g?.componente || ''} ${g?.sabor || ''}`.toLowerCase())
        .join(' ');

    if (texto.includes('asada')) return 'Asada';
    if (texto.includes('frita') || texto.includes('freida') || texto.includes('frito')) return 'Frita';
    return '';
}

function renderPedidos(pedidos) {
    pedidosActuales = pedidos;
    ordersCount.textContent = `${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'}`;

    if (!pedidos.length) {
        ordersList.innerHTML = '<p class="helper-text">No hay pedidos registrados por ahora.</p>';
        return;
    }

    ordersList.innerHTML = pedidos.map((pedido) => {
        const items = (pedido.items || []).map((item) => {
            const gustos = Array.isArray(item?.gustos) ? item.gustos : [];
            const rellenos = gustos
                .map((gusto) => `${gusto?.componente || 'Item'}: ${gusto?.sabor || '-'}`)
                .join(' | ');
            const coccionArepa = detectarCoccionArepa(item);

            const extras = [];
            if (rellenos) extras.push(`Rellenos: ${rellenos}`);
            if (coccionArepa) extras.push(`Arepa: ${coccionArepa}`);

            return `
                <div class="order-item-line">
                    <span>${escapeHtml(`${item?.cantidad || 0}x ${item?.producto || 'Producto'}`)}</span>
                    ${extras.length ? `<br><small>${escapeHtml(extras.join(' • '))}</small>` : ''}
                </div>
            `;
        }).join('');
        const estadoActual = (pedido.estado || 'Pendiente').toLowerCase();
        return `
            <article class="order-item">
                <div class="order-top">
                    <div>
                        <strong>#${pedido._id}</strong>
                        <span>${formatDate(pedido.fecha)}</span>
                    </div>
                    <div class="order-actions">
                        <select class="order-status-select" data-id="${pedido._id}">
                            <option value="pendiente" ${estadoActual === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            <option value="hecho" ${estadoActual === 'hecho' ? 'selected' : ''}>Hecho</option>
                            <option value="cancelado" ${estadoActual === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                        </select>
                        <button type="button" class="btn btn-small btn-primary btn-save-status" data-id="${pedido._id}">Guardar</button>
                        <button type="button" class="btn btn-danger btn-small btn-delete-order" data-id="${pedido._id}">Borrar</button>
                    </div>
                </div>
                <div class="order-meta">
                    ${pedido.cliente?.nombre || 'Sin nombre'} | ${pedido.cliente?.telefono || 'Sin telefono'}
                </div>
                <div class="order-meta">
                    Entrega: ${pedido.tipoEntrega || 'retiro'} | ${pedido.cliente?.direccion || 'Sin direccion'} | Estado: <span class="estado-badge estado-${estadoActual}">${pedido.estado || 'Pendiente'}</span>
                </div>
                <div class="order-items">${items || 'Sin items'}</div>
                <div class="order-total">Total: $${Number(pedido.total || 0).toLocaleString('es-AR')}</div>
            </article>
        `;
    }).join('');
}

function setupAudioUnlock() {
    const unlockAudio = () => {
        if (!audioContext) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (Ctx) {
                audioContext = new Ctx();
            }
        }

        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
}

function sonarNotificacionNuevoPedido() {
    try {
        if (!audioContext) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            audioContext = new Ctx();
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume().catch(() => {});
        }

        const ahora = audioContext.currentTime;
        const tonos = [880, 1175];

        tonos.forEach((frecuencia, index) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(frecuencia, ahora);

            gain.gain.setValueAtTime(0.0001, ahora);
            gain.gain.exponentialRampToValueAtTime(0.2, ahora + 0.01 + index * 0.13);
            gain.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.12 + index * 0.13);

            osc.connect(gain);
            gain.connect(audioContext.destination);

            const startAt = ahora + index * 0.13;
            const stopAt = startAt + 0.12;
            osc.start(startAt);
            osc.stop(stopAt);
        });
    } catch {
        // Si el navegador bloquea audio, el panel sigue funcionando sin sonido.
    }
}

function detectarNuevosPedidos(pedidos) {
    const idsActuales = new Set((pedidos || []).map((pedido) => String(pedido._id)));

    if (pedidosConocidos.size === 0) {
        pedidosConocidos = idsActuales;
        return 0;
    }

    let nuevos = 0;
    idsActuales.forEach((id) => {
        if (!pedidosConocidos.has(id)) nuevos += 1;
    });

    pedidosConocidos = idsActuales;
    return nuevos;
}

function registrarPedidoConocidoDesdeEvento(pedido) {
    if (!pedido || !pedido._id) return;
    pedidosConocidos.add(String(pedido._id));
}

function construirQueryPedidos() {
    const params = new URLSearchParams();
    params.set('limit', '1000');

    const desde = filterDateFrom ? filterDateFrom.value : '';
    const hasta = filterDateTo ? filterDateTo.value : '';

    if (desde) {
        params.set('fechaDesde', `${desde}T00:00:00.000Z`);
    }
    if (hasta) {
        params.set('fechaHasta', `${hasta}T23:59:59.999Z`);
    }

    return params.toString();
}

function construirQueryBorrado() {
    const params = new URLSearchParams();
    const desde = filterDateFrom ? filterDateFrom.value : '';
    const hasta = filterDateTo ? filterDateTo.value : '';

    if (desde) params.set('fechaDesde', `${desde}T00:00:00.000Z`);
    if (hasta) params.set('fechaHasta', `${hasta}T23:59:59.999Z`);

    return params.toString();
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
    const query = construirQueryPedidos();
    const data = await fetchAdmin(`/api/admin/pedidos?${query}`);
    const pedidos = data.pedidos || [];
    const nuevos = detectarNuevosPedidos(pedidos);
    renderPedidos(pedidos);

    if (nuevos > 0) {
        sonarNotificacionNuevoPedido();
        statusFeedback.textContent = `Llegaron ${nuevos} pedido${nuevos === 1 ? '' : 's'} nuevo${nuevos === 1 ? '' : 's'}.`;
    }
}

async function inicializarPanel() {
    await Promise.all([cargarEstado(), cargarPedidos()]);
}

function iniciarAutoRefrescoPedidos() {
    if (autoRefreshTimer) return;

    autoRefreshTimer = setInterval(async () => {
        try {
            await cargarPedidos();
        } catch {
            statusFeedback.textContent = 'No se pudo refrescar pedidos automaticamente.';
        }
    }, 20000);
}

function detenerAutoRefrescoPedidos() {
    if (!autoRefreshTimer) return;
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
}

function detenerStreamPedidos() {
    if (pedidosStream) {
        pedidosStream.close();
        pedidosStream = null;
    }

    if (pedidosStreamReconnectTimer) {
        clearTimeout(pedidosStreamReconnectTimer);
        pedidosStreamReconnectTimer = null;
    }
}

function iniciarStreamPedidos() {
    if (pedidosStream || typeof EventSource === 'undefined') return;

    const token = getToken();
    if (!token) return;

    const streamUrl = `${API_BASE}/api/admin/pedidos/stream?token=${encodeURIComponent(token)}`;
    pedidosStream = new EventSource(streamUrl);

    pedidosStream.addEventListener('pedido_nuevo', async (event) => {
        try {
            const payload = JSON.parse(event.data || '{}');
            registrarPedidoConocidoDesdeEvento(payload.pedido);
            sonarNotificacionNuevoPedido();
            statusFeedback.textContent = 'Llego un pedido nuevo.';
            await cargarPedidos();
        } catch {
            // Si falla el parseo, seguimos con polling como respaldo.
        }
    });

    pedidosStream.onerror = () => {
        detenerStreamPedidos();
        pedidosStreamReconnectTimer = setTimeout(() => {
            iniciarStreamPedidos();
        }, 5000);
    };
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
        iniciarAutoRefrescoPedidos();
        iniciarStreamPedidos();
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

        const formData = new FormData(createUserForm);
        const username = String(formData.get('new-username') || '').trim();
        const password = String(formData.get('new-password') || '');
        const passwordConfirm = String(formData.get('new-password-confirm') || '');

        if (password !== passwordConfirm) {
            createUserFeedback.textContent = 'Las contraseñas no coinciden.';
            return;
        }

        createUserFeedback.textContent = 'Creando usuario...';

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

if (toggleCreatePasswordsBtn && newPasswordInput && newPasswordConfirmInput) {
    toggleCreatePasswordsBtn.addEventListener('click', () => {
        const mostrar = newPasswordInput.type === 'password';
        newPasswordInput.type = mostrar ? 'text' : 'password';
        newPasswordConfirmInput.type = mostrar ? 'text' : 'password';
        toggleCreatePasswordsBtn.innerText = mostrar ? 'Ocultar contraseñas' : 'Mostrar contraseñas';
    });
}

if (toggleUsersBtn && usersCard) {
    toggleUsersBtn.addEventListener('click', () => {
        usersCard.classList.toggle('hidden');
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

if (applyFilterBtn) {
    applyFilterBtn.addEventListener('click', async () => {
        statusFeedback.textContent = 'Aplicando filtro...';
        try {
            await cargarPedidos();
            statusFeedback.textContent = 'Filtro aplicado.';
        } catch (error) {
            statusFeedback.textContent = `No se pudo aplicar filtro: ${error.message}`;
        }
    });
}

if (clearFilterBtn) {
    clearFilterBtn.addEventListener('click', async () => {
        if (filterDateFrom) filterDateFrom.value = '';
        if (filterDateTo) filterDateTo.value = '';
        statusFeedback.textContent = 'Limpiando filtros...';
        try {
            await cargarPedidos();
            statusFeedback.textContent = 'Filtros limpiados.';
        } catch (error) {
            statusFeedback.textContent = `No se pudieron limpiar filtros: ${error.message}`;
        }
    });
}

if (deleteFilteredBtn) {
    deleteFilteredBtn.addEventListener('click', async () => {
        const query = construirQueryBorrado();
        if (!query) {
            statusFeedback.textContent = 'Seleccioná una fecha desde/hasta para borrar filtrados.';
            return;
        }

        const confirmacion = confirm('¿Seguro que querés borrar los pedidos filtrados por fecha?');
        if (!confirmacion) return;

        statusFeedback.textContent = 'Borrando pedidos filtrados...';
        try {
            const result = await fetchAdmin(`/api/admin/pedidos?${query}`, { method: 'DELETE' });
            statusFeedback.textContent = result.message || 'Pedidos filtrados eliminados.';
            await cargarPedidos();
        } catch (error) {
            statusFeedback.textContent = `No se pudieron borrar pedidos filtrados: ${error.message}`;
        }
    });
}

if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', async () => {
        const confirmacion = confirm('Esto eliminará TODOS los pedidos. ¿Continuar?');
        if (!confirmacion) return;

        statusFeedback.textContent = 'Borrando todos los pedidos...';
        try {
            const result = await fetchAdmin('/api/admin/pedidos?todos=true', { method: 'DELETE' });
            statusFeedback.textContent = result.message || 'Todos los pedidos eliminados.';
            await cargarPedidos();
        } catch (error) {
            statusFeedback.textContent = `No se pudieron borrar todos los pedidos: ${error.message}`;
        }
    });
}

if (exportXlsxBtn) {
    exportXlsxBtn.addEventListener('click', () => {
        if (!pedidosActuales.length) {
            statusFeedback.textContent = 'No hay pedidos para exportar.';
            return;
        }

        if (typeof XLSX === 'undefined') {
            statusFeedback.textContent = 'No se pudo cargar la libreria de exportacion.';
            return;
        }

        const filas = pedidosActuales.map((pedido) => ({
            ID: pedido._id,
            Fecha: formatDate(pedido.fecha),
            Estado: pedido.estado || 'Pendiente',
            Cliente: pedido.cliente?.nombre || '',
            Telefono: pedido.cliente?.telefono || '',
            Entrega: pedido.tipoEntrega || '',
            Direccion: pedido.cliente?.direccion || '',
            Items: (pedido.items || []).map((item) => `${item.cantidad}x ${item.producto}`).join(' | '),
            Total: Number(pedido.total || 0)
        }));

        const hoja = XLSX.utils.json_to_sheet(filas);
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, 'Pedidos');

        const stamp = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(libro, `pedidos_${stamp}.xlsx`);
        statusFeedback.textContent = 'Archivo .xlsx exportado correctamente.';
    });
}

if (ordersList) {
    ordersList.addEventListener('click', async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        if (target.classList.contains('btn-delete-order')) {
            const id = target.dataset.id;
            if (!id) return;

            const confirmacion = confirm('¿Eliminar este pedido?');
            if (!confirmacion) return;

            statusFeedback.textContent = 'Eliminando pedido...';
            try {
                const result = await fetchAdmin(`/api/admin/pedidos/${id}`, { method: 'DELETE' });
                statusFeedback.textContent = result.message || 'Pedido eliminado.';
                await cargarPedidos();
            } catch (error) {
                statusFeedback.textContent = `No se pudo eliminar el pedido: ${error.message}`;
            }
        }

        if (target.classList.contains('btn-save-status')) {
            const id = target.dataset.id;
            if (!id) return;

            const card = target.closest('.order-item');
            const select = card ? card.querySelector('.order-status-select') : null;
            const estado = select ? select.value : '';
            if (!estado) return;

            statusFeedback.textContent = 'Actualizando estado del pedido...';
            try {
                const result = await fetchAdmin(`/api/admin/pedidos/${id}/estado`, {
                    method: 'PUT',
                    body: JSON.stringify({ estado })
                });
                statusFeedback.textContent = result.message || 'Estado actualizado.';
                await cargarPedidos();
            } catch (error) {
                statusFeedback.textContent = `No se pudo actualizar estado: ${error.message}`;
            }
        }
    });
}

logoutBtn.addEventListener('click', () => {
    detenerStreamPedidos();
    detenerAutoRefrescoPedidos();
    clearToken();
    setAuthenticatedUI(false);
    loginForm.reset();
    statusFeedback.textContent = '';
    if (createUserFeedback) createUserFeedback.textContent = '';
    pedidosConocidos = new Set();
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
        iniciarAutoRefrescoPedidos();
        iniciarStreamPedidos();
    } catch (error) {
        detenerStreamPedidos();
        detenerAutoRefrescoPedidos();
        clearToken();
        setAuthenticatedUI(false);
        loginError.textContent = 'Sesión expirada. Iniciá sesión nuevamente.';
    }
}

setupAudioUnlock();
bootstrap();
