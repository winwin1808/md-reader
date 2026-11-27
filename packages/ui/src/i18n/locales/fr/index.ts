import type { PartialMessages } from '../../translate'
import { fr as common } from './common'
import { fr as settings } from './settings'
import { fr as present } from './present'
import { fr as live } from './live'

const messages: PartialMessages = { ...common, ...settings, ...present, ...live }
export default messages
