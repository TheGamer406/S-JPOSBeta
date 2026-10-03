# Puente de impresión para Windows (Fase 5).
#
# El POS corre dentro de un contenedor Linux (Docker Desktop) y no puede tocar el
# USB de Windows directo. Este puente corre en Windows: escucha en un puerto TCP y
# reenvía los bytes ESC/POS que le manda el contenedor a la impresora AON compartida.
#
# El contenedor imprime con SJ_POS_IMPRESORA_INTERFAZ=tcp://host.docker.internal:9100
# (ya configurado en docker-compose.windows.yml).
#
# Requisitos en Windows (una sola vez):
#   1. Instalar la AON. Sirve su driver, o el driver "Generic / Text Only".
#   2. Compartir la impresora: Propiedades de impresora > Compartir > nombre de recurso
#      compartido (ej. "AON"). Ese nombre es el que se pasa en -Impresora / SJ_POS_IMPRESORA_SHARE.
#   3. Permitir el puerto 9100 en el Firewall si Windows lo pregunta (red privada).
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File bridge-impresion.ps1 -Impresora AON
#   (INICIAR-POS.bat ya lo arranca solo.)

param(
  [int]$Puerto = 9100,
  [string]$Impresora = $env:SJ_POS_IMPRESORA_SHARE
)

if (-not $Impresora -or $Impresora -eq "") { $Impresora = "AON" }
$destino = "\\localhost\$Impresora"

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Puerto)
$listener.Start()
Write-Host "Puente de impresion S&J escuchando en 0.0.0.0:$Puerto  ->  $destino"
Write-Host "Dejar esta ventana abierta mientras se use el POS. Cerrarla apaga el puente."

try {
  while ($true) {
    $cliente = $listener.AcceptTcpClient()
    try {
      $stream = $cliente.GetStream()
      $tmp = [System.IO.Path]::GetTempFileName()
      $fs = [System.IO.File]::OpenWrite($tmp)
      $buffer = New-Object byte[] 4096
      while (($n = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $fs.Write($buffer, 0, $n)
      }
      $fs.Close()

      # copy /b manda el archivo tal cual (RAW) a la impresora compartida.
      cmd /c copy /b "`"$tmp`"" "$destino" > $null 2>&1
      Remove-Item $tmp -Force -ErrorAction SilentlyContinue
      Write-Host ("{0}  ticket enviado a {1}" -f (Get-Date -Format HH:mm:ss), $destino)
    }
    catch {
      Write-Warning ("No se pudo imprimir: {0}" -f $_)
    }
    finally {
      $cliente.Close()
    }
  }
}
finally {
  $listener.Stop()
}
