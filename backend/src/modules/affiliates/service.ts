import { MedusaService } from "@medusajs/framework/utils";
import { AffiliateCreator, AffiliateHit } from "./models";

class AffiliateModuleService extends MedusaService({
  AffiliateCreator,
  AffiliateHit,
}) {}

export default AffiliateModuleService;
