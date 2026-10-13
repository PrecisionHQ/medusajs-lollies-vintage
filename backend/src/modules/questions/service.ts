import { MedusaService } from "@medusajs/framework/utils";
import { Question } from "./models";

class QuestionModuleService extends MedusaService({
  Question,
}) {}

export default QuestionModuleService;
