import OpenAI, { toFile } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import * as fs from "fs";
import * as path from "path";

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI();
  }

  async completion(
    messages: ChatCompletionMessageParam[],
    model: string = "gpt-4o-mini",
    stream: boolean = false
  ): Promise<
    | OpenAI.Chat.Completions.ChatCompletion
    | AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
  > {
    try {
      const chatCompletion = await this.openai.chat.completions.create({
        messages,
        model,
        stream,
      });

      if (stream) {
        return chatCompletion as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
      } else {
        return chatCompletion as OpenAI.Chat.Completions.ChatCompletion;
      }
    } catch (error) {
      console.error("Error in OpenAI completion:", error);
      throw error;
    }
  }

  async transcribe(audioBuffer: Buffer, language: string = "pl"): Promise<string> {
    console.log("Transcribing audio...");
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: await toFile(audioBuffer, "speech.mp3"),
        language,
        model: "whisper-1",
      });
      return transcription.text;
    } catch (err) {
      console.error("Error during transcription:", err);
      throw err;
    }
  }

  /**
   * Sends an image to the OpenAI vision model and returns the result.
   * @param imageBuffer Buffer containing image data
   * @param prompt Prompt for the model
   * @param model Model name (default: "gpt-4o-mini")
   */
  async analyzeImage(
    imageBuffer: Buffer,
    prompt: string,
    model: string = "gpt-4o-mini"
  ): Promise<any> {
    try {
      const base64Image = imageBuffer.toString("base64");
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                }
              },
            ],
          },
        ],
      });
      return response;
    } catch (error) {
      console.error("Error analyzing image:", error);
      throw error;
    }
  }

  /**
   * Generates an image based on the given description using OpenAI's image generation model.
   * Returns a PNG image with dimensions 1024x1024.
   * @param description Description for the image prompt
   * @returns URL to the generated image or empty string if not available
   */
  async generateImageFromDescription(description: string): Promise<string> {
    try {
      const response = await this.openai.images.generate({
        prompt: description,
        n: 1,
        size: "1024x1024",
        output_format: "png", // Ensure the output is in PNG format
        quality: "high", // Use high quality for better results
        model: "dall-e-3", // Specify the DALL-E 3 model
        response_format: "url", // Model will return a URL to the image
        style: "natural",
      });

      if (
        response &&
        response.data &&
        response.data[0] &&
        response.data[0].url
      ) {
        return response.data[0].url;
      } else {
        throw new Error("No image URL returned from OpenAI.");
      }
    } catch (error) {
      console.error("Error generating image from description:", error);
      throw error;
    }
  }
}
