# Club de Videos API

Backend REST para el club de alquiler de DVD. Usa Node.js, Express y el driver oficial `mongodb`; no usa ODM. El frontend queda fuera de este alcance.

## Puesta en marcha

```bash
docker compose up -d
npm install
copy .env.example .env
copy mongo-keyfile.example mongo-keyfile
npm start
```

La URI incluye `replicaSet=rs0`. Mongo se ejecuta como replica set de un nodo porque las transacciones multi-documento no funcionan en modo standalone. El servicio `mongo-init-replica` ejecuta `rs.initiate()` una vez que el nodo está saludable.

## Modelo documental y decisiones

- `videos` embebe títulos alternativos, datos Oscar y actores como objetos `{ name }`. Son datos de lectura local, los actores no tienen ciclo de vida ni atributos administrables en este sistema, y así se evita un `$lookup` en la búsqueda principal. Si el negocio necesitara filmografías, contratos o edición independiente de actores, se extraería una colección `actors` y se guardarían referencias; `$lookup` sería el equivalente documental de un JOIN.
- `copies` referencia `videos` mediante `videoId`. Cada DVD cambia de estado de forma independiente y tiene historial de altas, rentas, devoluciones y bajas; embebido en la película crecería el documento y dificultaría la concurrencia sobre una copia concreta.
- `loans` referencia `customers` y `videos` mediante `_id`, pero embebe un snapshot de título, tarifa y `copyIds`. Esto conserva la factura histórica aunque cambie el catálogo y hace local la lectura de un préstamo.
- `invoices` referencia `loans` con índice único. Se mantiene separada porque puede consultarse, pagarse o auditarse independientemente.
- `customers` embebe dirección y geolocalización: son datos propios del cliente y normalmente se leen juntos. El historial completo de préstamos se referencia desde `loans` para evitar un array ilimitado en el cliente.

No se usa el modelo relacional como estructura principal porque el agregado de catálogo y el documento de alquiler se benefician de localidad, snapshots y evolución flexible. MongoDB no ofrece FKs nativas: la aplicación valida existencia y usa referencias por `_id`; las transacciones cubren las operaciones críticas. La validación `$jsonSchema` es schema-on-write parcial para campos esenciales, mientras que campos secundarios pueden evolucionar con schema-on-read.

## Integridad, ACID y concurrencia

Crear un alquiler ejecuta una transacción con `session.withTransaction()`: valida cliente y política, cambia copias disponibles a `rented`, inserta el préstamo e inserta la factura. Se usa `readConcern: snapshot` para una vista consistente, equivalente a evitar lecturas sucias y no repetibles durante la operación, y `writeConcern: majority` para durabilidad. MongoDB no ofrece aislamiento serializable general; el filtro `status: available` en `findOneAndUpdate` y los reintentos de la transacción evitan que dos rentas obtengan la misma copia. Sin transacción, un fallo entre el descuento de stock y la factura dejaría datos parciales.

La devolución vuelve a ser transaccional: marca el préstamo, libera sus copias y actualiza la factura. Los códigos HTTP principales son `400` para entrada inválida, `404` para referencias inexistentes y `409` para cliente bloqueado, préstamo ya devuelto o falta de stock.

## Índices

- Índice `text` en `title`, `alternateTitles` y `actors.name`: búsqueda libre por nombre y actor.
- B-tree compuesto `{ genre: 1, year: -1 }`: filtra por género y ordena por año.
- B-tree en `oscar.nominations` y `oscar.wins`: arrays de nominaciones/premios son multikey y tienen buena selectividad cuando se busca una categoría.
- `{ videoId: 1, status: 1 }` en copias: stock disponible por película.
- `{ blocked: 1, fullName: 1 }` en clientes: consultas operativas de bloqueados.
- `{ customerId: 1, status: 1 }`, `{ items.videoId: 1, status: 1 }` y `{ status: 1, dueDate: 1 }` en préstamos activos.

La selectividad debe comprobarse en producción con `db.videos.find(...).explain('executionStats')`; un campo con pocos valores repetidos puede no justificar un índice aislado. Los índices de texto sirven para relevancia, mientras que los B-tree sirven mejor para igualdad, rangos y ordenamiento.

## Frontend (React + Vite)

`frontend/` es un cliente SPA separado, consume la API por `fetch` (sin librerías de estado/routing: 5 pantallas no las justifican). No usa SSR ni sirve vistas desde Express — CORS está habilitado en el backend (`src/server.js`) para permitir el origen del dev server.

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Pantallas: **Películas** (buscar por texto/género/actor/Oscar, registrar película, alta de copias, ver stock, dar de baja copia), **Clientes** (listar/filtrar bloqueados, registrar, bloquear), **Rentar** (selección de cliente + múltiples películas, factura resultante), **Préstamos activos** (registrar devolución), **Tarifas** (editar política de tarifas/descuentos).

