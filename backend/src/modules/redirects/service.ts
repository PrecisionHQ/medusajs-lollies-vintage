import { MedusaService } from "@medusajs/framework/utils";
import { Redirect, NotFoundLog } from "./models";

class RedirectModuleService extends MedusaService({
  Redirect,
  NotFoundLog,
}) {}

export default RedirectModuleService;
