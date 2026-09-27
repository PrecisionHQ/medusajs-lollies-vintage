import { MedusaService } from "@medusajs/framework/utils";
import { FlowConfig, FlowLog, MarketingOptOut, StockSubscription } from "./models";

class MarketingModuleService extends MedusaService({
  FlowConfig,
  FlowLog,
  MarketingOptOut,
  StockSubscription,
}) {}

export default MarketingModuleService;
