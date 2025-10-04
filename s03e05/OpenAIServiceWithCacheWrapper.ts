import OpenAI from "openai";
import { OpenAIServiceWrapper, type LangfuseCompletionParams } from "./OpenAIServiceWrapper";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import * as fs from "fs";
import * as path from "path";
import { LangfuseTraceClient } from "langfuse";

export class OpenAIServiceWithCacheWrapper {
  private openaiWrapper: OpenAIServiceWrapper;

  constructor() {
    this.openaiWrapper = new OpenAIServiceWrapper();
  }

  /**
   * Generates an image based on the given description with caching capability.
   * @param description Description for the image prompt
   * @param cachePath Path to store the generated image URL
   * @param override Whether to override existing cache (default: false)
   * @param options Optional parameters for image generation
   * @returns URL to the generated image
   */
  async generateImageFromDescription(
    description: string,
    cachePath: string,
    override: boolean = false,
    options: Partial<OpenAI.Images.ImageGenerateParams> = {}
  ): Promise<string> {
    // Check if cache exists and we're not overriding
    if (!override && fs.existsSync(cachePath)) {
      try {
        console.log(`Using cached image URL from ${cachePath}`);
        return fs.readFileSync(cachePath, "utf8");
      } catch (error) {
        console.warn(
          `Error reading cache at ${cachePath}, generating new image:`,
          error
        );
      }
    }

    // Ensure directory exists
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });

    // Generate new image
    const imageUrl = await this.openaiWrapper.generateImageFromDescription(
      description,
      options
    );

    // Save to cache
    fs.writeFileSync(cachePath, imageUrl);
    console.log(`Image URL cached to ${cachePath}`);

    return imageUrl;
  }

  /**
   * Gets completion content with caching capability.
   * @param messages Messages for the completion
   * @param cachePath Path to store the completion content
   * @param override Whether to override existing cache (default: false)
   * @param model Model to use (default: "gpt-4o-mini")
   * @param stream Whether to stream the response (default: false)
   * @returns Completion content
   */
  async completionContent(
    cachePath: string,
    messages: ChatCompletionMessageParam[],
    langfuseClientParamFunc?: LangfuseCompletionParams,
    override: boolean = false,
    model: string = "gpt-4o-mini",
    responseFormat: "text" | "json_object" = "text"
  ): Promise<string> {
    // Check if cache exists and we're not overriding
    if (!override && fs.existsSync(cachePath)) {
      try {
        console.log(`Using cached completion from ${cachePath}`);
        return fs.readFileSync(cachePath, "utf8");
      } catch (error) {
        console.warn(
          `Error reading cache at ${cachePath}, generating new completion:`,
          error
        );
      }
    }

    // Ensure directory exists
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });

    // Generate new completion
    const content = await this.openaiWrapper.completionContent(
      messages,
      langfuseClientParamFunc,
      model,
      responseFormat
    );

    // Save to cache
    fs.writeFileSync(cachePath, content);
    console.log(`Completion cached to ${cachePath}`);

    return content;
  }

  /**
   * Analyzes an image with caching capability.
   * @param imageBuffer Buffer containing the image
   * @param prompt Prompt for image analysis
   * @param cachePath Path to store the analysis result
   * @param override Whether to override existing cache (default: false)
   * @param model Model to use (default: "gpt-4o-mini")
   * @returns Image analysis result
   */
  async analyzeImage(
    imageBuffer: Buffer,
    prompt: string,
    cachePath: string,
    override: boolean = false,
    model: string = "gpt-4o-mini"
  ): Promise<string> {
    // Check if cache exists and we're not overriding
    if (!override && fs.existsSync(cachePath)) {
      try {
        console.log(`Using cached image analysis from ${cachePath}`);
        return fs.readFileSync(cachePath, "utf8");
      } catch (error) {
        console.warn(
          `Error reading cache at ${cachePath}, analyzing image again:`,
          error
        );
      }
    }

    // Ensure directory exists
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });

    // Analyze image
    const analysis = await this.openaiWrapper.analyzeImage(
      imageBuffer,
      prompt,
      model
    );

    // Save to cache
    fs.writeFileSync(cachePath, analysis);
    console.log(`Image analysis cached to ${cachePath}`);

    return analysis;
  }

  /**
   * Transcribes audio with caching capability.
   * @param filePath Path to the audio file
   * @param cachePath Path to store the transcription
   * @param override Whether to override existing cache (default: false)
   * @returns Audio transcription
   */
  async transcribeAudio(
    filePath: string,
    cachePath: string,
    override: boolean = false
  ): Promise<string> {
    // Check if cache exists and we're not overriding
    if (!override && fs.existsSync(cachePath)) {
      try {
        console.log(`Using cached transcription from ${cachePath}`);
        return fs.readFileSync(cachePath, "utf8");
      } catch (error) {
        console.warn(
          `Error reading cache at ${cachePath}, transcribing audio again:`,
          error
        );
      }
    }

    // Ensure directory exists
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });

    // Transcribe audio
    const transcription = await this.openaiWrapper.transcribeAudio(filePath);

    // Save to cache
    fs.writeFileSync(cachePath, transcription);
    console.log(`Transcription cached to ${cachePath}`);

    return transcription;
  }
}
