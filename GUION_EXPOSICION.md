# Guion de exposición — Proyecto Final Base de Datos Avanzadas (MongoDB)

Tres guiones, uno por cada video pedido. Están escritos para leerse en voz alta o memorizar puntos clave, con ejemplos concretos tomados del código real del proyecto.

---

# VIDEO 1 (5 min) — Atomicidad, Consistencia, Aislamiento, Durabilidad, Transacciones, Bloqueos

## Introducción (20 seg)

"Voy a explicar cómo mi proyecto, un sistema de club de videos hecho con Node.js y MongoDB, implementa las garantías ACID: Atomicidad, Consistencia, Aislamiento y Durabilidad, además de cómo maneja transacciones y bloqueos. MongoDB no es una base de datos relacional, pero desde la versión 4.0 soporta transacciones ACID multi-documento cuando se usa con un Replica Set, que es justamente como configuré mi base de datos."

## i. Atomicidad (45 seg)

"Atomicidad significa que una operación se ejecuta completa o no se ejecuta en absoluto. El caso más claro en mi sistema es el préstamo de películas: cuando un cliente renta 3 películas, tengo que descontar 3 copias del stock, calcular la tarifa según la fecha de devolución de cada una, crear el registro del préstamo y crear la factura. Son 4 operaciones sobre 3 colecciones distintas: `copies`, `loans` e `invoices`.

Si a mitad de camino, por ejemplo al descontar la segunda copia, resulta que ya no hay stock, TODO el proceso se revierte: la primera copia que sí se descontó vuelve a quedar disponible, y no se crea ni el préstamo ni la factura. Esto lo logro con `session.withTransaction()` de MongoDB, envolviendo todas las operaciones del método `rent()` en una sola transacción. Si cualquier paso lanza un error, MongoDB hace rollback automático de todo lo que se había escrito hasta ese punto."

## ii. Consistencia (40 seg)

"Consistencia significa que la base de datos siempre pasa de un estado válido a otro estado válido, respetando las reglas de negocio. Yo implemento esto en dos capas.

Primero, a nivel de MongoDB, uso `$jsonSchema` validators en cada colección. Por ejemplo, la colección `customers` exige que el teléfono cumpla el patrón de 7 dígitos empezando en 6 o 7, que el email tenga formato válido, y que el campo `blocked` sea booleano. Si alguien intenta insertar un documento que no cumple, MongoDB lo rechaza directamente, sin importar si la app tiene un bug.

Segundo, a nivel de aplicación, valido reglas de negocio más complejas que un schema no puede expresar, como que un cliente bloqueado no pueda rentar, o que la fecha de devolución no supere los días máximos configurados. Esto vive en `rentalService.js`, antes de tocar la base de datos."

## iii. Aislamiento (40 seg)

"Aislamiento significa que transacciones concurrentes no se pisan entre sí. Mi caso de uso crítico es el stock de copias: si dos clientes intentan rentar la última copia disponible de la misma película al mismo tiempo, solo uno debe conseguirla.

Configuré mi conexión con `readConcern: { level: 'snapshot' }` y `writeConcern: { w: 'majority' }`. El nivel `snapshot` hace que cada transacción vea una foto consistente de los datos, aislada de lo que otras transacciones estén escribiendo al mismo tiempo. Si dos transacciones intentan modificar el mismo documento de forma conflictiva, MongoDB aborta una de las dos con un error de conflicto de escritura, y mi código simplemente propaga ese error como 'stock insuficiente'."

## iv. Durabilidad (35 seg)

"Durabilidad significa que una vez que una transacción se confirma, los datos sobreviven aunque el servidor se caiga. Esto lo logro con `writeConcern: { w: 'majority' }`. Mi base de datos corre como un Replica Set de MongoDB, llamado `rs0`, no como una instancia única. `w: majority` significa que una escritura no se considera exitosa hasta que la mayoría de los nodos del replica set la confirmaron en su log de operaciones (el oplog). Así, aunque el nodo primario se caiga justo después de confirmar una renta, el dato ya está replicado y no se pierde."

