#!/usr/bin/env bash
#
# Arranca el POS de S&J en Docker y abre el navegador.
#
# Pensado para usarse con doble clic (ver instalar-acceso-directo.sh, que crea
# el ícono en el escritorio). También sirve desde la terminal: ./iniciar-pos.sh
#
# Esta ventana controla el POS: cerrarla (o Ctrl+C) lo apaga. La base y los
# respaldos quedan en ./datos y sobreviven al apagado.

set -uo pipefail

# Ubicarse en la carpeta del proyecto sin importar desde dónde se ejecute.
cd "$(dirname "$(readlink -f "$0")")" || exit 1

PUERTO=4321
URL="http://localhost:$PUERTO"
ROJO=$'\e[31m'; VERDE=$'\e[32m'; AMARILLO=$'\e[33m'; NORMAL=$'\e[0m'
# El override de Linux mapea /dev/usb/lp0 con "devices:", y Docker falla al arrancar
# si ese dispositivo no existe. Por eso solo se agrega cuando la impresora está
# conectada; sin impresora, los tiquetes caen a vista previa/descarga en pantalla.
COMPOSE="docker compose -f docker-compose.yml"
IMPRESORA_NOTA=""
if [ -e /dev/usb/lp0 ]; then
  COMPOSE="$COMPOSE -f docker-compose.linux.yml"
else
  IMPRESORA_NOTA="(impresora no detectada en /dev/usb/lp0 — los tiquetes saldrán en pantalla)"
fi

echo "=============================================="
echo "   S&J POS  (Docker)"
echo "=============================================="
echo

# Si ya hay una instancia corriendo, no levantar otra: abrir la que existe.
if curl -s -o /dev/null -m 2 "$URL" 2>/dev/null; then
  echo "${AMARILLO}El POS ya estaba abierto. Se abre el navegador.${NORMAL}"
  xdg-open "$URL" >/dev/null 2>&1 &
  echo
  read -r -p "Enter para cerrar esta ventana (el POS sigue funcionando)..."
  exit 0
fi

# Docker tiene que estar instalado y corriendo.
if ! command -v docker >/dev/null 2>&1; then
  echo "${ROJO}No se encontró Docker.${NORMAL}"
  echo "Instalá Docker en esta computadora antes de usar el POS."
  read -r -p "Enter para cerrar..."
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "${ROJO}Docker está instalado pero no está corriendo.${NORMAL}"
  echo "Arrancá el servicio de Docker y volvé a abrir esto."
  read -r -p "Enter para cerrar..."
  exit 1
fi

# El GID del grupo "lp" del host, para que el contenedor pueda escribir la impresora.
export SJ_POS_LP_GID="$(getent group lp | cut -d: -f3)"
[ -n "$SJ_POS_LP_GID" ] || unset SJ_POS_LP_GID

# Primera vez (o tras cambios de código): construir la imagen si no existe.
if ! docker image inspect sj-pos:latest >/dev/null 2>&1; then
  echo "Primera vez acá: construyendo la imagen (tarda unos minutos)..."
  if ! $COMPOSE build; then
    echo "${ROJO}Falló la construcción de la imagen.${NORMAL}"
    read -r -p "Enter para cerrar..."
    exit 1
  fi
  echo
fi

# Al cerrar esta ventana (o Ctrl+C), apagar el contenedor.
trap 'echo; echo "Apagando el POS..."; $COMPOSE down >/dev/null 2>&1; exit 0' INT TERM HUP

echo "Arrancando el POS..."
[ -n "$IMPRESORA_NOTA" ] && echo "${AMARILLO}$IMPRESORA_NOTA${NORMAL}"
$COMPOSE up -d || { echo "${ROJO}No se pudo arrancar.${NORMAL}"; read -r -p "Enter..."; exit 1; }

# Esperar a que conteste de verdad antes de abrir el navegador.
echo -n "Esperando"
LISTO=0
for _ in $(seq 1 60); do
  if curl -s -o /dev/null -m 1 "$URL" 2>/dev/null; then LISTO=1; echo " listo."; break; fi
  echo -n "."
  sleep 1
done
if [ "$LISTO" = "0" ]; then
  echo
  echo "${ROJO}El POS no respondió a tiempo. Revisá los logs:${NORMAL}  $COMPOSE logs"
  read -r -p "Enter para cerrar..."
  exit 1
fi

echo
echo "${VERDE}POS abierto en $URL${NORMAL}"
echo
# IP de la red para entrar desde una tablet (ej. la pantalla de cocina).
IP_RED=$(ip route get 1.1.1.1 2>/dev/null | grep -oP '\bsrc \K[0-9.]+' | head -1)
[ -n "$IP_RED" ] || IP_RED=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -n "$IP_RED" ]; then
  echo "Desde una tablet en el mismo WiFi:  http://$IP_RED:$PUERTO/cocina"
  echo
fi
echo "${AMARILLO}NO cierres esta ventana mientras uses el POS.${NORMAL}"
echo "Para apagarlo: cerrá esta ventana o presioná Ctrl+C."
echo

xdg-open "$URL" >/dev/null 2>&1 &

# Quedarse en primer plano mostrando los logs; cerrar la ventana dispara el trap.
$COMPOSE logs -f
