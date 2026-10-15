import { Module } from "@medusajs/framework/utils";
import OpsModuleService from "./service";

export const OPS_MODULE = "ops";

export default Module(OPS_MODULE, {
  service: OpsModuleService,
});
