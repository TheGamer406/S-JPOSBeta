#!/usr/bin/env bash
#
# Levanta el POS en Docker para probar la impresora AON física conectada a
# este equipo (Linux). A diferencia de iniciar-pos.sh (que usa la impresora
# si está y sigue sin ella si no), este script EXIGE que la impresora esté
# conectada y avisa si no la detecta, para no probar "en falso".
#
# Uso:  ./probar-impresora.sh
#
# Qué hace:
#   1. Verifica que /dev/usb/lp0 exista (si no, dice qué revisar y sale).
#   2. Reconstruye la imagen desde cero (por si cambiaste algo del código).
#   3. Levanta el contenedor con el override de impresora de Linux.
#   4. Deja los logs en pantalla para ver el intento de impresión en vivo.
#
# Para probar de verdad: entrá a http://localhost:4321, logueate, abrí caja,
# hacé una venta y confirmá "Imprimir" en el tiquete — o imprimí el tiquete
# de apertura de cuenta / abono / cierre, lo que quieras probar.

set -uo pipefail
cd "$(dirname "$(readlink -f "$0")")" || exit 1

URL="http://localhost:4321"
ROJO=$'\e[31m'; VERDE=$'\e[32m'; AMARILLO=$'\e[33m'; NORMAL=$'\e[0m'
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.linux.yml"

echo "=============================================="
echo "   S&J POS — prueba de impresora (Docker)"
echo "=============================================="
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "${ROJO}No se encontró Docker.${NORMAL}"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "${ROJO}Docker no está corriendo.${NORMAL}"
  exit 1
fi

if [ ! -e /dev/usb/lp0 ]; then
  echo "${ROJO}No se detecta la impresora en /dev/usb/lp0.${NORMAL}"
  echo
  echo "Revisá:"
  echo "  - Que la AON esté conectada por USB y encendida."
  echo "  - ls -l /dev/usb/   (debería listar lp0)"
  echo "  - Que tu usuario esté en el grupo lp: groups \$USER"
  echo
  exit 1
fi
echo "${VERDE}Impresora detectada en /dev/usb/lp0.${NORMAL}"

SJ_POS_LP_GID="$(getent group lp | cut -d: -f3)"
export SJ_POS_LP_GID
echo "Grupo lp del sistema: GID $SJ_POS_LP_GID"
echo

echo "Reconstruyendo la imagen (por si hay cambios de código)..."
$COMPOSE build || { echo "${ROJO}Falló la construcción.${NORMAL}"; exit 1; }

# Arranque limpio: evita que quede un contenedor viejo con otra config.
$COMPOSE down >/dev/null 2>&1

echo
echo "Arrancando el POS con la impresora conectada..."
$COMPOSE up -d || { echo "${ROJO}No se pudo arrancar.${NORMAL}"; exit 1; }

trap 'echo; echo "Apagando..."; $COMPOSE down >/dev/null 2>&1; exit 0' INT TERM

echo -n "Esperando"
for _ in $(seq 1 60); do
  if curl -s -o /dev/null -m 1 "$URL" 2>/dev/null; then echo " listo."; break; fi
  echo -n "."
  sleep 1
done

echo
echo "${VERDE}POS arriba en $URL${NORMAL}"
echo
echo "${AMARILLO}Para probar la impresión real:${NORMAL}"
echo "  1. Abrí $URL y entrá con un PIN (Admin: el que sembró la base, por"
echo "     defecto 0000 salvo que hayas usado SJ_POS_ADMIN_PIN)."
echo "  2. Abrí caja en /caja/abrir."
echo "  3. Hacé una venta cualquiera en /vender y confirmá \"Imprimir\" en el"
echo "     tiquete — o probá apertura de cuenta / abono / cierre desde /cuentas"
echo "     y /caja/cerrar."
echo "  4. Mirá el papel salir y los logs de abajo (cada intento de impresión"
echo "     deja rastro acá si falla)."
echo
echo "Ctrl+C para apagar el POS."
echo

$COMPOSE logs -f
