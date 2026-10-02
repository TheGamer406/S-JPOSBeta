#!/usr/bin/env bash
#
# Arranca el POS de S&J y abre el navegador.
#
# Pensado para usarse con doble clic (ver instalar-acceso-directo.sh, que crea
# el ícono en el escritorio). También sirve desde la terminal: ./iniciar-pos.sh
#
# Deja la terminal abierta mientras el POS corre: cerrarla apaga el sistema.

set -uo pipefail

# Ubicarse en la carpeta del proyecto sin importar desde dónde se ejecute.
cd "$(dirname "$(readlink -f "$0")")" || exit 1

PUERTO=4321
URL="http://localhost:$PUERTO"
ROJO=$'\e[31m'; VERDE=$'\e[32m'; AMARILLO=$'\e[33m'; NORMAL=$'\e[0m'

echo "=============================================="
echo "   S&J POS"
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

if ! command -v npm >/dev/null 2>&1; then
  echo "${ROJO}No se encontró npm (Node.js).${NORMAL}"
  echo "Hay que instalar Node.js en esta computadora antes de usar el POS."
  read -r -p "Enter para cerrar..."
  exit 1
fi

# Primera vez en una computadora nueva: faltan las librerías.
if [ ! -d node_modules ]; then
  echo "Primera vez acá: instalando lo necesario (tarda unos minutos)..."
  if ! npm install; then
    echo "${ROJO}Falló la instalación.${NORMAL}"
    read -r -p "Enter para cerrar..."
    exit 1
  fi
  echo
fi

# Base de datos nueva: crearla con los productos y un usuario para entrar.
if [ ! -f sj-pos.db ]; then
  echo "Creando la base de datos por primera vez..."
  npm run db:migrate || { echo "${ROJO}Falló la creación de la base.${NORMAL}"; read -r -p "Enter..."; exit 1; }
  SJ_POS_ADMIN_PIN="${SJ_POS_ADMIN_PIN:-1234}" npm run db:seed
  echo
  echo "${AMARILLO}Se creó un usuario Admin con PIN ${SJ_POS_ADMIN_PIN:-1234}.${NORMAL}"
  echo "${AMARILLO}Cambialo desde Usuarios antes de usarlo en un evento real.${NORMAL}"
  echo
fi

echo "Arrancando el POS..."
npm run dev &
PID_SERVIDOR=$!

# Al cerrar esta ventana (o Ctrl+C), apagar también el servidor.
trap 'echo; echo "Cerrando el POS..."; kill $PID_SERVIDOR 2>/dev/null; exit 0' INT TERM

# Esperar a que conteste de verdad antes de abrir el navegador.
echo -n "Esperando"
for _ in $(seq 1 60); do
  if curl -s -o /dev/null -m 1 "$URL" 2>/dev/null; then
    echo " listo."
    break
  fi
  # Si el servidor murió mientras arrancaba, no seguir esperando en vano.
  if ! kill -0 $PID_SERVIDOR 2>/dev/null; then
    echo
    echo "${ROJO}El POS no pudo arrancar. Revisá los mensajes de arriba.${NORMAL}"
    read -r -p "Enter para cerrar..."
    exit 1
  fi
  echo -n "."
  sleep 1
done

echo
echo "${VERDE}POS abierto en $URL${NORMAL}"
echo
# La IP de la red sirve para entrar desde una tablet (ej. la pantalla de cocina).
# `hostname -I` no existe en todas las distros (inetutils no lo trae), así que
# se saca de la ruta por defecto, que es lo más portable.
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

wait $PID_SERVIDOR
