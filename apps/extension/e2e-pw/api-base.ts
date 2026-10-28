export function apiBase(): string {
  return `http://localhost:${process.env.MDR_E2E_PORT || '8787'}`
}
