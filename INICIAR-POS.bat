@echo off
REM ==========================================================
REM   S&J POS - abrir con doble clic (Windows, Docker)
REM ==========================================================
REM
REM Levanta el POS en Docker Desktop, arranca el puente de impresion
REM (para la AON) y abre el navegador.
REM
REM IMPORTANTE: esta ventana controla el POS. Cerrarla lo apaga.
REM La base y los respaldos quedan en la carpeta "datos".

chcp 65001 >nul
setlocal enabledelayedexpansion
cd /d "%~dp0"

title S&J POS

REM Nombre del recurso compartido de la impresora AON en Windows (ver
REM scripts\print-bridge\bridge-impresion.ps1). Cambialo si la compartiste con otro nombre.
if "%SJ_POS_IMPRESORA_SHARE%"=="" set SJ_POS_IMPRESORA_SHARE=AON

set COMPOSE=docker compose -f docker-compose.yml -f docker-compose.windows.yml

echo ==============================================
echo    S^&J POS  (Docker)
echo ==============================================
echo.

REM --- Docker Desktop corriendo? ---
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop no esta corriendo.
    echo Abri Docker Desktop, espera a que diga "running" y volve a abrir este archivo.
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

REM --- Arrancar el puente de impresion en una ventana aparte (minimizada). ---
echo Arrancando el puente de impresion (impresora "%SJ_POS_IMPRESORA_SHARE%")...
start "S&J Puente de impresion" /min powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\print-bridge\bridge-impresion.ps1" -Impresora "%SJ_POS_IMPRESORA_SHARE%"

REM --- Primera vez (o tras cambios): construir la imagen si no existe. ---
docker image inspect sj-pos:latest >nul 2>&1
if errorlevel 1 (
    echo Primera vez aca: construyendo la imagen. Esto tarda varios minutos, no cierres la ventana.
    echo.
    call %COMPOSE% build
    if errorlevel 1 (
        echo.
        echo [ERROR] Fallo la construccion de la imagen. Revisa los mensajes de arriba.
        pause
        exit /b 1
    )
    echo.
)

echo Arrancando el POS...
call %COMPOSE% up -d
if errorlevel 1 (
    echo.
    echo [ERROR] No se pudo arrancar el POS.
    pause
    exit /b 1
)

REM --- Direccion para entrar desde una tablet (pantalla de cocina). ---
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -ne $null } ^| Select-Object -First 1).IPv4Address.IPAddress" 2^>nul`) do set IP_RED=%%i

REM Abrir el navegador recien cuando el servidor conteste de verdad.
start "" /min powershell -NoProfile -Command "for ($i=0; $i -lt 90; $i++) { try { Invoke-WebRequest -Uri 'http://localhost:4321' -TimeoutSec 1 -UseBasicParsing | Out-Null; Start-Process 'http://localhost:4321'; break } catch { Start-Sleep -Seconds 1 } }"

echo.
echo  POS abriendose en:  http://localhost:4321
if not "!IP_RED!"=="" (
    echo.
    echo  Desde una tablet en el mismo WiFi:
    echo     http://!IP_RED!:4321/cocina
)
echo.
echo  ------------------------------------------------
echo   NO cierres esta ventana mientras uses el POS.
echo   Al cerrarla, el POS se apaga.
echo  ------------------------------------------------
echo.

REM Quedarse en primer plano mostrando los logs. Cerrar la ventana corta esto y
REM dispara el apagado del contenedor abajo.
call %COMPOSE% logs -f

REM Cuando se corta (Ctrl+C o cierre), apagar el contenedor.
echo.
echo Apagando el POS...
call %COMPOSE% down
pause
