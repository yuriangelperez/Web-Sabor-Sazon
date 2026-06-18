document.addEventListener('DOMContentLoaded', () => {
    // Estado del carrito en memoria
    let carrito = [];
    let total = 0;

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
                    // Intentamos buscar una etiqueta descriptiva (ej: "Arepa 1", "Empanada 2") 
                    // que esté asociada al select, o usamos el placeholder/propio contexto.
                    let etiquetaItem = "";
                    
                    // Opción A: Buscar un elemento previo de texto o label
                    const labelPrevio = select.previousElementSibling;
                    if (labelPrevio && (labelPrevio.tagName === 'LABEL' || labelPrevio.tagName === 'SPAN')) {
                        etiquetaItem = labelPrevio.innerText.replace(':', '').trim();
                    } else {
                        // Opción B: Si es un combo de Arepas, deducimos de manera genérica por su orden
                        // Puedes ajustar estos nombres fijos si tus combos mezclan productos
                        if (producto.toLowerCase().includes('zulia')) {
                            etiquetaItem = `Arepa ${index + 1}`;
                        } else if (producto.toLowerCase().includes('maracay')) {
                            // Maracay trae 2 arepas y 2 empanadas según tu menú
                            etiquetaItem = index < 2 ? `Arepa ${index + 1}` : `Empanada ${index - 1}`;
                        } else if (producto.toLowerCase().includes('vargas')) {
                            etiquetaItem = `Empanada ${index + 1}`;
                        } else {
                            etiquetaItem = `Ítem ${index + 1}`;
                        }
                    }

                    gustosElegidos.push({
                        componente: etiquetaItem, // Ejemplo: "Arepa 1"
                        sabor: select.value       // Ejemplo: "Pollo"
                    });
                });
            }

            // Si NO hay selectores dinámicos (es un producto individual como una arepa suelta)
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

            // Para verificar si ya existe el ítem idéntico (mismo producto y mismos gustos específicos)
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
                    gustos: gustosElegidos // Estructura: [{componente: "Arepa 1", sabor: "Carne"}, ...]
                });
            }

            actualizarInterfazCarrito();
        }
    });

    // 2. Función para redibujar el resumen del pedido ("Tu Pedido")
    function actualizarInterfazCarrito() {
        if (carrito.length === 0) {
            carritoItemsDiv.innerHTML = '<p>El carrito está vacío. ¡Agrega tus arepas o combos favoritos!</p>';
            carritoTotalSpan.innerText = '$0';
            total = 0;
            return;
        }

        carritoItemsDiv.innerHTML = '';
        total = 0;

        carrito.forEach((item, index) => {
            const subtotal = item.precio * item.cantidad;
            total += subtotal;

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

            // Renderizar cada sub-elemento estructurado
            if (item.gustos && item.gustos.length > 0) {
                const contenedorGustos = document.createElement('div');
                contenedorGustos.style.fontSize = '12px';
                contenedorGustos.style.color = '#a1a1aa';
                contenedorGustos.style.marginTop = '4px';
                contenedorGustos.style.paddingLeft = '20px';
                contenedorGustos.style.lineHeight = '1.4';

                // Mapeamos el array para mostrar "Arepa 1: Carne | Arepa 2: Pollo"
                const lineasGustos = item.gustos.map(g => `<span style="color: #e4e4e7;">${g.componente}:</span> ${g.sabor}`);
                contenedorGustos.innerHTML = lineasGustos.join('<br>');
                
                itemDiv.appendChild(contenedorGustos);
            }

            carritoItemsDiv.appendChild(itemDiv);
        });

        carritoTotalSpan.innerText = `$${total.toLocaleString('es-AR')}`;

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

            const datosPedido = {
                cliente: { nombre, telefono: telefonoInput, direccion },
                items: carrito,
                total: total
            };

            try {
                const respuesta = await fetch('https://sabor-y-sazon-backend.onrender.com/api/pedidos', {
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
                    mensajeWA += `*Dirección:* ${direccion}\n\n`;
                    mensajeWA += `*Detalle de la compra:*\n`;
                    
                    carrito.forEach(item => {
                        mensajeWA += `• ${item.cantidad}x *${item.producto}* ($${(item.precio * item.cantidad).toLocaleString('es-AR')})\n`;
                        if (item.gustos && item.gustos.length > 0) {
                            item.gustos.forEach(g => {
                                mensajeWA += `   └ _${g.componente}: ${g.sabor}_\n`;
                            });
                        }
                    });
                    
                    mensajeWA += `\n*Total a Pagar:* $${total.toLocaleString('es-AR')}\n\n`;
                    mensajeWA += `¿Me pasas los datos para el pago? ¡Muchas gracias!`;

                    const mensajeCodificado = encodeURIComponent(mensajeWA);
                    const numeroNegocio = "541125523930"; 
                    const urlWhatsApp = `https://wa.me/${numeroNegocio}?text=${mensajeCodificado}`;

                    alert('¡Pedido guardado en el sistema! Redirigiendo a WhatsApp para procesar el pago...');
                    window.open(urlWhatsApp, '_blank');

                    carrito = [];
                    actualizarInterfazCarrito();
                    formularioPedido.reset();
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