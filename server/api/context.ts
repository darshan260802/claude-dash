import type { SessionIndex } from '../index/SessionIndex.ts'
import type { PricingService } from '../pricing/PricingService.ts'
import type { EventHub } from './events.ts'
import type { Config } from '../config.ts'

export interface RouteContext {
  index: SessionIndex
  pricing: PricingService
  hub: EventHub
  config: Config
  version: string
}