## Mapeo explícito a M2 y M3

### M2 — Modelo de datos

- **Relacional vs documental vs grafos**: el dominio tiene un agregado natural de lectura (película + sus datos descriptivos) y una transacción de negocio con forma de documento (préstamo con ítems, tarifa y snapshot). Un modelo relacional normalizado (3FN) exigiría JOIN entre `videos`, `video_actors`, `actors`, `loan_items` en cada búsqueda de catálogo o cada consulta de préstamo; el modelo documental colapsa esa localidad en un solo `find`. No hay relaciones tipo grafo (recorridos de profundidad variable, "amigos de amigos") en este dominio — un grafo sería sobre-ingeniería aquí, no una alternativa mejor descartada por gusto.
- **Desajuste objeto-relacional (impedance mismatch)**: en relacional, una película con actores y nominaciones variables en cantidad obliga a tablas hijas y a reconstruir el objeto en la capa de aplicación (mapeo objeto-relacional, N+1 si no se usa JOIN). En documental, `video.actors` y `video.oscar.nominations` son arrays nativos: el documento que persiste es el mismo objeto que consume la API, sin capa de mapeo.
- **Cuándo SÍ usaría relacional o `$lookup`**: si `actors` tuviera filmografía propia, biografía, o hubiera que editarlo independientemente del video, la relación pasa a ser muchos-a-muchos con entidad propia — ahí normalizar a una colección `actors` y usar `$lookup` (equivalente a JOIN) es correcto, porque ya no hay una dirección dominante de lectura y el embebido duplicaría escritura. Hoy no se hace porque el actor no tiene ciclo de vida en este sistema (es un dato descriptivo del video, no una entidad administrada).
- **Schema-on-read vs schema-on-write**: se aplica **schema-on-write parcial** vía `$jsonSchema` (`src/config/database.js`) solo sobre campos que sostienen invariantes de negocio (`status` de copia/préstamo restringido a un enum, tipos y mínimos numéricos, campos requeridos). Campos secundarios (`address`, `location`, `oscar`) no tienen sub-schema estricto: pueden evolucionar sin migración, característico de schema-on-read. Es un punto medio deliberado: MongoDB no exige esquema (motor schema-on-read por diseño), pero aquí sí interesa que `loans.status` nunca tenga un valor fuera de `active|returned`, porque de eso depende la lógica de concurrencia.
- **Lenguaje de consulta**: el driver de MongoDB usa una API **declarativa** basada en documentos de filtro (`find({ genre, 'actors.name': ... })`), no un lenguaje imperativo de cursores manuales ni MapReduce (deprecado en Mongo moderno, reemplazado por el aggregation pipeline, que tampoco se necesitó aquí porque no hay agregaciones multi-etapa). Se contrasta con SQL (declarativo también, pero relacional) y con Cypher/SPARQL (declarativos para grafos, no aplicables a este dominio sin relaciones de grafo).

### M3 — Arquitectura, concurrencia, transacciones e indexación (llevado de MySQL a MongoDB)

