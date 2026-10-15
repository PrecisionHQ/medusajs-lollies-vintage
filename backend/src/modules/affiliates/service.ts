import { MedusaService } from "@medusajs/framework/utils";
import { AffiliateCreator } from "./models";

class AffiliateModuleService extends MedusaService({
  AffiliateCreator,
}) {}

export default AffiliateModuleService;
