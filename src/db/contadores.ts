import { sqlite } from './client';

// Consecutivos atómicos vía transacción (§4). SQLite escribe de una a la vez,
// así que el número nunca se repite aunque dos pantallas vendan al mismo tiempo.
const siguiente = sqlite.transaction((nombre: 'cuenta' | 'orden_dia') => {
  sqlite.prepare('UPDATE contadores SET valor = valor + 1 WHERE nombre = ?').run(nombre);
  const fila = sqlite
    .prepare('SELECT valor FROM contadores WHERE nombre = ?')
    .get(nombre) as { valor: number };
  return fila.valor;
});

export function siguienteNumeroCuenta(): string {
  const valor = siguiente('cuenta');
  return `S&J${String(valor).padStart(4, '0')}`;
}

export function siguienteNumeroOrdenDia(): number {
  return siguiente('orden_dia');
}

export function reiniciarNumeroOrdenDia(): void {
  // Se llama al abrir una nueva sesión de caja de un día distinto (§3.2: el número de
  // orden se reinicia cada día). No reinicia el consecutivo de cuentas, que nunca se reutiliza.
  sqlite.prepare("UPDATE contadores SET valor = 0 WHERE nombre = 'orden_dia'").run();
}
