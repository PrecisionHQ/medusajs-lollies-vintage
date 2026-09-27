import { MedusaService } from "@medusajs/framework/utils";
import { FlowConfig, FlowLog, MarketingOptOut } from "./models";

class MarketingModuleService extends MedusaService({
  FlowConfig,
  FlowLog,
  MarketingOptOut,
}) {}

export default MarketingModuleService;
