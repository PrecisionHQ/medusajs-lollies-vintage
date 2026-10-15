import { MedusaService } from "@medusajs/framework/utils";
import { AffiliateCreator, AffiliateHit, AffiliatePayout } from "./models";

class AffiliateModuleService extends MedusaService({
  AffiliateCreator,
  AffiliateHit,
  AffiliatePayout,
}) {}

export default AffiliateModuleService;