## v. Transacciones (40 seg)

"Uso transacciones multi-documento explícitas en dos lugares: al rentar películas (`rent()`) y al devolverlas (`returnLoan()`). En ambos casos, abro una sesión con `client.startSession()`, ejecuto varias operaciones sobre distintas colecciones dentro de `session.withTransaction()`, y paso esa misma sesión a cada operación de escritura. Al devolver, por ejemplo, marco el préstamo como devuelto, libero las copias de vuelta a 'disponible', y actualizo la factura, todo en una sola transacción atómica."

## vi. Bloqueos (40 seg)

"MongoDB usa bloqueos optimistas basados en control de concurrencia multiversión, no bloqueos explícitos de fila como en SQL tradicional. En la práctica, esto se traduce en mi método `copies.rentOne()`, que usa `findOneAndUpdate` con un filtro `{ videoId, status: 'available' }`: esta operación es atómica a nivel de documento, así que si dos rentas compiten por la misma copia, MongoDB garantiza que solo una de las dos actualizaciones tenga éxito, sin que yo tenga que gestionar un lock manual. Cuando eso ocurre dentro de una transacción con snapshot, el conflicto se resuelve abortando la transacción perdedora, que mi código reintenta o reporta como error de stock."

## Cierre (10 seg)

"En resumen: atomicidad y aislamiento vía transacciones con sesión, consistencia vía schema validators más reglas de negocio en la app, durabilidad vía replica set con writeConcern majority, y bloqueos manejados de forma optimista por el propio motor de MongoDB."

---

# VIDEO 2 (10 min) — Cómo se resolvieron todos los incidentes / requerimientos del sistema

## Introducción (30 seg)

"Voy a recorrer los tres módulos que pedía el trabajo — gestión de videos, gestión de clientes y gestión de préstamos — explicando cómo cada requerimiento se resolvió en la aplicación, tanto en el backend como en la interfaz."

## Gestión de Videos (2.5 min)

"El primer requerimiento era registrar una película con duración, género, título con títulos alternativos, año, nominaciones y premios Oscar, actores principales, costo unitario del DVD, y número de unidades adquiridas.

Todo esto vive en la colección `videos`. El formulario de 'Nueva película' en el frontend captura cada campo, con varias reglas de validación que agregamos progresivamente: el año no puede ser mayor al año actual ni tener más de 4 dígitos, el costo unitario usa una máscara tipo cajero automático que solo acepta dígitos y los acomoda como centavos —esto garantiza que el precio siempre tenga exactamente 2 decimales, tanto en el frontend como validado de nuevo en el backend antes de guardar—, y las unidades a adquirir están limitadas a 999 para evitar errores de tipeo.

Para género, actores y categorías de nominación al Oscar, en vez de dejar campos de texto libre que generan datos inconsistentes —por ejemplo 'Drama' y 'drama' como dos géneros distintos—, construí un patrón de catálogo reutilizable: colecciones `generos` y `parametros` que actúan como listas maestras. Cada uno tiene un botón '+' para dar de alta un valor nuevo desde el mismo formulario, y esos valores quedan disponibles en toda la aplicación. Las nominaciones al Oscar se modelan como un array de objetos `{categoria, ganó}` dentro del documento de la película: agregar una categoría a la lista significa que fue nominada, y un checkbox marca si además ganó.

El segundo requerimiento era registrar nuevas copias de una película existente. Esto crea documentos nuevos en la colección `copies`, cada uno con estado `available`, vinculados por `videoId` a la película. El stock ya no se mide como un simple contador, sino como copias físicas individuales, lo cual es clave para el tercer requerimiento.

