# POS S&J — Plan del sistema de ventas, pedidos y cierre de caja

> **S&J Parrilladas y Catering Service** · Plan v1.0 · 1 de octubre de 2026
> Autor: José Murillo · Basado en: lista de precios, pedidos por empresa (Oktoberfest), menú por día y el diseño de `S-JParilladasCateringService_webpage`.

---

## 1. Qué problema resuelve

Hoy en un evento (ej. Oktoberfest) se manejan **tres cosas a mano**:

1. **Ventas de mostrador**: alguien llega, pide un casado y paga (SINPE, datáfono o efectivo).
2. **Pedidos programados de empresas**: Vindi, PMI, Isleña, Brain Freeze, etc. piden por día (viernes/sábado/domingo) con un encargado, y hay que ir marcando qué se entregó.
3. **Consumo a crédito**: empresas y personal de NUNU comen y pagan después, entonces hay que llevar la cuenta de cada uno.

Y al final del día alguien tiene que **cuadrar la caja**: cuánto entró por cada medio, cuánto efectivo debería haber y cuánto se quedó debiendo.

**Objetivo:** una web sencilla, rápida en tablet o celular, que registre todo eso y genere el **cierre de caja** en un clic.

### Principios

- **Rápido en hora pico.** Una venta normal se hace en 3 toques o menos: producto → cobrar → método.
- **Imposible equivocarse en lo importante.** No se puede cobrar en efectivo con menos dinero del total, no se puede poner a cuenta sin cliente registrado y no se puede borrar una venta (solo anularla, con motivo).
- **Todo queda registrado.** Cada venta, pago, anulación y abono guarda quién lo hizo y cuándo.
- **Simple primero.** El MVP cubre el evento; lo demás viene por fases.

---

## 2. Usuarios y roles

| Rol | Puede hacer |
|---|---|
| **Cajero** | Abrir caja, vender, cobrar, poner a cuenta, marcar pedidos entregados, registrar abonos, hacer cierre (corte). |
| **Cocina / Despacho** *(opcional)* | Ver la cola de pedidos y marcarlos *listo / entregado*. No ve dinero. |
| **Admin** | Todo lo anterior, más productos y precios, usuarios, anular ventas, descuentos, reabrir un cierre, reportes y crear/editar clientes a crédito. |

- **Inicio de sesión con PIN de 4–6 dígitos** (rápido en tablet). El admin además usa contraseña para la parte de configuración.
- Las acciones sensibles (anular, descontar, reabrir caja) piden **PIN de admin** aunque esté logueado un cajero.

---

## 3. Módulos y funcionalidades

### 3.1 Apertura de caja
- Se elige la caja/dispositivo y se ingresa el **fondo inicial** (efectivo para dar vuelto, ej. ₡30 000).
- Se ingresa el **tipo de cambio del dólar** del día (ej. ₡505), que se usa para todos los pagos en $ de esa sesión. Solo el admin puede cambiarlo a mitad del día, y el cambio queda en la bitácora.
- Opcionalmente se asocia la sesión a un **evento** (ej. *Oktoberfest 2026*) para sacar reportes por evento.
- **Sin caja abierta no se puede vender.**

### 3.2 Pantalla de venta (POS)
- Una cuadrícula de **botones grandes por producto**, agrupados por categoría (Platos fuertes, Comidas rápidas, Café/Repostería, Bebidas).
- Productos iniciales (de la lista de precios):

| Producto | Precio |
|---|---|
| Perro caliente | ₡2 750 |
| Queque seco | ₡1 200 |
| Arroz con pollo | ₡4 100 |
| Casado con bisteck | ₡4 100 |
| Casado con carne en salsa | ₡4 100 |
| Hamburguesa con papas | ₡3 500 |
| Tamal de cerdo | ₡2 000 |
| Burritos con papas | ₡3 250 |
| Chifrijo | ₡4 100 |
| Casado con fajitas mixtas | ₡4 100 |
| Casado con pechuga de pollo | ₡4 100 |
| Café negro | ₡1 000 |
| Café con leche | ₡1 200 |
| Refresco | ₡1 500 |
| Agua | ₡1 000 |

