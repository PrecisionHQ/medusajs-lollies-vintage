import { MedusaService } from "@medusajs/framework/utils";
import { FlowConfig, FlowLog, MarketingCampaign, MarketingOptOut, NewsletterSubscription, StockSubscription } from "./models";

class MarketingModuleService extends MedusaService({
  FlowConfig,
  FlowLog,
  MarketingCampaign,
  MarketingOptOut,
  NewsletterSubscription,
  StockSubscription,
}) {}

export default MarketingModuleService;
