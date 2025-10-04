import { OpenAIService } from "./OpenAIService";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export class OpenAIServiceWrapper {
  private openaiService: OpenAIService;

  constructor(openaiService: OpenAIService) {
    this.openaiService = openaiService;
  }

  async completionContent(
    messages: ChatCompletionMessageParam[],
    model: string = "gpt-4",
    stream: boolean = false
  ): Promise<string> {
    const response = await this.openaiService.completion(
      messages,
      model,
      stream
    );
    if (
      response &&
      "choices" in response &&
      response.choices[0] &&
      response.choices[0].message &&
      typeof response.choices[0].message.content === "string"
    ) {
      return response.choices[0].message.content.trim();
    }
    return "";
  }

  async analyzeImage(
    imageBuffer: Buffer,
    prompt: string,
    model: string = "gpt-4o-mini"
  ): Promise<string> {
    const response = await this.openaiService.analyzeImage(
      imageBuffer,
      prompt,
      model
    )
    if (
      response &&
      "choices" in response &&
      response.choices[0] &&
      response.choices[0].message &&
      typeof response.choices[0].message.content === "string"
    ) {
      return response.choices[0].message.content.trim();
    }
    return "";
  }
}