- **Storage engine**: MongoDB usa **WiredTiger** como storage engine por defecto (análogo a InnoDB en MySQL) — soporta MVCC, compresión y locking a nivel de documento. La elección no es configurable por nosotros en este proyecto (no hay engine alternativo relevante como MyISAM), pero es el motor que hace posibles las transacciones multi-documento y el `readConcern: snapshot` usados aquí.
- **MVCC**: al igual que InnoDB, WiredTiger usa **Multi-Version Concurrency Control**: cada transacción ve una instantánea (snapshot) de los datos al momento de iniciar, sin bloquear lectores contra escritores. `readConcern: { level: 'snapshot' }` en `rentalService.js` pide explícitamente esa vista consistente durante toda la transacción de renta/devolución — es el mismo mecanismo conceptual que el nivel de aislamiento `REPEATABLE READ` de InnoDB (de hecho, `snapshot` en Mongo se comporta más estricto: evita lecturas fantasma dentro de la transacción, acercándose a `SERIALIZABLE` para los documentos tocados).
- **Locks vs operaciones atómicas**: MySQL/InnoDB usa locks explícitos a nivel de fila (`SELECT ... FOR UPDATE`) para evitar carreras. MongoDB no expone locks manuales al desarrollador; en su lugar, cada operación sobre un único documento es atómica por diseño del motor. Por eso `copyRepository.rentOne` usa `findOneAndUpdate({ videoId, status: 'available' }, ...)`: el motor garantiza que el "leer disponibilidad + marcar como rentado" ocurre como una sola operación indivisible a nivel de documento, sin necesitar un lock manual. Se probó en vivo: dos rentas simultáneas de la última copia — una tuvo éxito, la otra recibió `409` sin duplicar la copia ni corromper el stock.
- **Transacciones y ACID**: la renta ejecuta `session.withTransaction()` sobre 3+ escrituras (copias, préstamo, factura) — es el equivalente directo a `BEGIN; ...; COMMIT;` en MySQL. Atomicidad: si falla la inserción de la factura, MongoDB revierte los cambios a las copias y al préstamo (rollback real, no compensación manual). Consistencia: la validación `$jsonSchema` actúa como los `CHECK`/`NOT NULL` de una tabla SQL. Aislamiento: `readConcern: snapshot`. Durabilidad: `writeConcern: { w: 'majority' }` exige que la escritura se replique a la mayoría de nodos del replica set antes de confirmar (análogo a `innodb_flush_log_at_trx_commit` combinado con confirmación de replicación, más fuerte que un commit local único).
- **Niveles de aislamiento**: MySQL ofrece `READ UNCOMMITTED / READ COMMITTED / REPEATABLE READ / SERIALIZABLE`. MongoDB no nombra niveles idénticos, pero `readConcern` es el control análogo: `local` (≈ read committed, puede leer datos que luego se revierten en un failover), `majority` (solo datos confirmados por la mayoría, no se pierden en failover), `snapshot` (usado aquí: vista fija de todo el replica set al momento de iniciar la transacción, el nivel más fuerte disponible sin locking manual). Se eligió `snapshot` porque el cálculo de tarifa dentro de la transacción no puede ver cambios de otra transacción concurrente a mitad de camino.
- **Indexación — tipos**: MongoDB con WiredTiger usa **B-Tree** para índices regulares (igual que InnoDB), pero aquí no hay índice Hash explícito (MongoDB no expone hash index de propósito general como estructura de consulta, a diferencia de MEMORY/NDB en MySQL). Para búsqueda libre de texto se usa un **índice de texto** (`video_text_search`), estructuralmente distinto a un B-Tree: es un índice invertido (token → documentos), el equivalente documental de `FULLTEXT INDEX` en MySQL/InnoDB — por eso título/alternateTitles/actor usan `text` y no un B-Tree con `$regex` (un regex sin ancla no puede usar un B-Tree eficientemente, igual que `LIKE '%texto%'` no usa índice en MySQL).
- **Índices compuestos y prefijo de índice**: `{ genre: 1, year: -1 }` sigue la misma regla de prefijo que un índice compuesto en InnoDB: sirve para filtros solo por `genre`, o por `genre + year`, pero **no** para filtrar solo por `year` (el motor no puede saltarse el primer campo del índice) — es la regla "leftmost prefix" vista en clase, aplicada igual en Mongo.
- **Índice clustered**: en InnoDB, la tabla está físicamente ordenada por la clave primaria (clustered index) y los índices secundarios guardan esa clave para volver a la fila. En MongoDB, `_id` cumple un rol similar como clave de búsqueda primaria muy eficiente, pero WiredTiger no clusteriza físicamente el resto del documento alrededor de `_id` de la misma forma que InnoDB — es una diferencia real de arquitectura de storage engine, no solo de nombre, y por eso el resto de índices (texto, género, estado) son necesarios como estructuras secundarias independientes.
- **Selectividad**: `status` en `copies` (solo `available|rented|removed`) es de **baja selectividad** por sí solo, por eso nunca se indexa solo — siempre compuesto con `videoId` (`{ videoId: 1, status: 1 }`), donde `videoId` sí es altamente selectivo y reduce el conjunto antes de filtrar por estado. `oscar.nominations`/`oscar.wins` tienen alta selectividad (pocos videos comparten la misma categoría exacta). Verificable con `db.copies.find({ videoId, status: 'available' }).explain('executionStats')`: debe mostrarse `IXSCAN` con `totalDocsExamined` cercano a `nReturned`, no un `COLLSCAN`.
- **Gestión de conexiones**: el driver mantiene un **connection pool** interno (un único `MongoClient` instanciado en `src/config/database.js` y reutilizado en toda la app vía inyección de dependencias en `server.js`), igual en espíritu al pool de conexiones de un cliente MySQL — se evita abrir una conexión TCP nueva por request.

## Endpoints

Los ejemplos están en [requests.http](requests.http). Principales rutas:

- `POST/GET /api/videos`, `POST /api/videos/:id/copies`, `GET /api/videos/:id/copies/available`, `POST /api/videos/copies/:copyId/removal`
- `POST/GET/PATCH /api/customers`, `POST /api/customers/:id/block`
- `POST /api/loans`, `GET /api/loans/active`, `POST /api/loans/:id/return`
- `GET/PATCH /api/settings/rental-policy`

La política inicial es configurable en Mongo: tarifa por tramo de días (`1 día=2, 2=3, 3=4, 4=5, 5=6`, según la tabla del enunciado — no es tarifa-por-día multiplicada), máximo `5` días, descuento de 5% desde 3 unidades y 10% desde 6.