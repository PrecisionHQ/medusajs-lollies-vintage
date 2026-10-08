import { MedusaService } from "@medusajs/framework/utils";
import { FlowConfig, FlowLog, MarketingOptOut, NewsletterSubscription, StockSubscription } from "./models";

class MarketingModuleService extends MedusaService({
  FlowConfig,
  FlowLog,
  MarketingOptOut,
  NewsletterSubscription,
  StockSubscription,
}) {}

export default MarketingModuleService;
