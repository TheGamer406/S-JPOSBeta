#!/usr/bin/env bash
#
# Crea el ícono de "S&J POS" en el escritorio y en el menú de aplicaciones,
# para poder abrir el POS con doble clic sin pasar por la terminal.
#
# Se corre una sola vez por computadora:  ./instalar-acceso-directo.sh

set -uo pipefail

CARPETA="$(dirname "$(readlink -f "$0")")"
SCRIPT="$CARPETA/iniciar-pos.sh"
ICONO="$CARPETA/assets/icon.png"

chmod +x "$SCRIPT" 2>/dev/null

# El .desktop necesita rutas absolutas, por eso se genera acá en vez de venir
# hecho en el repo: cada computadora tiene el proyecto en otra ruta.
contenido_desktop() {
  cat <<EOF
[Desktop Entry]
Type=Application
Name=S&J POS
Comment=Sistema de ventas y cierre de caja de S&J
Exec=bash -c '"$SCRIPT"; exec bash'
Path=$CARPETA
Icon=$ICONO
Terminal=true
Categories=Office;
EOF
}

# Menú de aplicaciones.
DIR_APPS="$HOME/.local/share/applications"
mkdir -p "$DIR_APPS"
contenido_desktop > "$DIR_APPS/sj-pos.desktop"
chmod +x "$DIR_APPS/sj-pos.desktop"
echo "Agregado al menú de aplicaciones."

# Escritorio: el nombre de la carpeta cambia según el idioma del sistema, y
# xdg-user-dir devuelve el home cuando no hay escritorio configurado — en ese
# caso no sirve, o dejaría el ícono suelto en la carpeta personal.
DIR_ESCRITORIO="$(xdg-user-dir DESKTOP 2>/dev/null)"
DIR_ESCRITORIO="${DIR_ESCRITORIO%/}"
if [ -z "$DIR_ESCRITORIO" ] || [ "$DIR_ESCRITORIO" = "$HOME" ]; then
  DIR_ESCRITORIO=""
  for candidato in "$HOME/Escritorio" "$HOME/Desktop"; do
    [ -d "$candidato" ] && { DIR_ESCRITORIO="$candidato"; break; }
  done
fi

if [ -n "$DIR_ESCRITORIO" ] && [ -d "$DIR_ESCRITORIO" ]; then
  contenido_desktop > "$DIR_ESCRITORIO/sj-pos.desktop"
  chmod +x "$DIR_ESCRITORIO/sj-pos.desktop"
  # GNOME exige marcar el lanzador como de confianza para permitir el doble clic.
  gio set "$DIR_ESCRITORIO/sj-pos.desktop" metadata::trusted true 2>/dev/null
  echo "Ícono creado en: $DIR_ESCRITORIO"
else
  echo "No se encontró la carpeta del escritorio; quedó solo en el menú."
fi

echo
echo "Listo. Ya podés abrir el POS con doble clic en el ícono \"S&J POS\"."
echo "Si el escritorio pide confirmar la primera vez, elegí \"Confiar y ejecutar\"."