El tercer requerimiento era dar de baja copias, especificando fecha y razón —no devuelto, robo, dañado. Implementé esto como un cambio de estado: la copia pasa de `available` a `removed`, guardando `removedAt` y `removalReason`, además de un historial (`history`) que registra cada evento de esa copia a lo largo de su vida. La fecha de baja no puede ser futura, validado tanto en el formulario con un calendario limitado hasta hoy, como en el backend por si alguien llama la API directamente."

## Gestión de Clientes (2.5 min)

"El primer requerimiento era registrar clientes con nombre, teléfono celular, correo, fecha de nacimiento, dirección, geolocalización de la dirección, y fecha de registro.

El teléfono tiene una regla de negocio específica de Bolivia: exactamente 7 dígitos, empezando en 6 u 8 según sea celular. Esto se valida en tres capas: en el input del frontend, que solo permite escribir dígitos y muestra un contador en vivo tipo '5/7'; en el controlador del backend, con una expresión regular; y en el propio schema de MongoDB, con un `pattern` en el validador de la colección. Así, aunque alguien se salte el frontend, ni el backend ni la base de datos aceptan un teléfono inválido.

Para la geolocalización, integré un mapa interactivo con Leaflet y tiles de OpenStreetMap, sin costo ni API key. El operador hace clic en el punto exacto de la dirección del cliente, y automáticamente se dispara una consulta de geocodificación inversa a Nominatim que llena el campo de dirección con el nombre de la calle. Ese campo queda de solo lectura, para que la dirección siempre corresponda al punto real marcado en el mapa; y un segundo campo de texto libre permite anotar el número de puerta o una referencia adicional que el mapa no puede inferir. También agregué un botón de 'Mi ubicación actual' que usa la API de geolocalización nativa del navegador para centrar el mapa en la posición del dispositivo.

La fecha de registro se genera automáticamente en el servidor al crear el cliente, con `new Date()`, y queda protegida en el schema como campo obligatorio de tipo fecha.

El segundo requerimiento era poder actualizar los datos del cliente, lo cual expuse como un endpoint `PATCH` que reutiliza exactamente las mismas validaciones de teléfono y correo que la creación, para no tener reglas de negocio duplicadas o divergentes.

El tercer requerimiento era bloquear clientes registrando fecha y razón, y que los clientes bloqueados no puedan rentar. El bloqueo se hace con un modal que pide la razón y una fecha con calendario, limitada a no ser futura. Pero el punto más importante de este requerimiento no es la interfaz, es dónde se valida la regla: un cliente bloqueado no puede rentar películas aunque alguien intente forzarlo desde fuera del frontend, porque el propio servicio de renta, antes de crear cualquier préstamo, consulta el cliente y si `blocked` es verdadero, rechaza la operación con un error 409. Esa es una regla de negocio de seguridad que nunca debe depender solo de que la interfaz oculte un botón."

## Gestión de Préstamos (4.5 min)

"Este es el módulo más complejo, porque integra búsqueda, carrito, cálculo financiero y transacciones.

Para buscar películas por nombre, género, actor o nominación al Oscar, expuse un endpoint de búsqueda que combina un índice de texto completo de MongoDB para el título, con filtros exactos o por expresión regular para género, actor y categoría Oscar. Ese mismo buscador se replicó también en la pantalla de rentar, con autocompletado sobre los catálogos de género, actor y categoría, para que el operador no tenga que escribir el nombre exacto.

Pero para rentar, la búsqueda no solo filtra por esos criterios: también tiene que descartar películas sin stock disponible. Para eso construí una consulta de agregación con `$lookup`, que junta cada película con un conteo de sus copias en estado `available`, y descarta las que llegan a cero. Esto es distinto del catálogo administrativo de 'Películas', que sí muestra todo aunque no tenga stock, porque ahí el objetivo es dar de alta copias nuevas.

Para agregar la película al carrito y poder seguir buscando más, diseñé la pantalla con un layout de dos columnas: a la izquierda la tabla de resultados de búsqueda con un botón '+' por fila, y a la derecha un carrito angosto que va listando lo agregado, con posibilidad de quitar cada ítem. Cada película solo se puede agregar una vez al carrito, para simplificar el flujo de esta versión.

