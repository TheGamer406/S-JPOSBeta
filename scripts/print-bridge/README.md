# Puente de impresión (solo Windows)

El POS corre dentro de un contenedor **Linux** (Docker Desktop). Un USB conectado a
Windows no aparece dentro de ese contenedor, así que la impresión directa a la AON se
hace con este puente, que corre **en el host de Windows**:

```
POS (contenedor Linux)  --ESC/POS por TCP-->  host.docker.internal:9100
                                               │
                                               ▼
                                 bridge-impresion.ps1 (Windows)
                                               │  copy /b (RAW)
                                               ▼
                                     Impresora AON compartida
```

## Configuración en Windows (una sola vez)

1. **Instalar la AON.** Sirve su driver propio o el driver **"Generic / Text Only"**.
2. **Compartir la impresora** con un nombre corto, p. ej. `AON`
   (Propiedades de impresora → *Compartir* → *Compartir esta impresora*).
3. Si Windows pregunta por el Firewall al arrancar el puente, permitir en **red privada**.

## Arranque

`INICIAR-POS.bat` ya arranca el puente solo, en una ventana minimizada, usando el
nombre de recurso compartido `AON` (o el que pongas en la variable
`SJ_POS_IMPRESORA_SHARE`).

Para arrancarlo a mano:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\print-bridge\bridge-impresion.ps1 -Impresora AON
```

El contenedor ya viene apuntado al puente por `docker-compose.windows.yml`
(`SJ_POS_IMPRESORA_INTERFAZ=tcp://host.docker.internal:9100`).

## Si no imprime

- Confirmá que la impresora esté **compartida** con el nombre que usa el puente.
- Probá imprimir a mano: `copy /b algo.txt \\localhost\AON`.
- Mirá la ventana del puente: muestra una línea por cada tiquete enviado o el error.
- Mientras tanto, el POS nunca pierde el tiquete: cae a vista previa/descarga en
  pantalla (ver Fase 6).
