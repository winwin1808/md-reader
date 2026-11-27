import type { Messages } from '../../vi'
import { it as common } from './common'
import { it as settings } from './settings'
import { it as present } from './present'
import { it as live } from './live'
import { it as shell } from './shell'
import { it as ext } from './ext'
import { it as web } from './web'

const messages = { ...common, ...settings, ...present, ...live, ...shell, ...ext, ...web } as Messages
export default messages
