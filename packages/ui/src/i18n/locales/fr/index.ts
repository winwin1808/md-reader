import type { PartialMessages } from '../../translate'
import { fr as common } from './common'
import { fr as settings } from './settings'
import { fr as present } from './present'
import { fr as live } from './live'
import { fr as shell } from './shell'

const messages: PartialMessages = { ...common, ...settings, ...present, ...live, ...shell }
export default messages
