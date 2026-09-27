import { Module } from "@medusajs/framework/utils";
import RedirectModuleService from "./service";

export const REDIRECT_MODULE = "redirect";

export default Module(REDIRECT_MODULE, {
  service: RedirectModuleService,
});
