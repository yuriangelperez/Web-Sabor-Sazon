document.addEventListener('DOMContentLoaded', () => {
    // --- NUEVO: DETECTAR SI EL CLIENTE VUELVE DE PAGAR ---
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');

    if (status === 'success') {
        const urlWA = localStorage.getItem('pending_whatsapp_url');
        if (urlWA) {
            localStorage.removeItem('pending_whatsapp_url'); // Limpiamos la memoria interna
            alert('¡Pago aprobado con éxito! Redirigiendo a WhatsApp para avisar al local...');
            window.open(urlWA, '_self'); // Abre tu mensaje formateado de WhatsApp en la misma pestaña
        }
    } else if (status === 'failure') {
        alert('El pago no pudo procesarse o fue cancelado. Por favor, intenta de nuevo o comunícate con nosotros.');
    }
    // -----------------------------------------------------

    // Estado del carrito en memoria (sigue el resto de tus variables iguales...)
    let carrito = [];
    let totalProductos = 0;
    let costoEnvio = 0;

    const carritoItemsDiv = document.getElementById('carrito-items');
    const carritoTotalSpan = document.getElementById('carrito-total');
    const formularioPedido = document.getElementById('form-pedido');

    // 1. Capturar clics en los botones de "Agregar"
document.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('btn-agregar')) {
            const producto = e.target.getAttribute('data-producto');
            const precio = parseInt(e.target.getAttribute('data-precio'));

            // --- DETECCION DE GUSTOS DETALLADOS ---
            const cardBody = e.target.closest('.card-body') || e.target.closest('.menu-card');
            let gustosElegidos = [];

            if (cardBody) {
                const selectores = cardBody.querySelectorAll('.custom-select');

                selectores.forEach((select, index) => {
                    let etiquetaItem = "";
                    const labelPrevio = select.previousElementSibling;
                    if (labelPrevio && (labelPrevio.tagName === 'LABEL' || labelPrevio.tagName === 'SPAN')) {
                        etiquetaItem = labelPrevio.innerText.replace(':', '').trim();
                    } else {
                        if (producto.toLowerCase().includes('zulia')) {
                            etiquetaItem = `Arepa ${index + 1}`;
                        } else if (producto.toLowerCase().includes('maracay')) {
                            etiquetaItem = index < 2 ? `Arepa ${index + 1}` : `Empanada ${index - 1}`;
                        } else if (producto.toLowerCase().includes('vargas')) {
                            etiquetaItem = `Empanada ${index + 1}`;
                        } else {
                            etiquetaItem = `Ítem ${index + 1}`;
                        }
                    }

                    gustosElegidos.push({
                        componente: etiquetaItem,
                        sabor: select.value
                    });
                });
            }

            // Si no es un combo (no tiene selectores), gustosElegidos queda perfectamente vacío []
            
            // --- LOGICA DE AGREGAR AL CARRITO (Movida adentro del IF principal) ---
            const itemExistente = carrito.find(item =>
                item.producto === producto &&
                JSON.stringify(item.gustos) === JSON.stringify(gustosElegidos)
            );

            if (itemExistente) {
                itemExistente.cantidad += 1;
            } else {
                carrito.push({
                    producto: producto,
                    cantidad: 1,
                    precio: precio,
                    gustos: gustosElegidos // Sube con datos si es combo, o [] si es suelto
                });
            }

            actualizarInterfazCarrito();
        }
    });

// --- ESCUCHAR CAMBIOS EN EL TIPO DE ENTREGA ---
document.addEventListener('change', (e) => {
    if (e.target && e.target.name === 'tipo_entrega') {
        const inputDireccion = document.getElementById('direccion');

        if (e.target.value === 'envio') {
            costoEnvio = 8000;
            if (inputDireccion) {
                inputDireccion.required = true;
                inputDireccion.placeholder = "Ej. San Ignacio 663";
                inputDireccion.parentElement.style.opacity = "1";
            }
        } else {
            costoEnvio = 0;
            if (inputDireccion) {
                inputDireccion.required = false;
                inputDireccion.placeholder = "No es requerida para retirar";
                inputDireccion.value = "";
            }
        }
        const totalGeneral = totalProductos + costoEnvio;
        carritoTotalSpan.innerText = `$${totalGeneral.toLocaleString('es-AR')}`;
    }
});

