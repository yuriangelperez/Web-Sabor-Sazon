document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'https://web-sabor-sazon.onrender.com';

    // --- NUEVO: DETECTAR SI EL CLIENTE VUELVE DE PAGAR ---
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');

    if (status === 'success') {
        const urlWA = localStorage.getItem('pending_whatsapp_url');
        if (urlWA) {
            localStorage.removeItem('pending_whatsapp_url');
            alert('¡Pago aprobado con éxito! Redirigiendo a WhatsApp para avisar al local...');
            window.open(urlWA, '_self');
        }
    } else if (status === 'failure') {
        alert('El pago no pudo procesarse o fue cancelado. Por favor, intenta de nuevo o comunícate con nosotros.');
    }

    // Estado del carrito en memoria
    let carrito = [];
    let totalProductos = 0;
    let costoEnvio = 0;

    const carritoItemsDiv = document.getElementById('carrito-items');
    const carritoTotalSpan = document.getElementById('carrito-total');
    const formularioPedido = document.getElementById('form-pedido');
    const bannerEstado = document.getElementById('local-estado-banner');
    const botonesAgregar = Array.from(document.querySelectorAll('.btn-agregar'));

    const imagenesPorProducto = {
        'Combo Zulia': 'files/comboZulia.jpg',
        'Combo Maracay': 'files/comboMaracay.png',
        'Combo Caracas': 'files/comboCaracas.jpg',
        'Combo Vargas': 'files/comboVargas.jpg',
        'Arepa de Pollo': 'files/arepaPollo.jpeg',
        'Arepa de Queso': 'files/arepaQueso.jpeg',
        'Arepa Carne Mechada': 'files/arepaCarneMechada.jpg',
        'Arepa Dominó': 'files/arepaDomino.jpeg',
        'Arepa Catira': 'files/arepaCatira.jpeg',
        'Arepa Pelúa': 'files/arepaPeluda.jpeg',
        'Arepa Pabellón': 'files/arepaPabellon.jpg',
        'Empanada Pollo': 'files/empanadaPollo.jpeg',
        'Empanada Queso': 'files/empanadaQueso.jpg',
        'Empanada Carne Mechada': 'files/empanadaCarne.jpeg',
        'Empanada Porotos': 'files/empanadasPorotos.jpg',
        'Empanada Dominó': 'files/empanadasPorotosQueso.jpg.jpg',
        'Empanada Catira': 'files/empanadaPolloQueso.jpg',
        'Empanada Pelúa': 'files/empanadaCarneQueso.jpg',
        'Empanada Pabellón': 'files/empanadaPabellon.jpg',
        'Tequeños Fritos x12': 'files/tequenios12.jpeg',
        'Tequeños Fritos x6': 'files/tequenios12.jpeg',
        'Tequeños Congelados x12': 'files/tequenios12.jpeg',
        'Tequeños Congelados x6': 'files/tequenios12.jpeg',
        'Tequeños Fritos Promoción x8': 'files/tequenios12.jpeg',
        'Tequeños x20': 'files/tequenios20.jpg'
    };

    const imagenFallback = 'files/1.jpg';
    let modalImagenProducto = null;
    let tituloModalImagen = null;
    let imagenModalProducto = null;
    let localAbierto = true;

    function obtenerImagenPorProducto(producto) {
        return imagenesPorProducto[producto] || imagenFallback;
    }

    function abrirModalImagen(producto) {
        if (!modalImagenProducto || !tituloModalImagen || !imagenModalProducto) return;

        tituloModalImagen.innerText = producto || 'Imagen del producto';
        imagenModalProducto.src = obtenerImagenPorProducto(producto);
        imagenModalProducto.alt = `Imagen de ${producto}`;
        modalImagenProducto.classList.add('is-open');
        document.body.style.overflow = 'hidden';
    }

    function cerrarModalImagen() {
        if (!modalImagenProducto) return;
        modalImagenProducto.classList.remove('is-open');
        document.body.style.overflow = '';
    }

    function inicializarBotonesVerImagen() {
        botonesAgregar.forEach((btnAgregar) => {
            const producto = btnAgregar.getAttribute('data-producto');
            if (!producto || btnAgregar.previousElementSibling?.classList.contains('btn-ver-imagen')) return;

            const btnVerImagen = document.createElement('button');
            btnVerImagen.type = 'button';
            btnVerImagen.className = 'btn-ver-imagen';
            btnVerImagen.setAttribute('data-producto', producto);
            btnVerImagen.innerText = 'Ver imagen';

            btnAgregar.parentNode.insertBefore(btnVerImagen, btnAgregar);
        });

        const modal = document.createElement('div');
        modal.id = 'modal-imagen-producto';
        modal.className = 'modal-imagen-producto';
        modal.innerHTML = `
            <div class="modal-imagen-producto__contenido" role="dialog" aria-modal="true" aria-label="Vista previa del producto">
                <button type="button" class="modal-imagen-producto__cerrar" aria-label="Cerrar">✕</button>
                <h4 class="modal-imagen-producto__titulo"></h4>
                <div class="modal-imagen-producto__cuadro">
                    <img class="modal-imagen-producto__img" src="" alt="">
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        modalImagenProducto = modal;
        tituloModalImagen = modal.querySelector('.modal-imagen-producto__titulo');
        imagenModalProducto = modal.querySelector('.modal-imagen-producto__img');

        const botonCerrar = modal.querySelector('.modal-imagen-producto__cerrar');
        if (botonCerrar) botonCerrar.addEventListener('click', cerrarModalImagen);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) cerrarModalImagen();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalImagenProducto?.classList.contains('is-open')) {
                cerrarModalImagen();
            }
        });
    }

    function aplicarEstadoLocalEnUI(abierto) {
        const btnSubmit = formularioPedido ? formularioPedido.querySelector('button[type="submit"]') : null;
        localAbierto = abierto;

        botonesAgregar.forEach((btn) => {
            btn.disabled = !abierto;
            btn.style.opacity = abierto ? '1' : '0.55';
            if (!abierto) {
                btn.dataset.textoOriginal = btn.dataset.textoOriginal || btn.innerText;
                btn.innerText = 'Local cerrado';
            } else if (btn.dataset.textoOriginal) {
                btn.innerText = btn.dataset.textoOriginal;
            }
        });

        if (btnSubmit) {
            btnSubmit.disabled = !abierto;
            btnSubmit.innerText = abierto ? 'Confirmar y Pagar' : 'Local cerrado';
            btnSubmit.style.backgroundColor = abierto ? '' : '#555';
        }

        if (bannerEstado) {
            bannerEstado.textContent = abierto
                ? ''
                : 'El local se encuentra cerrado por el momento. Volve mas tarde para realizar pedidos.';
            bannerEstado.classList.toggle('hidden', abierto);
        }
    }

    async function consultarEstadoLocal() {
        try {
            const res = await fetch(`${API_BASE}/api/estado-local`);
            const data = await res.json();
            if (data.success) {
                const abierto = Boolean(data.abierto);
                aplicarEstadoLocalEnUI(abierto);
                if (!abierto && bannerEstado) {
                    bannerEstado.textContent = data.fueraDeHorario
                        ? `El local está cerrado por el momento. Nuestro horario de atención es de ${data.horario || '10:00 - 22:00'} hs.`
                        : 'El local se encuentra cerrado por el momento. Volve mas tarde para realizar pedidos.';
                    bannerEstado.classList.remove('hidden');
                }
                return abierto;
            }
        } catch (error) {
            console.error('No se pudo consultar estado del local:', error);
        }
        return localAbierto;
    }

    consultarEstadoLocal();
    inicializarBotonesVerImagen();

    // 1. MANEJADOR DE CLICS (Agregar productos y soporte para botones visuales de entrega/pago)
    document.addEventListener('click', (e) => {
        const botonVerImagen = e.target.closest('.btn-ver-imagen');
        if (botonVerImagen) {
            const producto = botonVerImagen.getAttribute('data-producto');
            abrirModalImagen(producto);
            return;
        }

        if (e.target && e.target.classList.contains('btn-agregar')) {
            if (!localAbierto) {
                alert('El local está cerrado por el momento. Volvé a intentar más tarde.');
                return;
            }

            const boton = e.target;
            const producto = boton.getAttribute('data-producto');
            const precio = parseInt(boton.getAttribute('data-precio'));

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
                    gustosElegidos.push({ componente: etiquetaItem, sabor: select.value });
                });
            }

            const itemExistente = carrito.find(item =>
                item.producto === producto &&
                JSON.stringify(item.gustos) === JSON.stringify(gustosElegidos)
            );

            if (itemExistente) {
                itemExistente.cantidad += 1;
            } else {
                carrito.push({ producto, cantidad: 1, precio, gustos: gustosElegidos });
            }
            
            // Cambiar el botón a "Agregado" temporalmente
            const textoOriginal = boton.innerText;
            boton.innerText = '✓ Agregado!';
            boton.disabled = true;
            boton.style.opacity = '0.7';
            
            setTimeout(() => {
                boton.innerText = textoOriginal;
                boton.disabled = false;
                boton.style.opacity = '1';
            }, 2000);
            
            actualizarInterfazCarrito();
            return;
        }

        // Soporte para clics en cajas de tarjetas personalizadas (Método de Entrega / Pago)
        const tarjetaEntrega = e.target.closest('.metodo-entrega-card') || e.target.closest('[data-entrega]');
        if (tarjetaEntrega) {
            const radio = tarjetaEntrega.querySelector('input[name="tipo_entrega"]');
            if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        const tarjetaPago = e.target.closest('.metodo-pago-card') || e.target.closest('[data-pago]');
        if (tarjetaPago) {
            const radio = tarjetaPago.querySelector('input[name="metodo_pago"]');
            if (radio) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });

    // 2. ESCUCHAR CAMBIOS EN INPUTS SELECTS Y RADIOS
    document.addEventListener('change', (e) => {
        const inputZona = document.getElementById('zona-entrega'); // ID corregido de zona-entrega
        const contenedorCalle = document.getElementById('contenedor-calle');
        const inputCalle = document.getElementById('direccion-calle');
        const tarjetaEfectivo = document.getElementById('tarjeta-efectivo');
        const inputMercadoPago = document.querySelector('input[name="metodo_pago"][value="mercadopago"]');
        const metodoPagoActivo = document.querySelector('input[name="metodo_pago"]:checked')?.value;
        const botonEnviarPedido = formularioPedido ? formularioPedido.querySelector('button[type="submit"]') : null;
        const datosTransferencia = document.getElementById('datos-transferencia');

        // A. Si cambia entre Envío o Retiro
        if (e.target && e.target.name === 'tipo_entrega') {
            const contenedorZona = document.getElementById('contenedor-zona');

            if (e.target.value === 'envio') {
                costoEnvio = 0; // Empieza en 0 hasta que seleccione la localidad real
                if (contenedorZona) contenedorZona.style.display = 'block'; 
                
                // CORREGIDO: Se cambió 'inputDireccion' por 'inputZona' que sí está definida arriba
                if (inputZona) { 
                    inputZona.required = true;
                    inputZona.value = "";
                }
                if (tarjetaEfectivo) tarjetaEfectivo.style.display = 'none';
                if (metodoPagoActivo === 'efectivo' && inputMercadoPago) {
                    inputMercadoPago.checked = true;
                }
            } else {
                // Si es Retiro, limpiamos el costo de envío y OCULTAMOS ambos contenedores
                costoEnvio = 0;
                if (contenedorZona) contenedorZona.style.display = 'none'; 
                if (contenedorCalle) contenedorCalle.style.display = 'none'; 

                if (inputZona) {
                    inputZona.required = false;
                    inputZona.value = "";
                }
                if (inputCalle) {
                    inputCalle.required = false;
                    inputCalle.value = "";
                }
                if (tarjetaEfectivo) tarjetaEfectivo.style.display = 'flex';

                if (botonEnviarPedido) {
                    botonEnviarPedido.disabled = false;
                    botonEnviarPedido.innerText = "Finalizar Pedido";
                    botonEnviarPedido.style.backgroundColor = "";
                }
            }
            actualizarInterfazCarrito();
        }

        // B. Si cambia la Zona seleccionada en el menú desplegable
        if (e.target && e.target.id === 'zona-entrega') { 
            const valorSeleccionado = e.target.value;

            if (valorSeleccionado === "no-delivery") {
                alert("⚠️ Por el momento Sabor & Sazón no realiza envíos fuera de Manuel Alberti, Del Viso o Tortuguitas. Podés cambiar el método a 'Retiro por el local'.");
                costoEnvio = 0;
                if (contenedorCalle) contenedorCalle.style.display = 'none';
                if (inputCalle) {
                    inputCalle.required = false;
                    inputCalle.value = "";
                }

                if (botonEnviarPedido) {
                    botonEnviarPedido.disabled = true;
                    botonEnviarPedido.innerText = "Zona no disponible";
                    botonEnviarPedido.style.backgroundColor = "#555";
                }
            } else if (valorSeleccionado !== "") {
                if (botonEnviarPedido) {
                    botonEnviarPedido.disabled = false;
                    botonEnviarPedido.innerText = "Finalizar Pedido";
                    botonEnviarPedido.style.backgroundColor = "";
                }

                // Asignamos el costo real de la zona seleccionada
                costoEnvio = parseInt(valorSeleccionado) || 0;

                if (contenedorCalle) contenedorCalle.style.display = 'block';
                if (inputCalle) inputCalle.required = true;
            } else {
                costoEnvio = 0;
            }
            actualizarInterfazCarrito();
        }

        // C. Cambio del método de pago
        if (e.target && e.target.name === 'metodo_pago') {
            if (datosTransferencia) {
                datosTransferencia.style.display = e.target.value === 'transferencia' ? 'block' : 'none';
            }
            actualizarInterfazCarrito();
        }
    });

    // 3. ACTUALIZAR INTERFAZ Y REDIBUJAR PRECIOS
    function actualizarInterfazCarrito() {
        const sidebarItemsDiv = document.getElementById('cart-sidebar-items');
        const sidebarTotalSpan = document.getElementById('cart-sidebar-total');
        const floatingCountSpan = document.getElementById('cart-floating-count');

        let totalUnidades = 0;
        carrito.forEach(item => totalUnidades += item.cantidad);
        if (floatingCountSpan) floatingCountSpan.innerText = totalUnidades;

        if (carrito.length === 0) {
            const mensajeVacio = '<p class="cart-empty-msg">El carrito está vacío. ¡Agrega tus arepas o combos favoritos!</p>';
            if (carritoItemsDiv) carritoItemsDiv.innerHTML = mensajeVacio;
            if (sidebarItemsDiv) sidebarItemsDiv.innerHTML = mensajeVacio;
            if (carritoTotalSpan) carritoTotalSpan.innerText = '$0';
            if (sidebarTotalSpan) sidebarTotalSpan.innerText = '$0';
            totalProductos = 0;
            return;
        }

        if (carritoItemsDiv) carritoItemsDiv.innerHTML = '';
        if (sidebarItemsDiv) sidebarItemsDiv.innerHTML = '';
        totalProductos = 0;

        carrito.forEach((item, index) => {
            const subtotal = item.precio * item.cantidad;
            totalProductos += subtotal;

            const itemDivCheckout = document.createElement('div');
            itemDivCheckout.style.marginBottom = '14px';
            itemDivCheckout.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #ffffff; font-weight: 500;">${item.cantidad}x ${item.producto}</span>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="color: #ffffff; font-weight: 600;">$${subtotal.toLocaleString('es-AR')}</span>
                        <button type="button" class="btn-eliminar" data-index="${index}" style="background: none; border: none; color: #ef4444; cursor: pointer;">✕</button>
                    </div>
                </div>
            `;

            const itemDivSidebar = document.createElement('div');
            itemDivSidebar.style.marginBottom = '14px';
            itemDivSidebar.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
            itemDivSidebar.style.paddingBottom = '10px';
            itemDivSidebar.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #ffffff; font-weight: 500; font-size: 14px;">${item.cantidad}x ${item.producto}</span>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="color: var(--accent-gold); font-weight: 600; font-size: 14px;">$${subtotal.toLocaleString('es-AR')}</span>
                        <button type="button" class="btn-eliminar-sidebar" data-index="${index}" style="background: none; border: none; color: #ef4444; cursor: pointer;">✕</button>
                    </div>
                </div>
            `;

            if (item.gustos && item.gustos.length > 0) {
                const generarHTMLGustos = () => {
                    const contenedor = document.createElement('div');
                    contenedor.style.fontSize = '12px';
                    contenedor.style.color = '#a1a1aa';
                    contenedor.style.marginTop = '4px';
                    contenedor.style.paddingLeft = '15px';
                    contenedor.innerHTML = item.gustos.map(g => `<span style="color: #e4e4e7;">${g.componente}:</span> ${g.sabor}`).join('<br>');
                    return contenedor;
                };
                itemDivCheckout.appendChild(generarHTMLGustos());
                itemDivSidebar.appendChild(generarHTMLGustos());
            }

            if (carritoItemsDiv) carritoItemsDiv.appendChild(itemDivCheckout);
            if (sidebarItemsDiv) sidebarItemsDiv.appendChild(itemDivSidebar);
        });

        if (costoEnvio > 0) {
            const divEnvio = document.createElement('div');
            divEnvio.style.display = 'flex';
            divEnvio.style.justifyContent = 'space-between';
            divEnvio.style.fontSize = '13px';
            divEnvio.style.color = '#a1a1aa';
            divEnvio.style.marginTop = '8px';
            divEnvio.innerHTML = `<span>🛵 Costo de Envío</span><span>$${costoEnvio.toLocaleString('es-AR')}</span>`;
            if (carritoItemsDiv) carritoItemsDiv.appendChild(divEnvio.cloneNode(true));
            if (sidebarItemsDiv) sidebarItemsDiv.appendChild(divEnvio);
        }

        const metodoPagoActivo = document.querySelector('input[name="metodo_pago"]:checked')?.value;
        let descuento = (metodoPagoActivo === 'efectivo' || metodoPagoActivo === 'transferencia') ? totalProductos * 0.05 : 0;

        if (descuento > 0) {
            const divDesc = document.createElement('div');
            divDesc.style.display = 'flex';
            divDesc.style.justifyContent = 'space-between';
            divDesc.style.color = '#fabb3a';
            divDesc.style.fontSize = '13px';
            divDesc.innerHTML = `<span>🔥 Descuento 5% OFF</span><span>-$${descuento.toLocaleString('es-AR')}</span>`;
            if (carritoItemsDiv) carritoItemsDiv.appendChild(divDesc.cloneNode(true));
            if (sidebarItemsDiv) sidebarItemsDiv.appendChild(divDesc);
        }

        const totalGeneral = (totalProductos - descuento) + costoEnvio;
        if (carritoTotalSpan) carritoTotalSpan.innerText = `$${totalGeneral.toLocaleString('es-AR')}`;
        if (sidebarTotalSpan) sidebarTotalSpan.innerText = `$${totalGeneral.toLocaleString('es-AR')}`;

        if (carritoItemsDiv) {
            carritoItemsDiv.querySelectorAll('.btn-eliminar').forEach(btn => {
                btn.onclick = () => { carrito.splice(parseInt(btn.dataset.index), 1); actualizarInterfazCarrito(); };
            });
        }
        if (sidebarItemsDiv) {
            sidebarItemsDiv.querySelectorAll('.btn-eliminar-sidebar').forEach(btn => {
                btn.onclick = () => { carrito.splice(parseInt(btn.dataset.index), 1); actualizarInterfazCarrito(); };
            });
        }
    }

    function obtenerTotalesActuales() {
        const metodoPagoActivo = document.querySelector('input[name="metodo_pago"]:checked')?.value;
        const descuento = (metodoPagoActivo === 'efectivo' || metodoPagoActivo === 'transferencia') ? totalProductos * 0.05 : 0;
        return { descuento, totalGeneral: (totalProductos - descuento) + costoEnvio };
    }

    // 4. ENVÍO DE FORMULARIO CORRECTO
    if (formularioPedido) {
        formularioPedido.addEventListener('submit', async (e) => {
            e.preventDefault();

            const abiertoAhora = await consultarEstadoLocal();
            if (!abiertoAhora) {
                alert('El local está cerrado por el momento. No se pueden realizar pedidos.');
                return;
            }

            if (carrito.length === 0) {
                alert('Por favor, agrega al menos un producto al carrito antes de finalizar.');
                return;
            }

            const nombre = document.getElementById('nombre').value;
            const telefonoInput = document.getElementById('telefono').value;
            const zonaSelect = document.getElementById('zona-entrega'); 
            const calleInput = document.getElementById('direccion-calle');

            const tipoEntregaChecked = document.querySelector('input[name="tipo_entrega"]:checked');
            const metodoPagoChecked = document.querySelector('input[name="metodo_pago"]:checked');

            const tipoEntrega = tipoEntregaChecked ? tipoEntregaChecked.value : 'retiro';
            const metodoPago = metodoPagoChecked ? metodoPagoChecked.value : 'mercadopago';
            const textoEntrega = tipoEntrega === 'envio' ? 'Envío a Domicilio' : 'Retiro por el Local';

            let direccion = "Retiro por el local";
            if (tipoEntrega === 'envio' && zonaSelect && calleInput) {
                const nombreZona = zonaSelect.options[zonaSelect.selectedIndex].text.split(' (')[0];
                direccion = `${calleInput.value.trim()}, ${nombreZona}`;
            }

            const { totalGeneral, descuento } = obtenerTotalesActuales();

            const datosPedido = {
                cliente: { nombre, telefono: telefonoInput, direccion },
                items: carrito,
                tipoEntrega,
                costoEnvio,
                descuento,
                total: totalGeneral,
                metodoPago
            };

            try {
                const respuesta = await fetch(`${API_BASE}/api/pedidos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datosPedido)
                });

                const resultado = await respuesta.json();

                if (!respuesta.ok && resultado.code === 'LOCAL_CERRADO') {
                    aplicarEstadoLocalEnUI(false);
                    alert('El local se encuentra cerrado. No se aceptan pedidos en este momento.');
                    return;
                }

                if (resultado.success) {
                    let mensajeWA = `*NUEVO PEDIDO - SABOR & SAZÓN*\n`;
                    mensajeWA += `_ID de Orden: ${resultado.pedidoId}_\n\n`;
                    mensajeWA += `*Cliente:* ${nombre}\n`;
                    mensajeWA += `*Teléfono:* ${telefonoInput}\n`;
                    mensajeWA += `*Método:* ${textoEntrega}\n`;
                    if (tipoEntrega === 'envio') mensajeWA += `*Dirección:* ${direccion}\n`;
                    mensajeWA += `\n*Detalle de la compra:*\n`;

                    carrito.forEach(item => {
                        mensajeWA += `• ${item.cantidad}x *${item.producto}* ($${(item.precio * item.cantidad).toLocaleString('es-AR')})\n`;
                        if (item.gustos && item.gustos.length > 0) {
                            item.gustos.forEach(g => mensajeWA += `   └ _${g.componente}: ${g.sabor}_\n`);
                        }
                    });

                    if (costoEnvio > 0) mensajeWA += `• *Costo de Envío:* $${costoEnvio.toLocaleString('es-AR')}\n`;
                    if (descuento > 0) mensajeWA += `• *Descuento (5% Off):* -$${descuento.toLocaleString('es-AR')}\n`;

                    if (metodoPago === 'efectivo') {
                        mensajeWA += `\n*Total a Pagar:* $${totalGeneral.toLocaleString('es-AR')}\n\n¡Abono al retirar!`;
                    } else if (metodoPago === 'transferencia') {
                        mensajeWA += `\n*Total a Transferir:* $${totalGeneral.toLocaleString('es-AR')}\n\n¡Solicito alias bancario!`;
                    } else {
                        mensajeWA += `\n*Total Pagado:* $${totalGeneral.toLocaleString('es-AR')}\n\n¡Pago realizado por Mercado Pago!`;
                    }

                    const urlWhatsApp = `https://wa.me/541125523930?text=${encodeURIComponent(mensajeWA)}`;

                    // --- RESET TOTAL DE INTERFAZ ---
                    carrito = []; costoEnvio = 0;
                    actualizarInterfazCarrito();
                    formularioPedido.reset();

                    const contenedorZona = document.getElementById('contenedor-zona');
                    const contenedorCalle = document.getElementById('contenedor-calle');
                    if (contenedorZona) contenedorZona.style.display = 'none';
                    if (contenedorCalle) contenedorCalle.style.display = 'none';

                    if (zonaSelect) zonaSelect.required = false;
                    if (calleInput) calleInput.required = false;

                    if (metodoPago === 'efectivo' || metodoPago === 'transferencia') {
                        window.open(urlWhatsApp, '_blank');
                        alert('¡Pedido verificado! Mandando detalles a WhatsApp.');
                    } else {
                        localStorage.setItem('pending_whatsapp_url', urlWhatsApp);
                        alert('¡Pedido guardado! Redirigiendo a Mercado Pago...');
                        window.location.href = resultado.initPoint;
                    }
                } else {
                    alert('Hubo un error en el servidor al procesar la orden.');
                }
            } catch (error) {
                console.error('Error de red:', error);
                alert('No se pudo conectar con el backend.');
            }
        });
    }

    // LÓGICA AUXILIAR
    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('btn-copiar')) {
            const elemento = document.getElementById(e.target.dataset.copy);
            try {
                await navigator.clipboard.writeText(elemento.innerText);
                const original = e.target.innerText; e.target.innerText = "✅";
                setTimeout(() => e.target.innerText = original, 1200);
            } catch { alert("No se pudo copiar"); }
        }
    });

    const menuToggle = document.getElementById("mobile-menu-btn");
    const navLinks = document.getElementById("nav-menu-links");
    if (menuToggle && navLinks) {
        menuToggle.onclick = () => navLinks.classList.toggle("active");
        navLinks.querySelectorAll("a").forEach(l => l.onclick = () => navLinks.classList.remove("active"));
    }

    // --- CORRECCIÓN APERTURA Y CIERRE DEL CARRITO SÓLIDA ---
    const floatingBtn = document.getElementById('cart-floating-btn');
    const sidebarCart = document.getElementById('cart-sidebar');
    const closeSidebarBtn = document.getElementById('cart-sidebar-close');
    const cartOverlay = document.getElementById('cart-overlay');
    const checkoutLink = document.getElementById('btn-sidebar-checkout'); // Enlace/Botón interno del checkout

    const abrir = () => { 
        if (sidebarCart) {
            sidebarCart.classList.add('open');
            sidebarCart.style.transform = 'translateX(0)'; // Forzado directo
        }
        if (cartOverlay) {
            cartOverlay.classList.add('open');
            cartOverlay.style.display = 'block'; // Forzado directo
        }
    };

    const cerrar = () => { 
        if (sidebarCart) {
            sidebarCart.classList.remove('open');
            sidebarCart.style.transform = 'translateX(100%)'; // Forzado directo
        }
        if (cartOverlay) {
            cartOverlay.classList.remove('open');
            cartOverlay.style.display = 'none'; // Forzado directo
        }
    };

    if (floatingBtn) floatingBtn.onclick = abrir;
    if (closeSidebarBtn) closeSidebarBtn.onclick = cerrar;
    if (cartOverlay) cartOverlay.onclick = cerrar;
    if (checkoutLink) checkoutLink.onclick = cerrar; // Ahora al darle click a ir a pagar, se cerrará solo.
});