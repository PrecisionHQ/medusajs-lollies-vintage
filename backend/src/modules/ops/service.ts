import { MedusaService } from "@medusajs/framework/utils";
import { OpsHeartbeat } from "./models";

class OpsModuleService extends MedusaService({
  OpsHeartbeat,
}) {}

export default OpsModuleService;
