import type { PartialMessages } from '../../translate'
import { de as common } from './common'
import { de as settings } from './settings'
import { de as present } from './present'
import { de as live } from './live'

const messages: PartialMessages = { ...common, ...settings, ...present, ...live }
export default messages
