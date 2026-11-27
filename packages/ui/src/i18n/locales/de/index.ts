import type { PartialMessages } from '../../translate'
import { de as common } from './common'
import { de as settings } from './settings'
import { de as present } from './present'
import { de as live } from './live'
import { de as shell } from './shell'
import { de as ext } from './ext'
import { de as web } from './web'

const messages: PartialMessages = { ...common, ...settings, ...present, ...live, ...shell, ...ext, ...web }
export default messages
