import OpenAI, { toFile } from "openai";
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type { CreateEmbeddingResponse } from "openai/resources/index.mjs";

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI();
  }

  async streaCompletion(
    messages: ChatCompletionMessageParam[],
    model: string,
    responseFormat: "text" | "json_object"
  ): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
    try {
      const chatCompletion = await this.openai.chat.completions.create({
        messages,
        model,
        stream: true,
        response_format: {
          type: responseFormat,
        },
      });

      return chatCompletion;
    } catch (error) {
      console.error("Error in OpenAI completion:", error);
      throw error;
    }
  }

  async completion(
    messages: ChatCompletionMessageParam[],
    model: string,
    responseFormat: "text" | "json_object"
  ): Promise<OpenAI.Chat.Completions.ChatCompletion> {
    try {
      const chatCompletion = await this.openai.chat.completions.create({
        messages,
        model,
        stream: false,
        response_format: {
          type: responseFormat,
        },
      });

      return chatCompletion;
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
  ): Promise<ChatCompletion> {
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
   * Sends an image (by URL) to the OpenAI vision model and returns the result.
   * @param prompt Prompt for the model
   * @param model Model name (default: "gpt-4-vision-preview")
   * @param imageUrl URL of the image to analyze
   */
  async analyzeImageByUrl(
    prompt: string,
    model: string,
    imageUrl: string
  ): Promise<ChatCompletion> {
    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
      });
      return response;
    } catch (error) {
      console.error("Error analyzing image by URL:", error);
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

  async createEmbedding(text: string): Promise<number[]> {
    try {
      const response: CreateEmbeddingResponse =
        await this.openai.embeddings.create({
          model: "text-embedding-3-small",
          input: text,
        });
      return response!.data[0]!.embedding;
    } catch (error) {
      console.error("Error creating embedding:", error);
      throw error;
    }
  }
}
