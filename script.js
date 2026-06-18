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

            // Verificar si ya existe en el carrito para sumar cantidad
            const itemExistente = carrito.find(item => item.producto === producto);
            if (itemExistente) {
                itemExistente.cantidad += 1;
            } else {
                carrito.push({ producto, cantidad: 1, precio });
            }

            actualizarInterfazCarrito();
        }
    });

    // 2. Función para redibujar el resumen del pedido
    function actualizarInterfazCarrito() {
        if (carrito.length === 0) {
            carritoItemsDiv.innerHTML = '<p>El carrito está vacío. ¡Agrega tus arepas o combos favoritos!</p>';
            carritoTotalSpan.innerText = '$0';
            total = 0;
            return;
        }

        carritoItemsDiv.innerHTML = '';
        total = 0;

        carrito.forEach(item => {
            const subtotal = item.precio * item.cantidad;
            total += subtotal;

            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.justify = 'space-between';
            div.style.marginBottom = '8px';
            div.innerHTML = `
                <span>${item.cantidad}x ${item.producto} </span>...
                <span> $${subtotal.toLocaleString('es-AR')}</span>
            `;
            carritoItemsDiv.appendChild(div);
        });

        carritoTotalSpan.innerText = `$${total.toLocaleString('es-AR')}`;
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

            // Estructura limpia para MongoDB
            const datosPedido = {
                cliente: { nombre, telefono: telefonoInput, direccion },
                items: carrito,
                total: total
            };

            try {
                // Guardar en la Base de Datos local (Puerto 5000)
                const respuesta = await fetch('http://127.0.0.1:5000/api/pedidos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(datosPedido)
                });

                const resultado = await respuesta.json();

                if (resultado.success) {
                    // Armar el texto ordenado para tu WhatsApp de Sabor & Sazón
                    let mensajeWA = `*NUEVO PEDIDO - SABOR & SAZÓN*\n`;
                    mensajeWA += `_ID de Orden: ${resultado.pedidoId}_\n\n`;
                    mensajeWA += `*Cliente:* ${nombre}\n`;
                    mensajeWA += `*Teléfono:* ${telefonoInput}\n`;
                    mensajeWA += `*Dirección:* ${direccion}\n\n`;
                    mensajeWA += `*Detalle de la compra:*\n`;
                    
                    carrito.forEach(item => {
                        mensajeWA += `• ${item.cantidad}x ${item.producto} ($${(item.precio * item.cantidad).toLocaleString('es-AR')})\n`;
                    });
                    
                    mensajeWA += `\n*Total a Pagar:* $${total.toLocaleString('es-AR')}\n\n`;
                    mensajeWA += `¿Me pasas los datos para el pago? ¡Muchas gracias!`;

                    // Codificar texto para URL
                    const mensajeCodificado = encodeURIComponent(mensajeWA);
                    
                    // Tu número de WhatsApp de destino del negocio
                    const numeroNegocio = "541125523930"; 
                    const urlWhatsApp = `https://wa.me/${numeroNegocio}?text=${mensajeCodificado}`;

                    alert('¡Pedido guardado en el sistema! Redirigiendo a WhatsApp para procesar el pago...');
                    
                    // Abrir pasarela de WhatsApp
                    window.open(urlWhatsApp, '_blank');

                    // Resetear todo
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