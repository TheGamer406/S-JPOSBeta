CREATE TABLE `auditoria` (
	`id` text PRIMARY KEY NOT NULL,
	`usuario_id` text NOT NULL,
	`accion` text NOT NULL,
	`entidad` text NOT NULL,
	`entidad_id` text NOT NULL,
	`detalle` text,
	`creado_en` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categorias` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `clientes` (
	`id` text PRIMARY KEY NOT NULL,
	`numero_cuenta` text NOT NULL,
	`tipo` text NOT NULL,
	`nombre` text NOT NULL,
	`cedula` text NOT NULL,
	`tipo_cedula` text NOT NULL,
	`telefono` text,
	`organizacion` text,
	`contacto_encargado` text,
	`limite_credito` integer,
	`estado` text DEFAULT 'activo' NOT NULL,
	`notas` text,
	`creado_en` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `clientes_numero_cuenta_unique` ON `clientes` (`numero_cuenta`);--> statement-breakpoint
CREATE UNIQUE INDEX `clientes_cedula_unique` ON `clientes` (`cedula`);--> statement-breakpoint
CREATE TABLE `contadores` (
	`nombre` text PRIMARY KEY NOT NULL,
	`valor` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `eventos` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`fecha_inicio` text NOT NULL,
	`fecha_fin` text NOT NULL,
	`notas` text
);
--> statement-breakpoint
CREATE TABLE `movimientos_caja` (
	`id` text PRIMARY KEY NOT NULL,
	`sesion_caja_id` text NOT NULL,
	`tipo` text NOT NULL,
	`monto` integer NOT NULL,
	`motivo` text NOT NULL,
	`usuario_id` text NOT NULL,
	`creado_en` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`sesion_caja_id`) REFERENCES `sesiones_caja`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `movimientos_cuenta` (
	`id` text PRIMARY KEY NOT NULL,
	`cliente_id` text NOT NULL,
	`tipo` text NOT NULL,
	`monto` integer NOT NULL,
	`venta_id` text,
	`pago_id` text,
	`nota` text,
	`usuario_id` text NOT NULL,
	`creado_en` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venta_id`) REFERENCES `ventas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pago_id`) REFERENCES `pagos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `pagos` (
	`id` text PRIMARY KEY NOT NULL,
	`sesion_caja_id` text NOT NULL,
	`venta_id` text,
	`cliente_id` text,
	`metodo` text NOT NULL,
	`monto_usd` integer,
	`tipo_cambio` integer,
	`monto` integer NOT NULL,
	`recibido` integer,
	`vuelto` integer,
	`referencia` text,
	`verificado` integer DEFAULT false NOT NULL,
	`usuario_id` text NOT NULL,
	`creado_en` text DEFAULT (current_timestamp) NOT NULL,
	`anulado` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`sesion_caja_id`) REFERENCES `sesiones_caja`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`venta_id`) REFERENCES `ventas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `productos` (
	`id` text PRIMARY KEY NOT NULL,
	`categoria_id` text NOT NULL,
	`nombre` text NOT NULL,
	`precio` integer NOT NULL,
	`activo` integer DEFAULT true NOT NULL,
	`agotado` integer DEFAULT false NOT NULL,
	`orden` integer DEFAULT 0 NOT NULL,
	`color` text,
	FOREIGN KEY (`categoria_id`) REFERENCES `categorias`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sesiones_caja` (
	`id` text PRIMARY KEY NOT NULL,
	`evento_id` text,
	`dispositivo` text NOT NULL,
	`abierta_por` text NOT NULL,
	`abierta_en` text DEFAULT (current_timestamp) NOT NULL,
	`fondo_inicial` integer NOT NULL,
	`tipo_cambio_usd` integer NOT NULL,
	`cerrada_por` text,
	`cerrada_en` text,
	`efectivo_contado` integer,
	`conteo_denominaciones` text,
	`usd_contado` integer,
	`conteo_usd` text,
	`lote_bac` integer,
	`lote_bn` integer,
	`diferencia_efectivo` integer,
	`notas_cierre` text,
	`estado` text DEFAULT 'abierta' NOT NULL,
	FOREIGN KEY (`evento_id`) REFERENCES `eventos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`abierta_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cerrada_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `usuarios` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`rol` text NOT NULL,
	`pin_hash` text NOT NULL,
	`password_hash` text,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `venta_items` (
	`id` text PRIMARY KEY NOT NULL,
	`venta_id` text NOT NULL,
	`producto_id` text NOT NULL,
	`nombre_snapshot` text NOT NULL,
	`precio_snapshot` integer NOT NULL,
	`cantidad` integer NOT NULL,
	`cantidad_entregada` integer DEFAULT 0 NOT NULL,
	`nota` text,
	`subtotal` integer NOT NULL,
	FOREIGN KEY (`venta_id`) REFERENCES `ventas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`producto_id`) REFERENCES `productos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ventas` (
	`id` text PRIMARY KEY NOT NULL,
	`sesion_caja_id` text NOT NULL,
	`numero_orden_dia` integer NOT NULL,
	`tipo` text NOT NULL,
	`cliente_id` text,
	`nombre_referencia` text,
	`usuario_id` text NOT NULL,
	`subtotal` integer NOT NULL,
	`descuento` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`estado_pago` text DEFAULT 'pendiente' NOT NULL,
	`estado_pedido` text DEFAULT 'pendiente' NOT NULL,
	`fecha_programada` text,
	`tiempo_comida` text,
	`nota` text,
	`creado_en` text DEFAULT (current_timestamp) NOT NULL,
	`entregado_en` text,
	`anulada_por` text,
	`anulada_motivo` text,
	`idempotency_key` text NOT NULL,
	FOREIGN KEY (`sesion_caja_id`) REFERENCES `sesiones_caja`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`usuario_id`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`anulada_por`) REFERENCES `usuarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ventas_idempotency_key_unique` ON `ventas` (`idempotency_key`);