El requerimiento de registrar la fecha de devolución tuvo un cambio de diseño importante a mitad del proyecto: al principio, se elegía un número de días de renta y el sistema calculaba la fecha de devolución. Pero como cada película en el carrito puede llevarse por una cantidad distinta de días —y el importe cambia según eso—, rediseñé el flujo para que cada película del carrito tenga su propia fecha de devolución, elegida con un calendario en el modal de facturación. De esa fecha, el sistema deriva automáticamente cuántos días se está rentando esa película en particular.

El cálculo del importe según la fecha de devolución busca, para cada película, la tarifa configurada correspondiente a esa cantidad de días —por ejemplo, si la fecha implica 3 días, busca la tarifa de 3 días—, y multiplica por la cantidad. La suma de todas las películas da el subtotal. Sobre ese subtotal se aplica el descuento por cantidad total de películas rentadas, no por cantidad de títulos distintos, sino la suma real de unidades. El resultado final es el total de la factura.

La factura se emite en un modal separado que se abre automáticamente al confirmar la renta, mostrando el desglose línea por línea —película, tarifa, días, fecha de vencimiento— y el subtotal, descuento y total. Al cerrar ese modal, la factura deja de mostrarse en pantalla, porque ya quedó guardada permanentemente en la base de datos.

El segundo requerimiento era poder definir y modificar los costos por día de préstamo, con los valores iniciales de 2, 3, 4, 5 y 6 bolivianos para 1 a 5 días respectivamente, y que no se permitan préstamos más largos que el máximo configurado. Esto vive en una colección `settings` con un único documento de política, editable desde una pantalla de 'Tarifas y descuentos'. El input de cada tarifa usa la misma máscara de centavos que el costo de las películas, para garantizar 2 decimales exactos. Y el límite de días máximos se valida en el momento más crítico: dentro del propio servicio de renta, en el backend, no solo como un atributo `max` en el input de fecha del frontend. Si alguien intenta forzar una fecha de devolución más lejana que la política permite, el backend la rechaza sin importar qué mandó el cliente.

El tercer requerimiento era definir y modificar descuentos por cantidad de películas, con las reglas de 3 a 5 películas dan 5% de descuento, y más de 5 dan 10%. Este fue el punto que más iteré: al principio modelé cada descuento como un mínimo abierto —'desde X películas en adelante'— pero eso generaba ambigüedad visual y de negocio, porque el operador podía escribir cualquier número y desordenar los tramos sin darse cuenta. Rediseñé el modelo a rangos explícitos, con un 'desde' y un 'hasta' por cada tramo, donde el último tramo puede dejar el 'hasta' vacío para significar 'sin límite'. El backend valida que los rangos no se solapen ni dejen huecos entre sí antes de guardar la política, y ordena los tramos automáticamente. El cálculo real de la renta busca, para la cantidad total de películas del carrito, en qué rango cae, y aplica ese porcentaje sobre el subtotal."

## Cierre (30 seg)

"En resumen, cada uno de los nueve requerimientos del enunciado tiene una implementación end-to-end: modelo de datos en MongoDB con validadores de schema, lógica de negocio en el backend que es la fuente de verdad real —no solo la interfaz—, y una experiencia de usuario en el frontend que guía al operador y previene errores antes de que lleguen al servidor."

---

# VIDEO 3 (15 min) — Modelado de la BBDD, estructura del backend, y 5 problemas complejos

## Introducción (30 seg)

"Este último video cubre tres partes: cómo modelé la base de datos en MongoDB, cómo estructuré el código del backend, y los cinco problemas más complejos que tuve que resolver durante el desarrollo."

## Parte 1: Cómo modelé la base de datos (5 min)

