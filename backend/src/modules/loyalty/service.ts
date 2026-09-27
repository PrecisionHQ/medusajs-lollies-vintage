import { MedusaService } from "@medusajs/framework/utils";
import { LoyaltyAccount, LoyaltyLedger, LoyaltySettings } from "./models";

class LoyaltyModuleService extends MedusaService({
  LoyaltyAccount,
  LoyaltyLedger,
  LoyaltySettings,
}) {}

export default LoyaltyModuleService;
