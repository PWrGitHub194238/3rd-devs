import OpenAI, { toFile } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI();
  }

  async completion(
    messages: ChatCompletionMessageParam[],
    model: string,
    stream: boolean,
    responseFormat: 'text' | 'json_object'
  ): Promise<
    | OpenAI.Chat.Completions.ChatCompletion
    | AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>
  > {
    try {
      const chatCompletion = await this.openai.chat.completions.create({
        messages,
        model,
        stream,
        response_format: {
          type: responseFormat
        }
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

  async transcribe(audioBuffer: Buffer): Promise<string> {
    console.log("Transcribing audio...");
    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: await toFile(audioBuffer, "speech.mp3"),
        language: "pl",
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
   * @param model Model name (default: "gpt-4-vision-preview")
   */
  async analyzeImage(
    prompt: string,
    model: string,
    base64Image: string
  ): Promise<any> {
    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "file",
                file: {
                  filename: "image.png",
                  file_data: base64Image, // Pass base64 encoded image data here
                },
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
   * Returns the raw response from the OpenAI API.
   * @param description Description for the image prompt
   * @returns Raw OpenAI image generation response
   */
  async generateImageFromDescription(
    options: OpenAI.Images.ImageGenerateParams
  ): Promise<OpenAI.Images.ImagesResponse> {
    try {
      const response = await this.openai.images.generate({ ...options });

      return response;
    } catch (error) {
      console.error("Error generating image from description:", error);
      throw error;
    }
  }
}
