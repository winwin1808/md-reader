import type { PartialMessages } from '../../translate'
import { fr as common } from './common'
import { fr as settings } from './settings'
import { fr as present } from './present'
import { fr as live } from './live'
import { fr as shell } from './shell'
import { fr as ext } from './ext'
import { fr as web } from './web'

// Completeness is enforced by catalog-parity.test.ts.
const messages: PartialMessages = { ...common, ...settings, ...present, ...live, ...shell, ...ext, ...web }
export default messages
