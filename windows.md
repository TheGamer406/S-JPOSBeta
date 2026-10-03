# Arrancar el POS en Windows

Doble clic en **`INICIAR-POS.bat`** levanta todo: la imagen de Docker, el contenedor,
el puente de impresión, y abre el navegador. Pero hay dos cosas que son
responsabilidad de esa laptop, no del script.

## Antes del primer doble clic

- **Docker Desktop** instalado y **corriendo**. Si no está corriendo, el `.bat` avisa
  y no hace nada más (no lo arranca él).
- La primera vez construye la imagen (`docker compose build`), tarda varios minutos —
  no es que esté colgado.

## Si van a imprimir en la AON

(Si no, no hace falta nada de esto y el tiquete cae a vista previa en pantalla —
ver `scripts/print-bridge/README.md` y Fase 6.)

1. Instalar la impresora en Windows (driver propio o "Generic / Text Only").
2. **Compartirla** con el nombre `AON` (Propiedades de impresora → Compartir →
   Compartir esta impresora). Esto es configuración de **una sola vez** en esa
   laptop, el script no lo hace.
3. Si Windows pregunta por el Firewall al arrancar el puente
   (`bridge-impresion.ps1`), permitir en **red privada**.

## De ahí en adelante

Con eso hecho una vez, ya alcanza con doble clic en `INICIAR-POS.bat`:

- Levanta todo.
- Arranca el puente de impresión minimizado.
- Muestra en la consola la URL para la tablet de cocina
  (`http://<IP>:4321/cocina`).

Cerrar la ventana (o Ctrl+C) apaga el POS.
