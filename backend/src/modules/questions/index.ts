import { Module } from "@medusajs/framework/utils";
import QuestionModuleService from "./service";

export const QUESTION_MODULE = "question";

export default Module(QUESTION_MODULE, {
  service: QuestionModuleService,
});
