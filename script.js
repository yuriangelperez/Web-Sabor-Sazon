document.addEventListener('DOMContentLoaded', () => {
    // Apuntamos á túa URL real
    fetch('https://web-sabor-sazon.onrender.com/api/pedidos')
        .then(() => console.log('Backend despertado exitosamente.'))
        .catch(err => console.log('El backend está arrancando...'));

    // Estado del carrito en memoria
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

            if (gustosElegidos.length === 0) {
                const nombreMinuscula = producto.toLowerCase();
                let saborDetectado = "Tradicional";
                
                if (nombreMinuscula.includes('pollo')) saborDetectado = 'Pollo';
                else if (nombreMinuscula.includes('carne')) saborDetectado = 'Carne';
                else if (nombreMinuscula.includes('queso')) saborDetectado = 'Queso';
                else if (nombreMinuscula.includes('porotos')) saborDetectado = 'Porotos';

                gustosElegidos.push({
                    componente: "Sabor",
                    sabor: saborDetectado
                });
            }
            // --------------------------------------

            const itemExistente = carrito.find(item => 
                item.producto === producto && 
                JSON.stringify(item.gustos) === JSON.stringify(gustosElegidos)
            );

            if (itemExistente) {
                itemExistente.cantidad += 1;
            } else {
                carrito.push({ 
                    producto, 
                    cantidad: 1, 
                    precio, 
                    gustos: gustosElegidos 
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
                    inputDireccion.value = ""; // Limpiamos si escribió algo
                }
            }
            // Refrescamos el total visual inmediatamente
            const totalGeneral = totalProductos + costoEnvio;
            carritoTotalSpan.innerText = `$${totalGeneral.toLocaleString('es-AR')}`;
        }
    });

    // 2. Función para redibujar el resumen del pedido ("Tu Pedido")
    function actualizarInterfazCarrito() {
        if (carrito.length === 0) {
            carritoItemsDiv.innerHTML = '<p>El carrito está vacío. ¡Agrega tus arepas o combos favoritos!</p>';
            carritoTotalSpan.innerText = '$0';
            totalProductos = 0;
            return;
        }

        carritoItemsDiv.innerHTML = '';
        totalProductos = 0;

        carrito.forEach((item, index) => {
            const subtotal = item.precio * item.cantidad;
            totalProductos += subtotal;

            const itemDiv = document.createElement('div');
            itemDiv.style.marginBottom = '14px';

            const filaPrincipal = document.createElement('div');
            filaPrincipal.style.display = 'flex';
            filaPrincipal.style.justify = 'space-between';
            filaPrincipal.style.alignItems = 'center';
            filaPrincipal.innerHTML = `
                <span style="color: #ffffff; font-weight: 500;">${item.cantidad}x ${item.producto}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="color: #ffffff; font-weight: 600;">$${subtotal.toLocaleString('es-AR')}</span>
                    <button class="btn-eliminar" data-index="${index}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 13px; padding: 0 4px;">✕</button>
                </div>
            `;
            itemDiv.appendChild(filaPrincipal);

            if (item.gustos && item.gustos.length > 0) {
                const contenedorGustos = document.createElement('div');
                contenedorGustos.style.fontSize = '12px';
                contenedorGustos.style.color = '#a1a1aa';
                contenedorGustos.style.marginTop = '4px';
                contenedorGustos.style.paddingLeft = '20px';
                contenedorGustos.style.lineHeight = '1.4';

                const lineasGustos = item.gustos.map(g => `<span style="color: #e4e4e7;">${g.componente}:</span> ${g.sabor}`);
                contenedorGustos.innerHTML = lineasGustos.join('<br>');
                
                itemDiv.appendChild(contenedorGustos);
            }

            carritoItemsDiv.appendChild(itemDiv);
        });

        // Si hay un costo de envío activo, lo añadimos visualmente como un ítem extra abajo del todo
        if (costoEnvio > 0) {
            const divEnvio = document.createElement('div');
            divEnvio.style.display = 'flex';
            divEnvio.style.justify = 'space-between';
            divEnvio.style.fontSize = '13px';
            divEnvio.style.color = '#a1a1aa';
            divEnvio.style.marginTop = '8px';
            divEnvio.style.borderTop = '1px dashed #3f3f46';
            divEnvio.style.paddingTop = '8px';
            divEnvio.innerHTML = `
                <span>🛵 Costo de Envío</span>
                <span>$${costoEnvio.toLocaleString('es-AR')}</span>
            `;
            carritoItemsDiv.appendChild(divEnvio);
        }

        const totalGeneral = totalProductos + costoEnvio;
        carritoTotalSpan.innerText = `$${totalGeneral.toLocaleString('es-AR')}`;

        const botonesEliminar = carritoItemsDiv.querySelectorAll('.btn-eliminar');
        botonesEliminar.forEach(btn => {
            btn.addEventListener('click', (e) => {
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
        const textoEntrega = tipoEntrega === 'envio' ? '🛵 Envío a Domicilio' : '🏃‍♂️ Retiro por el Local';

        const totalGeneral = totalProductos + costoEnvio;

        const datosPedido = {
            cliente: { nombre, telefono: telefonoInput, direccion },
            items: carrito,
            tipoEntrega: tipoEntrega,
            costoEnvio: costoEnvio,
            total: totalGeneral
        };

        try {
            // 👇 CAMBIAMOS ESTA LÍNEA CON TU URL REAL DE RENDER 👇
            const respuesta = await fetch('https://web-sabor-sazon.onrender.com/api/pedidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosPedido)
            });

            const resultado = await respuesta.json();
            // ... (el resto del código sigue exactamente igual)

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
                        mensajeWA += `• 🛵 *Costo de Envío:* $${costoEnvio.toLocaleString('es-AR')}\n`;
                    }
                    
                    mensajeWA += `\n*Total General a Pagar:* $${totalGeneral.toLocaleString('es-AR')}\n\n`;
                    mensajeWA += `¿Me pasas los datos para el pago? ¡Muchas gracias!`;

                    const mensajeCodificado = encodeURIComponent(mensajeWA);
                    const numeroNegocio = "541125523930"; 
                    const urlWhatsApp = `https://wa.me/${numeroNegocio}?text=${mensajeCodificado}`;

                    alert('¡Pedido guardado en el sistema! Redirigiendo a WhatsApp para procesar el pago...');
                    window.open(urlWhatsApp, '_blank');

                    // Resetear todo
                    carrito = [];
                    costoEnvio = 0;
                    actualizarInterfazCarrito();
                    formularioPedido.reset();
                    
                    // Volver a dejar la dirección por defecto opcional
                    const inputDireccion = document.getElementById('direccion');
                    if (inputDireccion) inputDireccion.required = false;
                    
                } else {
                    alert('Hubo un error en el servidor al procesar la orden.');
                }

            } catch (error) {
                console.error('Error de red:', error);
                alert('No se pudo conectar con el servidor backend.');
            }
        });
    }
});