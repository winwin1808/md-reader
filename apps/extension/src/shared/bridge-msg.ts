import type { BridgeRequest } from '@md-reader/core/bridge'

export const BRIDGE_EXEC_MSG = 'mdr-bridge-exec'
export interface ExecMsg { type: typeof BRIDGE_EXEC_MSG; req: BridgeRequest; client: string }