// 2. Función para redibujar el resumen del pedido ("Tu Pedido" y "Sidebar")
function actualizarInterfazCarrito() {
    // Capturamos los nuevos elementos del Sidebar
    const sidebarItemsDiv = document.getElementById('cart-sidebar-items');
    const sidebarTotalSpan = document.getElementById('cart-sidebar-total');
    const floatingCountSpan = document.getElementById('cart-floating-count');

    // Calcular cantidad total de unidades en el carrito para el badge flotante
    let totalUnidades = 0;
    carrito.forEach(item => totalUnidades += item.cantidad);
    if (floatingCountSpan) {
        floatingCountSpan.innerText = totalUnidades;
    }

    if (carrito.length === 0) {
        const mensajeVacio = '<p class="cart-empty-msg">El carrito está vacío. ¡Agrega tus arepas o combos favoritos!</p>';
        if (carritoItemsDiv) carritoItemsDiv.innerHTML = mensajeVacio;
        if (sidebarItemsDiv) sidebarItemsDiv.innerHTML = mensajeVacio;

        if (carritoTotalSpan) carritoTotalSpan.innerText = '$0';
        if (sidebarTotalSpan) sidebarTotalSpan.innerText = '$0';

        totalProductos = 0;
        return;
    }

    // Limpiamos los contenedores antes de redibujar
    if (carritoItemsDiv) carritoItemsDiv.innerHTML = '';
    if (sidebarItemsDiv) sidebarItemsDiv.innerHTML = '';
    totalProductos = 0;

    carrito.forEach((item, index) => {
        const subtotal = item.precio * item.cantidad;
        totalProductos += subtotal;

        // --- 1. Crear nodo para el Checkout Tradicional ---
        const itemDivCheckout = document.createElement('div');
        itemDivCheckout.style.marginBottom = '14px';

        const filaPrincipalCheckout = document.createElement('div');
        filaPrincipalCheckout.style.display = 'flex';
        filaPrincipalCheckout.style.justifyContent = 'space-between';
        filaPrincipalCheckout.style.alignItems = 'center';
        filaPrincipalCheckout.innerHTML = `
                <span style="color: #ffffff; font-weight: 500;">${item.cantidad}x ${item.producto}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: #ffffff; font-weight: 600;">$${subtotal.toLocaleString('es-AR')}</span>
                    <button class="btn-eliminar" data-index="${index}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 13px; padding: 0 4px;">✕</button>
                </div>
            `;
        itemDivCheckout.appendChild(filaPrincipalCheckout);

        // --- 2. Crear nodo clonado para el Sidebar Flotante ---
        const itemDivSidebar = document.createElement('div');
        itemDivSidebar.style.marginBottom = '14px';
        itemDivSidebar.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
        itemDivSidebar.style.paddingBottom = '10px';

        const filaPrincipalSidebar = document.createElement('div');
        filaPrincipalSidebar.style.display = 'flex';
        filaPrincipalSidebar.style.justifyContent = 'space-between';
        filaPrincipalSidebar.style.alignItems = 'center';
        filaPrincipalSidebar.innerHTML = `
                <span style="color: #ffffff; font-weight: 500; font-size: 14px;">${item.cantidad}x ${item.producto}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: var(--accent-gold); font-weight: 600; font-size: 14px;">$${subtotal.toLocaleString('es-AR')}</span>
                    <button class="btn-eliminar-sidebar" data-index="${index}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 13px; padding: 0 4px;">✕</button>
                </div>
            `;
        itemDivSidebar.appendChild(filaPrincipalSidebar);

        // Lógica de gustos desglosados (se aplica a ambas vistas)
        if (item.gustos && item.gustos.length > 0) {
            const generarHTMLGustos = () => {
                const contenedor = document.createElement('div');
                contenedor.style.fontSize = '12px';
                contenedor.style.color = '#a1a1aa';
                contenedor.style.marginTop = '4px';
                contenedor.style.paddingLeft = '15px';
                contenedor.style.lineHeight = '1.4';
                const lineasGustos = item.gustos.map(g => `<span style="color: #e4e4e7;">${g.componente}:</span> ${g.sabor}`);
                contenedor.innerHTML = lineasGustos.join('<br>');
                return contenedor;
            };

            itemDivCheckout.appendChild(generarHTMLGustos());
            itemDivSidebar.appendChild(generarHTMLGustos());
        }

        if (carritoItemsDiv) carritoItemsDiv.appendChild(itemDivCheckout);
        if (sidebarItemsDiv) sidebarItemsDiv.appendChild(itemDivSidebar);
    });

    // Si hay costo de envío activo, añadirlo a ambas vistas
    if (costoEnvio > 0) {
        const generarHTMLEnvio = () => {
            const divEnvio = document.createElement('div');
            divEnvio.style.display = 'flex';
            divEnvio.style.justifyContent = 'space-between';
            divEnvio.style.fontSize = '13px';
            divEnvio.style.color = '#a1a1aa';
            divEnvio.style.marginTop = '8px';
            divEnvio.style.borderTop = '1px dashed #3f3f46';
            divEnvio.style.paddingTop = '8px';
            divEnvio.innerHTML = `
                    <span>🛵 Costo de Envío</span>
                    <span>$${costoEnvio.toLocaleString('es-AR')}</span>
                `;
            return divEnvio;
        };
        if (carritoItemsDiv) carritoItemsDiv.appendChild(generarHTMLEnvio());
        if (sidebarItemsDiv) sidebarItemsDiv.appendChild(generarHTMLEnvio());
    }

    const totalGeneral = totalProductos + costoEnvio;
    if (carritoTotalSpan) carritoTotalSpan.innerText = `$${totalGeneral.toLocaleString('es-AR')}`;
    if (sidebarTotalSpan) sidebarTotalSpan.innerText = `$${totalGeneral.toLocaleString('es-AR')}`;

    // Asignar escuchadores de eliminación en el Checkout tradicional
    const botonesEliminar = carritoItemsDiv.querySelectorAll('.btn-eliminar');
    botonesEliminar.forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            carrito.splice(idx, 1);
            actualizarInterfazCarrito();
        });
    });

    // Asignar escuchadores de eliminación en el Sidebar flotante
    const botonesEliminarSidebar = sidebarItemsDiv.querySelectorAll('.btn-eliminar-sidebar');
    botonesEliminarSidebar.forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-index'));
            carrito.splice(idx, 1);
            actualizarInterfazCarrito();
        });
    });
}

