# RutaTrack - Front-end

RutaTrack es una aplicación web para llevar el seguimiento de pedidos y rutas de entrega. Esta es la parte del front-end, hecha con HTML, CSS y JavaScript sin frameworks, y está basada en el documento de diseño que entregamos en la actividad anterior.

Por ahora la aplicación no se conecta a un back-end. Los datos iniciales están en archivos JSON dentro de la carpeta `data` y todo lo que se modifica (pedidos nuevos, cambios de estado, repartidores, usuarios) se guarda en el navegador, así que los cambios se mantienen aunque se recargue la página. Si se quiere volver a los datos originales, en el menú lateral está la opción "Restablecer datos de prueba".

## Cómo abrirlo

Como el proyecto usa módulos de JavaScript y carga los JSON con fetch, no funciona abriendo el HTML con doble clic; hay que abrirlo desde un servidor local. La forma más fácil es con la extensión Live Server de VS Code (clic derecho en `index.html` y "Open with Live Server"). También sirve `npx serve .` o `python -m http.server 8080`.

## Usuarios para probar

- Administrador: admin@rutatrack.com / Admin123
- Operador: operador@rutatrack.com / Operador123
- Repartidor: juan@rutatrack.com / Repartidor123

En la pantalla de login hay accesos rápidos para entrar con cada uno.

## Qué se puede hacer

El operador (y el administrador) ve un panel con todos los pedidos, cuántos hay en cada estado, y puede buscarlos o filtrarlos por estado, repartidor o rango de fechas. Desde ahí puede crear pedidos, editarlos, eliminarlos (solo si están pendientes o cancelados) y entrar al detalle de cada uno, donde se cambia el estado, se asigna o reasigna el repartidor y se ve la línea de tiempo con todo lo que le ha pasado al pedido. También hay un mapa con el destino y la última ubicación reportada por el repartidor, junto con la distancia aproximada.

En la sección de repartidores se registran, editan y eliminan, y se ve cuántos pedidos activos tiene cada uno frente a su capacidad. No se le puede asignar un pedido a alguien que ya llegó a su límite, ni eliminar un repartidor que todavía tiene entregas pendientes.

El administrador además puede crear usuarios, asignarles un rol y activarlos o desactivarlos.

El repartidor tiene una vista pensada para el celular donde solo ve sus pedidos. Desde ahí inicia la ruta, confirma la entrega y registra su ubicación (usa la ubicación del navegador; si no se da el permiso, se toma una posición de prueba en Bogotá).

Por último, cualquier persona puede consultar el estado de un pedido sin iniciar sesión, solo con el código de seguimiento (por ejemplo PED-00120).

Los estados siguen este orden: Pendiente, Asignado, En tránsito y Entregado. Un pedido se puede cancelar mientras esté pendiente o asignado, y cada cambio queda registrado con la fecha, la hora y el usuario que lo hizo.

## Validaciones

Todos los formularios se validan antes de enviarse y el error aparece debajo del campo correspondiente. Se revisan los campos obligatorios, el formato del correo, que el teléfono tenga 10 dígitos, que el documento solo tenga números, el formato de la placa, que la capacidad esté entre 1 y 10, el largo de la descripción, que la contraseña tenga mínimo 8 caracteres con letras y números y que coincida con la confirmación, que la fecha final del filtro no sea anterior a la inicial y el formato del código de seguimiento. También se muestran errores como un correo o documento ya registrado.

## Organización del proyecto

Cada pantalla tiene su propio archivo HTML en la raíz y su lógica en `js/pages`. Lo que se comparte entre pantallas está en `js`: `api.js` simula las peticiones al servidor y aplica las reglas del negocio, `validaciones.js` tiene las reglas de los formularios, `layout.js` arma el menú según el rol y controla el acceso, `ui.js` tiene funciones de apoyo para la interfaz, `sesion.js` maneja la sesión, `mapa.js` dibuja el mapa con Leaflet y `config.js` guarda la configuración general. Los estilos están en `css/estilos.css` y se adaptan a pantallas pequeñas: en el celular el menú se convierte en un botón y las tablas se muestran como tarjetas.

## Despliegue

El sitio está publicado en Vercel a partir del repositorio de GitHub. Como es un sitio estático no necesita comando de build; basta con importar el repositorio en Vercel, dejar el framework como "Other" y desplegar.

Para la siguiente fase, cuando el back-end esté listo, solo hay que cambiar `USE_MOCK` a `false` en `js/config.js` y poner la URL de la API en `API_BASE_URL`.