- Un toque suma 1 unidad, con **+ / –** en el carrito y una **nota por línea** (ej. *"sin cebolla"*, *"bistec encebollado"*).
- Botón de **producto agotado**: lo pone gris y no se puede vender.
- **Nombre del cliente o número de mesa** opcional, para llamar el pedido.
- Cada venta recibe un **número de orden del día** (#001, #002…) que se reinicia cada día.

### 3.3 Cobro (modal)
Se elige el medio de pago con **botones grandes de color**:

| Medio | Qué se pide | Validación |
|---|---|---|
| **Efectivo ₡** | Monto recibido | Botones rápidos: *Exacto*, ₡10 000 y ₡20 000 (suman al tocarlos varias veces); cualquier otro monto se digita en el teclado numérico. Calcula el **vuelto** en grande. No deja confirmar si recibido < total. |
| **Efectivo $ (dólares)** | Billetes recibidos: $1, $5, $10, $20, $50 y $100 | **Solo billetes, sin monedas de dólar.** Convierte a colones con el **tipo de cambio del día** (definido al abrir la caja) y el **vuelto siempre se da en colones**. Ej.: total ₡8 200, paga $20 con TC ₡505 → ₡10 100 → vuelto **₡1 900**. El vuelto se redondea a múltiplos de ₡10, porque es la moneda más pequeña. |
| **SINPE Móvil** | Número de comprobante (o últimos 4 dígitos) | Queda **"por verificar"** hasta que alguien confirme que el dinero entró *(ver §6, fraude de capturas falsas)*. |
| **Datáfono BAC** | N.º de autorización del voucher (opcional pero recomendado) | Se cuadra contra el cierre de lote del datáfono BAC. |
| **Datáfono BN** | N.º de autorización del voucher | Se cuadra contra el cierre de lote del datáfono BN. |
| **No paga (a cuenta)** | Buscar el cliente por nombre, **cédula** o **n.º de cuenta S&J0001** | **Solo clientes registrados** (Empresa o Personal NUNU). Si no existe se puede crear ahí mismo con nombre y cédula. Imprime el **tiquete de cargo a cuenta** con firma. Avisa si pasa el límite de crédito (si tiene). |

- **Pago dividido**: ej. ₡5 000 por SINPE + ₡3 200 en efectivo. Se agregan pagos hasta completar el total. El vuelto solo se calcula sobre la parte en efectivo.
- Al confirmar se **imprime el tiquete** en la impresora térmica Epson (ver §3.10); si no hay impresora, se muestra en pantalla.
- Se protege contra el **doble toque** (no se crean dos ventas iguales si alguien toca dos veces).

### 3.4 Pedidos — cola y estados
Cada venta es también un pedido con estado:

```
PENDIENTE → EN PREPARACIÓN → LISTO → ENTREGADO
                         ↘ ANULADO (con motivo + PIN admin)
```

- Una vista tipo tablero/lista con filtros: *Pendientes · Listos · Entregados · Todos*.
- Muestra el tiempo de espera de cada pedido; si pasa de X minutos (configurable) se pone en rojo.
- Opcionalmente, una **pantalla de cocina** (otra tablet o un TV) que solo muestra la cola.
- **El pago y la entrega son cosas separadas**: un pedido puede estar pagado y pendiente de entregar, o entregado y a cuenta.

### 3.5 Pedidos programados (empresas por día)
Es el caso de la tabla Vindi / PMI / Isleña / etc.:

- Se crea un **pedido programado** por empresa, por día y por tiempo de comida (almuerzo, café o cena), con su encargado y las cantidades por producto.
- **Carga rápida**: una pantalla tipo hoja (filas = empresas, columnas = productos) o **importación desde Excel/CSV** con el mismo formato que ya usan.
- El día del evento aparecen en la cola marcados como *Programado*, y se pueden **marcar entregados total o parcialmente** (ej. *"9 de 9 perros entregados, faltan 2 arroces"*).
- Al entregar, el cargo va **automáticamente a la cuenta por cobrar de esa empresa**, o se cobra en ese momento si pagan contra entrega.
- Se puede generar una **hoja de despacho imprimible** por día, que reemplaza a los PDF que hicimos hoy.

### 3.6 Clientes y cuentas por cobrar
- **Tipos de cliente**: `Empresa` (Vindi, PMI, Isleña…), `Personal NUNU` (cada persona con su cuenta, ligada a NUNU) y `Otro` (cliente frecuente).
- **Número de cuenta automático y consecutivo**: `S&J0001`, `S&J0002`, … Se asigna al registrar el cliente y nunca se reutiliza.
- **Datos obligatorios**: **nombre**, **cédula** y **n.º de cuenta** (este último lo genera el sistema).
- **Cédula**: se acepta física (9 dígitos, ej. 1-1234-0567), jurídica para empresas (10 dígitos, ej. 3-101-123456) o DIMEX (11–12 dígitos). Se valida el formato y **no puede repetirse**: si la cédula ya existe, el sistema muestra la cuenta que ya tiene ese cliente en vez de crear otra.
- **Datos opcionales**: teléfono, organización (ej. Vindi, NUNU), encargado, límite de crédito, notas y estado (activo/bloqueado).
- Al crear la cuenta se imprime el **tiquete de apertura** con firma (ver §3.10).
- **Estado de cuenta**: lista de cargos (ventas a cuenta) y abonos, con **saldo actual**. Se imprime en la térmica o en PDF.
- **Registrar abono**: el cliente paga todo o parte de su saldo con cualquier medio (SINPE, datáfono o efectivo). El abono **entra en el cierre de caja del día en que se recibe**, como *ingreso por abonos*, separado de las ventas.
- Reporte de **antigüedad de saldos**: quién debe, cuánto y desde cuándo.

### 3.7 Movimientos de efectivo (entradas y salidas)
Para que el efectivo cuadre siempre:
- **Salidas**: compra de hielo, gas, pago a un ayudante, retiro parcial para guardar.
- **Entradas**: más cambio que se agregó a la caja.
- Cada movimiento lleva monto, motivo y quién lo hizo.

### 3.8 Cierre de caja
Hay dos tipos:
- **Corte parcial (X)**: ver cómo va la caja en cualquier momento sin cerrarla.
- **Cierre final (Z)**: cierra la sesión y después ya no se puede vender ni anular en ella.

**Pasos del cierre:**
1. **Contar efectivo por denominación**. El sistema suma solo.
   - **Colones, billetes**: ₡50 000, ₡20 000, ₡10 000, ₡5 000, ₡2 000, ₡1 000
   - **Colones, monedas**: ₡500, ₡100, ₡50, ₡25, ₡10
   - **Dólares, solo billetes** (se cuentan aparte): $100, $50, $20, $10, $5, $1
   - Los dólares **no se mezclan** con los colones: se cuadran contra los dólares recibidos (como nunca se da vuelto en dólares, lo esperado es exactamente lo recibido).
2. **Verificar SINPEs**: se marcan los que se confirmaron en la app del banco. Los que no se encuentren quedan como pendientes y se señalan.
3. **Ingresar el total del cierre de lote** de cada datáfono (BAC y BN) para compararlo con lo registrado.
4. El sistema calcula las **diferencias** (sobrante o faltante) y pide una nota si hay alguna.

**Reporte de cierre (PDF / impresión):**

```
CIERRE DE CAJA — Oktoberfest 2026 · Sábado 03/10/2026
Caja: Tablet 1 · Abrió: José 10:02 · Cerró: José 22:41

VENTAS                         Cant.     Monto
  Efectivo                       48   ₡182 350
  SINPE Móvil                    37   ₡141 800   (2 sin verificar)
  Datáfono BAC                   22    ₡89 900
  Datáfono BN                     9    ₡36 600
  A cuenta (por cobrar)          41   ₡168 100
  ─────────────────────────────────────────────
  TOTAL VENDIDO                 157   ₡618 750
  Anuladas                        3   ₡10 950

ABONOS A CUENTAS RECIBIDOS             ₡45 000

EFECTIVO
  Fondo inicial                         ₡30 000
  + Ventas en efectivo ₡               ₡182 350
  + Abonos en efectivo                  ₡20 000
  − Vueltos dados por pagos en $        ₡11 400
  − Salidas (hielo, gas)                ₡12 500
  = Efectivo esperado (₡)              ₡208 450
  Efectivo contado (₡)                 ₡207 600
  DIFERENCIA                              −₡850  ⚠

DÓLARES (TC del día ₡505)
  Pagos en $                    6        $120  (= ₡60 600)
  Dólares contados                       $120
  DIFERENCIA                               $0

DATÁFONOS          Sistema     Lote    Dif.
  BAC              ₡89 900  ₡89 900      ₡0
  BN               ₡36 600  ₡36 600      ₡0

PRODUCTOS VENDIDOS
  Chifrijo 62 · Hamburguesa c/ papas 48 · Burritos 41 · ...

CUENTAS POR COBRAR GENERADAS HOY
  S&J0003 Isleña ₡143 500 · S&J0011 PMI ₡24 600 · ...
```

- El cierre se guarda y se puede consultar después. Solo el admin puede reabrirlo, con motivo.
- También hay un **reporte del evento completo** que suma los cierres de viernes, sábado y domingo.

### 3.9 Administración
- **Productos**: nombre, categoría, precio, activo/inactivo, orden en pantalla y color del botón.
- **Usuarios y PINs.**
- **Configuración**: nombre del negocio, encabezado del tiquete, tiempo de alerta de pedidos, cajas/dispositivos.
- **Reportes**: ventas por día, evento, producto, medio de pago y cajero.
- **Bitácora (auditoría)**: quién anuló, descontó o reabrió qué.

### 3.10 Tiquetes en impresora térmica Epson
**Sí se puede.** Las impresoras térmicas Epson (TM-T20, TM-T88, TM-m30 y similares) usan **ESC/POS**, un lenguaje estándar que Node maneja directamente con la librería `node-thermal-printer` (tiene modo Epson). Se conectan a la laptop por **USB** o por **red/LAN**.

**Por qué ESC/POS y no "imprimir" como una página normal:**
- Imprime **al instante**, sin ventana de diálogo.
- **Corta el papel** solo.
- Puede **abrir la gaveta de dinero** si está conectada a la impresora (puerto RJ11). Se abre sola al cobrar en efectivo.
- Imprime el **logo de S&J** en blanco y negro y **códigos QR**.
- *Plan B:* si la impresora solo funciona con su driver, Electron imprime en silencio con `webContents.print({ silent: true })` en formato de 80 mm.

**Tiquetes que imprime** (80 mm; también funciona en 58 mm):

| Tiquete | Cuándo sale | Qué lleva |
|---|---|---|
| **Venta** | Al cobrar | Logo, n.º de orden, fecha y hora, cajero, productos × cantidad, total, medio de pago, recibido y vuelto (y, si pagó en $, los dólares y el tipo de cambio). |
| **Comanda de cocina** *(opcional)* | Al cobrar | Solo el n.º de orden, los productos y las notas, en letra grande y sin precios. |
| **Apertura de cuenta** | Al registrar un cliente a crédito | Logo, **"APERTURA DE CUENTA"**, **n.º de cuenta S&J000X** en grande, nombre, cédula, tipo (Empresa / Personal NUNU), fecha, quién la abrió y línea de **firma del cliente**. Se imprime en **dos copias**: una para el cliente y otra firmada para S&J. |
| **Cargo a cuenta** | Cada venta "No paga" | Igual que el de venta, más n.º de cuenta, nombre, **saldo anterior → saldo nuevo** y **línea de firma** ("Acepto el cargo a mi cuenta"). Dos copias: la firmada queda en S&J como respaldo de la deuda. |
| **Abono** | Cuando el cliente paga su cuenta | N.º de cuenta, nombre, monto abonado, medio de pago y **saldo pendiente**. |
| **Estado de cuenta** | A pedido | Lista de cargos y abonos con el saldo final. |
| **Cierre de caja** | Al cerrar | El reporte del cierre (§3.8) en versión resumida para tiquete; el completo sale en PDF. |

Todos los tiquetes llevan al pie: *"Tiquete interno — no es comprobante electrónico"* (los comprobantes de Hacienda quedan para la versión 2).

Ejemplo, apertura de cuenta:
```
        [LOGO S&J]
  S&J PARRILLADAS Y CATERING
--------------------------------
      APERTURA DE CUENTA

          S&J0012

Nombre:  Marco Bogantes
Cédula:  1-1234-0567
Tipo:    Empresa (Vindi)
Fecha:   03/10/2026 14:22
Abrió:   José
--------------------------------
El cliente autoriza a S&J a
registrar consumos a esta cuenta
para pago posterior.


  ______________________________
         Firma del cliente
--------------------------------
 Tiquete interno - no es
 comprobante electrónico
```

**En Configuración:** se elige la impresora (USB o IP), el ancho del papel (80/58 mm), la cantidad de copias por tipo de tiquete y si la gaveta se abre sola. También hay un **botón de "impresión de prueba"** y uno de **reimprimir el último tiquete**.

---

## 4. Modelo de datos

Base de datos **SQLite** (un archivo local; los IDs son UUID por si algún día se quiere sincronizar). Los montos se guardan como **enteros en colones**, porque el colón no usa céntimos en la práctica; así se evitan errores de redondeo.

```
usuarios            (id, nombre, rol[admin|cajero|cocina], pin_hash, password_hash?, activo, creado_en)

eventos             (id, nombre, fecha_inicio, fecha_fin, notas)               -- ej. "Oktoberfest 2026"

categorias          (id, nombre, orden)
productos           (id, categoria_id, nombre, precio, activo, agotado, orden, color)

clientes            (id, numero_cuenta UNIQUE  -- 'S&J0001'
                     tipo[empresa|personal_nunu|otro], nombre, cedula UNIQUE,
                     tipo_cedula[fisica|juridica|dimex], telefono?, organizacion?,
                     contacto_encargado?, limite_credito?, estado[activo|bloqueado],
                     notas, creado_en)

sesiones_caja       (id, evento_id?, dispositivo, abierta_por, abierta_en, fondo_inicial,
                     tipo_cambio_usd,                         -- ₡ por $1, se define al abrir
                     cerrada_por?, cerrada_en?, efectivo_contado?, conteo_denominaciones JSON,
                     usd_contado?, conteo_usd JSON,
                     lote_bac?, lote_bn?, diferencia_efectivo?, notas_cierre, estado[abierta|cerrada])

ventas              (id, sesion_caja_id, numero_orden_dia, tipo[mostrador|programado],
                     cliente_id?, nombre_referencia?, usuario_id,
                     subtotal, descuento, total,
                     estado_pago[pendiente|pagada|a_cuenta|parcial|anulada],
                     estado_pedido[pendiente|preparacion|listo|entregado|anulado],
                     fecha_programada?, tiempo_comida?[almuerzo|cafe|cena],
                     nota, creado_en, entregado_en?,
                     anulada_por?, anulada_motivo?, idempotency_key UNIQUE)

venta_items         (id, venta_id, producto_id, nombre_snapshot, precio_snapshot,
                     cantidad, cantidad_entregada, nota, subtotal)
                     -- snapshot: si mañana cambia el precio, la venta de hoy no cambia

pagos               (id, sesion_caja_id, venta_id?, cliente_id?,          -- venta_id null = abono
                     metodo[efectivo|efectivo_usd|sinpe|datafono_bac|datafono_bn|cuenta],
                     monto_usd?, tipo_cambio?,               -- solo efectivo_usd; vuelto siempre en ₡
                     monto, recibido?, vuelto?, referencia?, verificado bool,
                     usuario_id, creado_en, anulado bool)

movimientos_cuenta  (id, cliente_id, tipo[cargo|abono|ajuste], monto,
                     venta_id?, pago_id?, nota, usuario_id, creado_en)
                     -- saldo = SUM(cargos) − SUM(abonos) ± ajustes (libro mayor, nunca se edita)

movimientos_caja    (id, sesion_caja_id, tipo[entrada|salida], monto, motivo, usuario_id, creado_en)

auditoria           (id, usuario_id, accion, entidad, entidad_id, detalle JSON, creado_en)
```

**Número de cuenta consecutivo:**
```sql
-- tabla de contadores (SQLite)
CREATE TABLE contadores (nombre TEXT PRIMARY KEY, valor INTEGER NOT NULL);
INSERT INTO contadores VALUES ('cuenta', 0), ('orden_dia', 0);

-- al crear cliente, dentro de una transacción:
UPDATE contadores SET valor = valor + 1 WHERE nombre = 'cuenta' RETURNING valor;  -- 1
-- numero_cuenta = 'S&J' + valor con 4 dígitos → S&J0001
```
SQLite procesa una escritura a la vez, así que el número nunca se repite. En los enlaces internos se usa el `id` y no el número, porque el `&` da problemas en URLs.

**Reglas importantes en la base de datos:**
- Una venta `a_cuenta` debe tener `cliente_id` (restricción CHECK).
- La suma de `pagos` de una venta debe ser igual a su `total` para quedar como `pagada`.
- Las ventas, pagos y movimientos **no se borran**: se anulan. Así el cierre siempre se puede reconstruir.

---

## 5. Pantallas (flujo)

```
[PIN login] → [¿Caja abierta?] ─no→ [Apertura de caja]
                    │sí
                    ▼
     ┌──────────── barra inferior / lateral ────────────┐
     │  VENDER  │  PEDIDOS  │  PROGRAMADOS  │  CUENTAS  │  CAJA  │
     └──────────────────────────────────────────────────┘
VENDER       → cuadrícula + carrito → [Cobrar] → modal de pago → tiquete
PEDIDOS      → cola por estado → tocar → Listo / Entregado
PROGRAMADOS  → día ▸ empresa ▸ marcar entregas
CUENTAS      → buscar cliente ▸ estado de cuenta ▸ registrar abono / nuevo cliente
CAJA         → corte X · entradas/salidas · cierre Z (arqueo → reporte)
ADMIN        → productos · usuarios · reportes · bitácora   (solo admin)
```

Pensado primero para **tablet horizontal** (cuadrícula a la izquierda, carrito a la derecha), pero también funciona en celular (el carrito se vuelve un panel inferior).

---

## 6. Cosas a tomar en cuenta (riesgos y casos borde)

| Tema | Qué pasa | Cómo lo manejamos |
|---|---|---|
| **Capturas falsas de SINPE** | Es una estafa común: enseñan una captura editada. | El pago queda "por verificar" y se confirma en la app del banco. El cierre muestra los SINPEs sin verificar. Mejor aún: tener la app del banco abierta en otro celular con notificaciones. |
| **Internet malo en el evento** | Una web en la nube no responde sin señal. | **Resuelto**: la app es 100 % local (§8). |
| **Se apaga o se daña la laptop** | Se pierde el evento. | SQLite en modo WAL (resiste apagones), copia en cada cierre, batería/UPS y, si se puede, copia automática cada hora a una USB. |
| **Dos pantallas al mismo tiempo** *(si se activa la red local)* | Pueden chocar los números de orden y de cuenta. | Todo pasa por la misma base de datos en la laptop, con transacciones. |
| **Doble toque al cobrar** | Se duplica la venta. | Una `idempotency_key` por venta y el botón se deshabilita mientras procesa. |
| **Cambio de precio a mitad del evento** | Las ventas viejas cambiarían de monto. | Se guarda un snapshot del precio en cada línea. |
| **Anular después del cierre** | Descuadra un cierre que ya se imprimió. | No se permite. Se hace un ajuste/devolución en la sesión actual con PIN de admin. |
| **Devoluciones** | El cliente devuelve un plato pagado en efectivo. | Se anula la venta y se registra una salida de caja o un pago negativo, con motivo. |
| **Cliente a crédito que no paga** | La deuda crece. | Límite de crédito opcional, estado *bloqueado* y reporte de antigüedad de saldos. |
| **Pedido programado incompleto** | La empresa pidió 9 y se entregaron 7. | Se guarda `cantidad_entregada` por línea y solo se carga a cuenta lo entregado (configurable). |
| **Zona horaria** | Ventas después de medianoche caen en otro día. | Todo en `America/Costa_Rica`, y el "día de operación" lo define la **sesión de caja**, no el reloj. |
| **Datos personales** | Se guardan nombre y cédula de los clientes. | La Ley 8968 (Prodhab) aplica: guardar solo lo necesario, que el tiquete de apertura indique para qué se usan los datos, acceso con PIN y respaldos en un lugar seguro. |
| **Comprobantes electrónicos (Hacienda)** | Un tiquete interno **no es un comprobante fiscal**. | **Quedan para la versión 2.** La v1 imprime tiquetes internos rotulados como tales. La cédula que ya se guarda servirá para facturar a nombre del cliente en la v2. |
| **Respaldo** | Se daña o se pierde la laptop. | Copia de `sj-pos.db` en cada cierre y botón *Respaldar a USB* (ver §8). |
| **Impresora térmica** | Se acaba el papel, se desconecta el USB o la impresora falla. | El tiquete se guarda siempre en el sistema y se puede **reimprimir**. Si la impresora falla, se muestra en pantalla y se avisa. Llevar **rollos de repuesto**. |

---

## 7. Diseño visual

Basado en `S-JParilladasCateringService_webpage` (Astro + Tailwind 4), más los tonos del flyer:

| Token | Valor | Uso |
|---|---|---|
| `--background_color_1` | `#1a1a1a` | Fondo general (tema oscuro, como la web) |
| `--background_color_2` | `#121212` | Barras, paneles, carrito |
| `--principal-color` | `#e60000` | Acciones principales: **Cobrar**, alertas |
| `--accent_color` | `#ff5722` | Hover, selección, bordes activos |
| `--text_color_1` / `_2` | `#ffffff` / `#cccccc` | Texto |
| `--gold` *(nuevo)* | `#F5B21B` | Totales, vuelto, números grandes (dorado del fuego del logo) |
| `--teja` *(nuevo)* | `#D63A1E` | Etiquetas de sección (como Café/Almuerzo/Cena en el flyer) |

- **Tipografías**: **Kalam** para la marca y los títulos (como en la web), **Roboto** para la interfaz y **números tabulares** (`font-variant-numeric: tabular-nums`) para que los montos queden alineados.
- **Colores por medio de pago**, siempre con texto, nunca solo color: Efectivo ₡ verde · Efectivo $ verde claro · SINPE azul · BAC rojo · BN verde oscuro · A cuenta dorado.
- **Botones de 64 px o más** de alto, para usarse con los dedos y con prisa.
- **El total y el vuelto en grande** (48 px o más) y en dorado sobre negro, que se lea desde lejos.
- Modo claro opcional: la web ya tiene `.light_theme`, útil para eventos de día bajo el sol.
- Logo S&J en la barra superior y en el tiquete.

---

## 8. Dónde corre: local, interno y simple

Es **solo para uso interno** (no es público) y en el lugar del evento hay poca señal, así que va **100 % local**:

- **Una app de escritorio (Electron) en la laptop de la caja.** Se instala una vez y se abre con el ícono de S&J, como cualquier programa.
- **Todo vive en la laptop**: la app y la base de datos **SQLite**, que es un solo archivo (`sj-pos.db`).
- **No necesita internet** ni servidores, cuentas en la nube ni pagos mensuales.
- **Nada es público.** Solo se usa desde la laptop y, si se quiere, desde dispositivos conectados al mismo Wi-Fi local.

**¿Por qué no Vercel/Netlify + Supabase?** Sin señal no se podría vender. Además, Vercel gratis no permite uso comercial y Supabase gratis pausa el proyecto si pasa una semana sin uso. Para un POS interno de eventos no aporta nada.

### Opcional: más de una pantalla
Si se ocupa una tablet en cocina o un celular para despachar, la laptop comparte la app en la red local. Esos dispositivos se conectan al **hotspot de la laptop o a un router Wi-Fi sin internet** y abren `http://192.168.x.x:4321`. Un **PIN** protege el acceso. Si no se ocupa, se deja apagado y la app solo funciona en la laptop.

### Respaldo (sin nube)
- **En cada cierre de caja**, la app guarda una copia de `sj-pos.db` con fecha y el PDF del cierre en `Documentos/SJ-POS/respaldos/`.
- Botón **"Respaldar a USB"**.
- Más adelante, si se quiere ver todo desde la casa, se puede agregar una sincronización a la nube, pero **no es parte del plan**.

### Detalles para que sea confiable
- SQLite en **modo WAL**: resiste que se apague la laptop de golpe.
- Laptop con **batería cargada** y suspensión desactivada durante el evento.
- El consecutivo **S&J0001** se genera en una tabla de contadores dentro de una transacción. Con SQLite nunca se duplica.

### Decisiones pendientes
| # | Decisión | Recomendación |
|---|---|---|
| 1 | ¿Pedidos programados se cargan a cuenta automáticamente o se cobran al entregar? | Configurable por cliente (`modo_pago_default`). |
| 2 | ¿Personal NUNU = una cuenta por persona o una sola cuenta "NUNU"? | Una **por persona**, ligada a la organización NUNU, para ver el total de NUNU y el de cada persona. |
| 3 | Comprobantes electrónicos de Hacienda | ✅ **Decidido: versión 2.** |
| 4 | Impresora térmica | ✅ **Decidido: Epson ESC/POS.** Falta confirmar el modelo, si es **USB o red**, si el papel es **80 o 58 mm** y si tiene **gaveta** conectada. |
| 5 | ¿Una sola laptop o también tablet/celular por Wi-Fi local? | Empezar con **solo la laptop**; la red local es un interruptor que se activa si hace falta. |

---

## 9. Stack técnico

| Capa | Tecnología | Por qué |
|---|---|---|
| App de escritorio | **Electron** + `electron-builder` (instalador .exe) | Funciona sin internet y se abre como un programa. |
| Interfaz | **Astro** (adaptador Node) + **Preact** en la pantalla de venta | Mismo framework y estilos que la web de S&J. |
| Estilos | **Tailwind 4** con los tokens de `global.css` de la web | Mismo look que la web. |
| Base de datos | **SQLite** (`better-sqlite3`, modo WAL) | Un archivo, cero configuración, rapidísimo. |
| ORM | **Drizzle ORM** | Tipado y migraciones. |
| Validación | **Zod** | Montos y métodos de pago siempre válidos. |
| Acceso | PIN con hash (bcrypt) | Simple y suficiente para uso interno. |
| Impresora térmica | **`node-thermal-printer`** (ESC/POS, modo Epson) por USB o LAN | Imprime directo, corta el papel y abre la gaveta. |
| PDF del cierre | `webContents.printToPDF()` de Electron | Nativo. |

Estructura sugerida:
```
sj-pos/
├─ electron/main.ts       (abre la ventana, levanta el servidor local, respaldos)
├─ src/
│  ├─ pages/              (login, vender, pedidos, programados, cuentas, caja, admin)
│  ├─ pages/api/          (ventas, pagos, clientes, caja, reportes)
│  ├─ components/pos/     (Grid, Carrito, ModalCobro, Vuelto)
│  ├─ db/schema.ts        (Drizzle + SQLite)
│  ├─ lib/                (dinero.ts, cierre.ts, permisos.ts)
│  └─ styles/global.css   (de la web + tokens nuevos)
├─ drizzle/               (migraciones)
└─ seed/productos.csv     (lista de precios actual)
```

---

## 10. Fases

### Fase 0 — Base (1–2 días)
- Repo, Electron + Astro funcionando, esquema SQLite y seed de productos con la lista de precios.
- Login con PIN y roles.

### Fase 1 — MVP para vender en un evento ⭐ (1–2 semanas)
- Apertura de caja con fondo.
- Pantalla de venta: cuadrícula, carrito, notas, agotado.
- Cobro: **efectivo con vuelto**, SINPE, BAC, BN y **pago dividido**.
- **A cuenta** con clientes registrados y **numeración S&J0001**.
- Cola de pedidos: pendiente → listo → entregado.
- Anulación con PIN de admin.
- **Cierre de caja** con conteo por denominación, verificación de SINPE, lotes de datáfono y reporte imprimible.
- **Clientes con nombre + cédula + S&J000X.**
- **Impresión en Epson**: tiquete de venta, apertura de cuenta y cargo a cuenta con firma.

> Con la Fase 1 ya se puede trabajar un evento completo.

### Fase 2 — Cuentas por cobrar completas (3–5 días)
- Estado de cuenta y abonos (que entran al cierre), con sus tiquetes, límites de crédito, antigüedad de saldos.
- Entradas y salidas de efectivo.

### Fase 3 — Pedidos programados de empresas (1 semana)
- Carga tipo hoja e importación desde Excel/CSV.
- Entregas parciales, cargo automático a cuenta y hoja de despacho imprimible por día.

### Fase 4 — Extras
- Pantalla de cocina, reportes por evento/producto/cajero, exportar a Excel.
- Comanda de cocina impresa, red local para tablet/celular y, si algún día hace falta, sincronización a la nube.

### Versión 2 — Comprobantes electrónicos
- Facturas y tiquetes electrónicos de Hacienda, por medio de un proveedor autorizado, usando la cédula que ya se guarda de cada cliente.

---

## 11. Checklist de pruebas antes del primer evento

- [ ] Venta en efectivo con vuelto (incluye "exacto" y billetes grandes).
- [ ] Pago dividido SINPE + efectivo.
- [ ] Pago en dólares ($20 por un total de ₡8 200) → vuelto correcto en colones, y en el cierre los $ cuadran por aparte.
- [ ] Venta a cuenta → aparece en el estado de cuenta del cliente con su S&J000X.
- [ ] Crear cliente nuevo desde el cobro → recibe el siguiente consecutivo.
- [ ] Dos tablets vendiendo al mismo tiempo → sin números de orden ni cuentas duplicados.
- [ ] Anular venta → sale del total del cierre y queda en la bitácora.
- [ ] Abono a cuenta → entra en el cierre del día como abono, no como venta.
- [ ] Cierre con diferencia → muestra faltante/sobrante y exige nota.
- [ ] Imprimir en la Epson real: venta, apertura de cuenta (2 copias), cargo a cuenta y cierre. Verificar el corte del papel y la gaveta.
- [ ] Registrar un cliente con una cédula repetida → el sistema avisa y muestra la cuenta existente.
- [ ] Apagar la laptop de golpe a media venta → al abrir de nuevo, los datos están completos.
- [ ] Restaurar un respaldo (`sj-pos.db`) en otra laptop.

---

## 12. Siguiente paso

1. Responder las **decisiones pendientes de §8** (sobre todo NUNU y el modelo de la impresora Epson).
2. Arrancar la **Fase 0**: Electron + Astro + SQLite con la lista de precios cargada.
3. Hacer un mockup de la **pantalla de venta + modal de cobro**, que es donde más importa el diseño.