// 3. Procesar el envío del Formulario y Pasarela WhatsApp
if (formularioPedido) {
    formularioPedido.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (carrito.length === 0) {
            alert('Por favor, agrega al menos un producto al carrito antes de finalizar.');
            return;
        }

        const nombre = document.getElementById('nombre').value;
        const telefonoInput = document.getElementById('telefono').value;
        const direccion = document.getElementById('direccion').value;

        const tipoEntrega = document.querySelector('input[name="tipo_entrega"]:checked').value;
        const textoEntrega = tipoEntrega === 'envio' ? 'Envío a Domicilio' : 'Retiro por el Local';

        const totalGeneral = totalProductos + costoEnvio;

        const datosPedido = {
            cliente: { nombre, telefono: telefonoInput, direccion },
            items: carrito,
            tipoEntrega: tipoEntrega,
            costoEnvio: costoEnvio,
            total: totalGeneral
        };

        // ... (Toda la primera parte del formulario queda exactamente igual) ...
        try {
            const respuesta = await fetch('https://web-sabor-sazon.onrender.com/api/pedidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosPedido)
            });

            const resultado = await respuesta.json();

            if (resultado.success) {
                let mensajeWA = `*NUEVO PEDIDO - SABOR & SAZÓN*\n`;
                mensajeWA += `_ID de Orden: ${resultado.pedidoId}_\n\n`;
                mensajeWA += `*Cliente:* ${nombre}\n`;
                mensajeWA += `*Teléfono:* ${telefonoInput}\n`;
                mensajeWA += `*Método:* ${textoEntrega}\n`;

                if (tipoEntrega === 'envio') {
                    mensajeWA += `*Dirección:* ${direccion}\n\n`;
                } else {
                    mensajeWA += `\n`;
                }

                mensajeWA += `*Detalle de la compra:*\n`;
                carrito.forEach(item => {
                    mensajeWA += `• ${item.cantidad}x *${item.producto}* ($${(item.precio * item.cantidad).toLocaleString('es-AR')})\n`;
                    if (item.gustos && item.gustos.length > 0) {
                        item.gustos.forEach(g => {
                            mensajeWA += `   └ _${g.componente}: ${g.sabor}_\n`;
                        });
                    }
                });

                if (costoEnvio > 0) {
                    mensajeWA += `• *Costo de Envío:* $${costoEnvio.toLocaleString('es-AR')}\n`;
                }

                // Cambiamos el mensaje para reflejar que ya se pagó electrónicamente
                mensajeWA += `\n*Total General Pagado:* $${totalGeneral.toLocaleString('es-AR')}\n\n`;
                mensajeWA += `¡Ya realicé el pago de forma online por Mercado Pago!`;

                const mensajeCodificado = encodeURIComponent(mensajeWA);
                const numeroNegocio = "541125523930";
                const urlWhatsApp = `https://wa.me/${numeroNegocio}?text=${mensajeCodificado}`;


                // 1. Guardamos la URL de WhatsApp en memoria para usarla al regresar del pago
                localStorage.setItem('pending_whatsapp_url', urlWhatsApp);

                // 2. Limpiamos las variables locales y reseteamos el formulario antes de irnos
                carrito = [];
                costoEnvio = 0;
                actualizarInterfazCarrito();
                formularioPedido.reset();
                const inputDireccion = document.getElementById('direccion');
                if (inputDireccion) inputDireccion.required = false;

                // 3. Avisamos al usuario y lo mandamos de una al Checkout de Mercado Pago
                alert('¡Pedido guardado! Redirigiendo a Mercado Pago para completar tu pago...');
                window.location.href = resultado.initPoint; // <--- Abre Mercado Pago en la misma pestaña


            } else {
                alert('Hubo un error en el servidor al procesar la orden.');
            }
        } catch (error) {
            console.error('Error de red:', error);
            alert('No se pudo conectar con el servidor backend.');
        }
    });
}

