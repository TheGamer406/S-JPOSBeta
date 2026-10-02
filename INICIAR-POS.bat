@echo off
REM ==========================================================
REM   S&J POS - abrir con doble clic (Windows)
REM ==========================================================
REM
REM Instala lo que falte, crea la base la primera vez, levanta el
REM servidor y abre el navegador.
REM
REM IMPORTANTE: esta ventana ES el POS. Cerrarla lo apaga.

chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

title S&J POS

echo ==============================================
echo    S^&J POS
echo ==============================================
echo.

REM --- Node instalado? ---
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] No se encontro Node.js en esta computadora.
    echo.
    echo Hay que instalarlo primero desde: https://nodejs.org
    echo Elegi la version LTS y volve a abrir este archivo.
    echo.
    pause
    exit /b 1
)

REM --- Ya hay una instancia corriendo? Solo abrir el navegador. ---
powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:4321' -TimeoutSec 2 -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo El POS ya estaba abierto. Se abre el navegador.
    start "" "http://localhost:4321"
    echo.
    pause
    exit /b 0
)

REM --- Primera vez en esta computadora: faltan las librerias. ---
if not exist "node_modules\" (
    echo Primera vez aca: instalando lo necesario.
    echo Esto tarda varios minutos, no cierres la ventana.
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] Fallo la instalacion. Revisa los mensajes de arriba.
        pause
        exit /b 1
    )
    echo.
)

REM --- Base de datos nueva: crearla con productos y un usuario. ---
if not exist "sj-pos.db" (
    echo Creando la base de datos por primera vez...
    call npm run db:migrate
    if errorlevel 1 (
        echo.
        echo [ERROR] No se pudo crear la base de datos.
        pause
        exit /b 1
    )
    if "%SJ_POS_ADMIN_PIN%"=="" set SJ_POS_ADMIN_PIN=1234
    call npm run db:seed
    echo.
    echo  ** Se creo un usuario Admin con PIN !SJ_POS_ADMIN_PIN! **
    echo  ** Cambialo desde Usuarios antes del evento real.      **
    echo.
)

REM --- Direccion para entrar desde una tablet (pantalla de cocina). ---
REM Se toma la IP de la tarjeta que tiene salida a la red, no cualquiera
REM (una laptop suele tener varias: WiFi, cable, virtuales).
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -ne $null } ^| Select-Object -First 1).IPv4Address.IPAddress" 2^>nul`) do set IP_RED=%%i

echo Arrancando el POS...
echo.

REM Abrir el navegador recien cuando el servidor conteste de verdad.
start "" /min powershell -NoProfile -Command "for ($i=0; $i -lt 90; $i++) { try { Invoke-WebRequest -Uri 'http://localhost:4321' -TimeoutSec 1 -UseBasicParsing | Out-Null; Start-Process 'http://localhost:4321'; break } catch { Start-Sleep -Seconds 1 } }"

echo  POS abriendose en:  http://localhost:4321
if not "!IP_RED!"=="" (
    echo.
    echo  Desde una tablet en el mismo WiFi:
    echo     http://!IP_RED!:4321/cocina
)
echo.
echo  ------------------------------------------------
echo   NO cierres esta ventana mientras uses el POS.
echo   Para apagarlo: cerra esta ventana.
echo  ------------------------------------------------
echo.

call npm run dev

REM Si npm run dev termina (error o cierre), no cerrar de golpe:
REM que se alcance a leer el mensaje.
echo.
echo El POS se detuvo.
pause
