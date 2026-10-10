import { MedusaService } from "@medusajs/framework/utils";
import { FlowConfig, FlowLog, MarketingCampaign, MarketingCampaignSend, MarketingOptOut, NewsletterSubscription, StockSubscription } from "./models";

class MarketingModuleService extends MedusaService({
  FlowConfig,
  FlowLog,
  MarketingCampaign,
  MarketingCampaignSend,
  MarketingOptOut,
  NewsletterSubscription,
  StockSubscription,
}) {}

export default MarketingModuleService;