"MongoDB es una base de datos orientada a documentos, así que el modelado no sigue las reglas de normalización de una base relacional. La pregunta que guio cada decisión fue: '¿qué datos se leen siempre juntos?' — esos se embeben en un mismo documento. '¿qué datos tienen vida propia, se reutilizan entre muchos documentos, o crecen sin límite?' — esos van en una colección aparte, referenciada por ID.

Tengo siete colecciones principales: `videos`, `copies`, `customers`, `loans`, `invoices`, `settings`, y dos colecciones de catálogo, `generos` y `parametros`.

La decisión más importante fue separar `videos` de `copies`. Al principio uno podría pensar en guardar 'unidades disponibles' como un simple número dentro de la película. Pero el requerimiento de dar de baja copias individuales, con fecha y razón propia, y de poder rentar copias físicas específicas, exige que cada copia sea una entidad con su propio ciclo de vida: `available`, `rented`, o `removed`, con un historial de eventos. Por eso `copies` es una colección separada, donde cada documento referencia su película por `videoId`. Esto también resuelve naturalmente la concurrencia: cuando dos personas quieren rentar la última copia, la operación atómica de MongoDB decide cuál copia específica se marca como rentada primero.

Dentro de `videos`, en cambio, sí embebí los actores y las nominaciones al Oscar como arrays de subdocumentos. La razón es que esos datos siempre se leen junto con la película —nunca se consulta 'dame todos los actores' de forma aislada de una película—, y no crecen de forma descontrolada, una película tiene un puñado de actores y categorías, no miles. Embeber evita un join, que en MongoDB es más costoso que en SQL.

Para género de película, actor y categoría de Oscar, en cambio, sí usé colecciones de catálogo separadas: `generos` y `parametros`. Aunque el valor final se guarda como texto embebido en la película —por ejemplo `genre: 'Drama'`—, ese texto viene de una lista controlada, para evitar duplicados por errores de tipeo. Es un patrón intermedio entre normalizar y embeber: el catálogo vive aparte para mantenerlo limpio y reutilizable en toda la aplicación, pero el dato final en la película es una copia plana del valor, no una referencia que obligue a hacer join para mostrar la lista de películas.

En `customers`, la dirección se modela como un objeto embebido con calle y referencia, y la geolocalización usa el formato estándar GeoJSON de MongoDB: `{type: 'Point', coordinates: [longitud, latitud]}`. Elegí GeoJSON en vez de dos campos sueltos de latitud y longitud porque es el formato que MongoDB entiende nativamente para consultas geoespaciales, aunque en esta versión del proyecto no llegué a explotar búsquedas por cercanía, el modelo ya queda preparado para eso.

El préstamo, `loans`, es el documento más complejo: tiene un array de ítems, y cada ítem embebe qué película se rentó, con qué copias específicas —un array de `copyIds`—, cuántos días, qué tarifa, y su propia fecha de devolución. Esto fue una decisión que cambié a mitad del proyecto: originalmente el préstamo tenía una sola fecha de devolución para todo, pero el requerimiento real es que cada película puede devolverse en fecha distinta con tarifa distinta, así que moví esos campos de nivel préstamo a nivel ítem.

Cada colección tiene un `$jsonSchema` validator configurado directamente en MongoDB, no solo en el código de la aplicación. Esto es una capa de seguridad extra: define tipos de datos obligatorios, patrones de texto como el teléfono o el correo, y rangos numéricos como que el año de una película no puede ser menor a 1888. Si en el futuro alguien conecta otro cliente distinto a mi API y escribe directo a la base, esos documentos inválidos igual son rechazados por el motor.

Finalmente, definí índices pensando en los accesos más frecuentes: un índice de texto completo sobre título, títulos alternativos y nombre de actor para la búsqueda; un índice compuesto de género más año; un índice único sobre el correo del cliente para no permitir duplicados; e índices compuestos sobre `loans` para encontrar rápido los préstamos activos de un cliente o de una película."

## Parte 2: Cómo estructuré el código del backend (4.5 min)

"El backend es Node.js con Express, organizado en capas bien separadas, siguiendo el patrón repositorio-servicio-controlador.