/* ==========================================================================
   LÓGICA DEL MENÚ HAMBURGUESA (UNIFICADA COMPLETA)
   ========================================================================== */
const menuToggle = document.getElementById("mobile-menu-btn");
const navLinks = document.getElementById("nav-menu-links");

if (menuToggle && navLinks) {
    menuToggle.addEventListener("click", () => {
        navLinks.classList.toggle("active");
    });

    const links = navLinks.querySelectorAll("a");
    links.forEach(link => {
        link.addEventListener("click", () => {
            navLinks.classList.remove("active");
        });
    });
}
/* ==========================================================================
       LÓGICA DE APERTURA Y CIERRE DEL PANEL LATERAL (SIDEBAR)
       ========================================================================== */
const floatingBtn = document.getElementById('cart-floating-btn');
const sidebarCart = document.getElementById('cart-sidebar');
const closeSidebarBtn = document.getElementById('cart-sidebar-close');
const cartOverlay = document.getElementById('cart-overlay');
const checkoutLink = document.getElementById('btn-sidebar-checkout');

function abrirSidebar() {
    if (sidebarCart && cartOverlay) {
        sidebarCart.classList.add('open');
        cartOverlay.classList.add('open');
    }
}

function cerrarSidebar() {
    if (sidebarCart && cartOverlay) {
        sidebarCart.classList.remove('open');
        cartOverlay.classList.remove('open');
    }
}

if (floatingBtn) floatingBtn.addEventListener('click', abrirSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', cerrarSidebar);
if (cartOverlay) cartOverlay.addEventListener('click', cerrarSidebar);

// Al hacer clic en "Completar Datos", cerramos el panel para que el cliente pueda ver el formulario libremente
if (checkoutLink) checkoutLink.addEventListener('click', cerrarSidebar);
});