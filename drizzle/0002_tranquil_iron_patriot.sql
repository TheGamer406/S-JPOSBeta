PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_ventas` (
	`id` text PRIMARY KEY NOT NULL,
	`sesion_caja_id` text,
	`numero_orden_dia` integer,
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
INSERT INTO `__new_ventas`("id", "sesion_caja_id", "numero_orden_dia", "tipo", "cliente_id", "nombre_referencia", "usuario_id", "subtotal", "descuento", "total", "estado_pago", "estado_pedido", "fecha_programada", "tiempo_comida", "nota", "creado_en", "entregado_en", "anulada_por", "anulada_motivo", "idempotency_key") SELECT "id", "sesion_caja_id", "numero_orden_dia", "tipo", "cliente_id", "nombre_referencia", "usuario_id", "subtotal", "descuento", "total", "estado_pago", "estado_pedido", "fecha_programada", "tiempo_comida", "nota", "creado_en", "entregado_en", "anulada_por", "anulada_motivo", "idempotency_key" FROM `ventas`;--> statement-breakpoint
DROP TABLE `ventas`;--> statement-breakpoint
ALTER TABLE `__new_ventas` RENAME TO `ventas`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `ventas_idempotency_key_unique` ON `ventas` (`idempotency_key`);