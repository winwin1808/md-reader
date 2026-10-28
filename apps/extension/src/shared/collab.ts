export const DEFAULT_SERVER_URL: string = import.meta.env.VITE_MDR_SERVER_URL ?? ''
export type SyncStatus = 'off' | 'connecting' | 'online' | 'offline' | 'revoked' | 'full'
