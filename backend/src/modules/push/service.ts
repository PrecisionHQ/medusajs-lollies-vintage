import { MedusaService } from "@medusajs/framework/utils";
import { PushSubscription } from "./models";

class PushModuleService extends MedusaService({
  PushSubscription,
}) {}

export default PushModuleService;
