import type { BridgeRequest } from '@md-reader/core/bridge'

export const BRIDGE_EXEC_MSG = 'mdr-bridge-exec'
export const BRIDGE_READY_MSG = 'mdr-bridge-ready'
export interface ExecMsg { type: typeof BRIDGE_EXEC_MSG; req: BridgeRequest }
export interface ReadyMsg { type: typeof BRIDGE_READY_MSG; docId: string }
