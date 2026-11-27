import type { PartialMessages } from '../../translate'
import { it as common } from './common'
import { it as settings } from './settings'
import { it as present } from './present'
import { it as live } from './live'

const messages: PartialMessages = { ...common, ...settings, ...present, ...live }
export default messages
