import OpenAI from "openai";
import { OpenAIService } from "./OpenAIService";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import * as fs from "fs";
import { LangfuseService } from "./LangfuseService";
import { LangfuseTraceClient } from "langfuse";

export type LangfuseCompletionParams = () => {
  sessionId: string;
  traceClient: LangfuseTraceClient;
  spanName: string;
};

export class OpenAIServiceWrapper {
  private openaiService: OpenAIService;
  private langfuseService: LangfuseService;

  constructor() {
    this.openaiService = new OpenAIService();
    this.langfuseService = new LangfuseService();
  }

  /**
   * Generates an image based on the given description and extracts the URL from the response.
   * @param description Description for the image prompt
   * @param options Optional parameters for image generation
   * @returns URL to the generated image
   */
  async generateImageFromDescription(
    description: string,
    options: Partial<OpenAI.Images.ImageGenerateParams> = {}
  ): Promise<string> {
    try {
      const response = await this.openaiService.generateImageFromDescription({
        prompt: description,
        n: options.n || 1,
        size: options.size || "1024x1024",
        quality: options.quality || "hd", // Use high quality for better results
        model: options.model || "dall-e-3", // Specify the DALL-E 3 model
        response_format: options.response_format || "url", // Model will return a URL to the image
        style: options.style || "natural",
      });
      return this.extractImageUrl(response);
    } catch (error) {
      console.error(
        "Error in wrapper generating image from description:",
        error
      );
      throw error;
    }
  }

  /**
   * Extracts the URL from the OpenAI image generation response
   * @param response The response from OpenAI's image generation API
   * @returns The URL of the generated image
   * @throws Error if no URL is found in the response
   */
  private extractImageUrl(response: OpenAI.Images.ImagesResponse): string {
    if (response && response.data && response.data[0] && response.data[0].url) {
      return response.data[0].url;
    } else {
      throw new Error("No image URL returned from OpenAI.");
    }
  }

  async completionContent(
    messages: ChatCompletionMessageParam[],
    langfuseClientParamFunc?: LangfuseCompletionParams,
    model: string = "gpt-4o-mini",
    responseFormat: "text" | "json_object" = "text"
  ): Promise<string> {
    const span = langfuseClientParamFunc
      ? await this.langfuseService.createCompletionSpan(
          langfuseClientParamFunc().traceClient,
          langfuseClientParamFunc().spanName,
          messages
        )
      : null;

    const responseFunc = async () =>
      await this.openaiService.completion(messages, model, responseFormat);

    let response: OpenAI.Chat.Completions.ChatCompletion;

    if (span) {
      response = await this.langfuseService.finalizeCompletionSpan(
        span,
        messages,
        responseFunc
      );
    } else {
      response = await responseFunc();
    }

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
    try {
      const base64Image = imageBuffer.toString("base64");
      const response = await this.openaiService.analyzeImage(
        prompt,
        model,
        base64Image
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
    } catch (error) {
      console.error("Error analyzing image:", error);
      throw error;
    }
  }

  async transcribeAudio(filePath: string): Promise<string> {
    try {
      const buffer = fs.readFileSync(filePath);
      const transcription = await this.openaiService.transcribe(buffer);
      return transcription;
    } catch (error) {
      console.error("Error transcribing audio:", error);
      throw error;
    }
  }

  /**
   * Analizuje obraz na podstawie adresu URL z użyciem modelu OpenAI Vision.
   * @param imageUrl URL do obrazka
   * @param prompt Prompt dla modelu
   * @param model Model OpenAI (domyślnie "gpt-4-vision-preview")
   * @returns string z odpowiedzią modelu
   */
  async analyzeImageByUrl(
    imageUrl: string,
    prompt: string,
    model: string = "gpt-4-vision-preview"
  ): Promise<string> {
    try {
      const response = await this.openaiService.analyzeImageByUrl(
        prompt,
        model,
        imageUrl
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
    } catch (error) {
      console.error("Error analyzing image by URL:", error);
      throw error;
    }
  }
}
