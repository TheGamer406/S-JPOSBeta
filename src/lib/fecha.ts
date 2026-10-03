/**
 * El default `CURRENT_TIMESTAMP` de SQLite (usado en todo `creado_en` del esquema)
 * guarda "YYYY-MM-DD HH:MM:SS" en UTC pero sin zona horaria. `new Date()` de JS
 * interpreta esa forma como hora LOCAL del navegador, no UTC — en Costa Rica
 * (UTC-6) eso corre los minutos transcurridos ~6 horas hacia atrás (quedan
 * negativos), y la alerta de pedido tardío (`minutos > 15`) nunca dispara.
 * Se normaliza a ISO 8601 con "Z" antes de parsear.
 */
export function epochDeFechaSqlite(texto: string): number {
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(texto)) return new Date(texto).getTime();
  return new Date(`${texto.replace(' ', 'T')}Z`).getTime();
}

/**
 * Para mostrarle a alguien la fecha/hora (ej. de un movimiento de cuenta o la
 * bitácora). Fija la zona horaria del negocio explícitamente en vez de confiar
 * en la del dispositivo — el servidor corre en UTC dentro de Docker, así que
 * sin esto la hora mostrada en server-side rendering saldría mal igual.
 */
export function formatoFechaHora(texto: string): string {
  return new Date(epochDeFechaSqlite(texto)).toLocaleString('es-CR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Costa_Rica',
  });
}
