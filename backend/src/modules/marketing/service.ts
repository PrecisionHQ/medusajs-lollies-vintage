import { MedusaService } from "@medusajs/framework/utils";
import { FlowConfig, FlowLog, MarketingAdSpend, MarketingCampaign, MarketingCampaignSend, MarketingOptOut, NewsletterSubscription, StockSubscription } from "./models";

class MarketingModuleService extends MedusaService({
  FlowConfig,
  FlowLog,
  MarketingAdSpend,
  MarketingCampaign,
  MarketingCampaignSend,
  MarketingOptOut,
  NewsletterSubscription,
  StockSubscription,
}) {}

export default MarketingModuleService;
