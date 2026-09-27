import { MedusaService } from "@medusajs/framework/utils";
import { Bundle, BundleComponent } from "./models";

class BundleModuleService extends MedusaService({
  Bundle,
  BundleComponent,
}) {}

export default BundleModuleService;