La capa más baja son los **repositorios**, uno por colección: `videoRepository`, `customerRepository`, `copyRepository`, `loanRepository`, `invoiceRepository`, `settingsRepository`, y los de catálogo. Cada repositorio es una clase pequeña cuya única responsabilidad es traducir operaciones de negocio a llamadas del driver de MongoDB: `find`, `insertOne`, `updateOne`, `findOneAndUpdate`. No contienen ninguna regla de negocio, solo consultas. Esto significa que si mañana cambiara de motor de base de datos, en teoría solo tendría que reescribir esta capa.

La capa intermedia son los **servicios**: `videoService` y `rentalService`. Aquí vive toda la lógica de negocio real: las validaciones de año, de costo unitario con dos decimales, el cálculo de tarifas según días, el descuento por cantidad, la verificación de que un cliente no esté bloqueado. Los servicios orquestan uno o varios repositorios, y son los únicos que abren transacciones cuando una operación necesita tocar varias colecciones de forma atómica, como rentar o devolver.

La capa superior son los **controladores**, uno por recurso HTTP: `videoController`, `customerController`, `rentalController`, `settingsController`. Su trabajo es traducir la petición HTTP —leer el body, los parámetros de la URL— a una llamada al servicio o repositorio correspondiente, y devolver la respuesta con el código de estado adecuado. Algunas validaciones simples de formato, como el patrón del teléfono, las puse directamente en el controlador porque no ameritan la complejidad de un servicio aparte.

Encima de los controladores están las **rutas**, que solo mapean verbos HTTP y paths a funciones del controlador, usando el Router de Express.

Para errores, tengo una clase `AppError` centralizada que lleva mensaje, código HTTP y un código de error legible como `CUSTOMER_BLOCKED` u `OUT_OF_STOCK`. Un middleware de manejo de errores al final de la cadena de Express captura cualquier `AppError` lanzado en cualquier capa y lo convierte en una respuesta JSON consistente, sin que cada controlador tenga que repetir lógica de try-catch para formatear errores.

Toda la configuración de arranque —conexión a MongoDB, creación de colecciones con sus validadores, creación de índices, y la inyección de dependencias entre repositorios, servicios y controladores— vive en un único punto de entrada, `server.js`. Ahí se construye el grafo de dependencias de forma explícita: se crean los repositorios pasándoles la conexión a la base, luego los servicios recibiendo los repositorios que necesitan, y luego los controladores recibiendo los servicios. Esto hace que las dependencias sean explícitas y fáciles de rastrear, en vez de usar un framework de inyección de dependencias que agregaría complejidad innecesaria para el tamaño de este proyecto."

## Parte 3: Los 5 problemas más complejos y cómo los resolví (5 min)

### Problema 1: Transacciones atómicas para rentar y devolver películas (1 min)

"El problema: rentar una película toca al menos tres colecciones —descuenta copias, crea el préstamo, crea la factura— y si algo falla a mitad de camino, no puedo dejar datos a medio escribir, como una copia marcada como rentada sin que exista el préstamo correspondiente.

La solución fue usar transacciones multi-documento de MongoDB con `session.withTransaction()`, que solo están disponibles cuando la base corre como Replica Set, no en modo standalone. Tuve que configurar Docker Compose para levantar MongoDB con `--replSet rs0` y un keyfile de autenticación entre nodos, además de un contenedor auxiliar que inicializa el replica set la primera vez que arranca. Cada operación de escritura dentro del método `rent()` recibe explícitamente la misma sesión, para que todas pertenezcan a la misma transacción."

### Problema 2: Modelar tarifas por fecha de devolución distinta por película (1 min)

"El problema apareció cuando entendí que la fecha de devolución no era global al préstamo, sino específica de cada película, y de eso depende la tarifa aplicada a cada una. El diseño original tenía un solo campo `days` y `dueDate` a nivel de todo el préstamo, calculado antes de tocar la base de datos.

Tuve que migrar el modelo completo: mover `dueDate`, `days` y `unitRate` de nivel préstamo a nivel de cada ítem dentro del array `items`, recalcular el subtotal como la suma de cada ítem con su propia tarifa, y ajustar tanto el frontend —que pasó de un único selector de días a un calendario por cada película en el modal de facturación— como el cálculo de descuento, que sigue siendo sobre el total de unidades, no por ítem."

### Problema 3: Migrar el schema de descuentos sin romper la base de datos en producción (1 min)

"Cuando rediseñé los descuentos de 'mínimo abierto' a 'rango explícito con máximo', ya existía un documento de configuración guardado en la base de datos con el formato viejo. Si simplemente aplicaba el nuevo `$jsonSchema` validator más estricto, ese documento existente hubiera quedado inválido y cualquier lectura o escritura posterior habría fallado.

La solución fue un script de migración idempotente dentro del arranque del servidor: primero, si detecta un documento con el formato viejo —campos sin `maximumItems`—, lo transforma calculando el máximo de cada tramo a partir del mínimo del tramo siguiente, y solo después de migrar aplica el validador nuevo con `collMod`. Verifiqué esto conectándome directamente a la base de datos real con `mongosh` antes y después de reiniciar el servidor, confirmando que el documento se transformó correctamente y que reiniciar dos veces no rompe nada, porque la migración detecta que ya no hay nada que migrar."

### Problema 4: Evitar condiciones de carrera al rentar la última copia disponible (1 min)

"El problema: si dos operadores intentan rentar la última copia disponible de la misma película casi al mismo tiempo, sin control de concurrencia ambos podrían creer que consiguieron la copia, dejando el sistema en un estado inconsistente donde una copia física aparece rentada dos veces.

La solución fue no usar un patrón de 'leer cuántas copias hay disponibles, luego decidir, luego escribir', que tiene una ventana de tiempo vulnerable. En cambio, uso `findOneAndUpdate` con filtro `{ videoId, status: 'available' }` en una sola operación atómica: MongoDB garantiza que solo un cliente puede encontrar y actualizar el mismo documento a la vez. Si no hay copias disponibles, la operación simplemente no encuentra ningún documento que cumpla el filtro, y devuelvo un error de stock insuficiente. Combinado con el `readConcern: snapshot` de la transacción, esto cierra la condición de carrera sin necesidad de bloqueos manuales."

### Problema 5: Formularios anidados rompiendo la navegación (1 min)

"Este fue un bug sutil de frontend con consecuencias confusas: en la pantalla de rentar, puse el buscador de películas dentro de su propio `<form>`, anidado dentro del `<form>` principal que envía la renta completa. El HTML no permite formularios anidados; el navegador aplana la estructura silenciosamente, así que el botón 'Buscar' terminaba dañando el comportamiento del formulario externo, y el usuario reportaba que al buscar lo redirigía a otra pantalla sin razón aparente.

La solución fue diagnosticar releyendo la estructura del JSX completa en vez de solo el código del botón, encontrar el `<form>` anidado, y convertirlo en un simple `<div>` con un botón de tipo `button` en vez de `submit`, que llama a la función de búsqueda directamente por evento de clic en vez de depender del evento de envío de formulario. La lección ahí fue que un bug de comportamiento raro casi siempre tiene una causa estructural que no está donde el síntoma aparece."

## Cierre (30 seg)

"En resumen: el modelo de datos balancea documentos embebidos para lo que se lee siempre junto, contra colecciones separadas para entidades con ciclo de vida propio o alta concurrencia. El backend sigue una arquitectura en capas clara —repositorio, servicio, controlador— con transacciones ACID reales sobre un Replica Set. Y los problemas más complejos no fueron de sintaxis, sino de modelado correcto del negocio y de entender las garantías de concurrencia que MongoDB ofrece y cuáles tengo que resolver yo mismo a nivel de aplicación."
