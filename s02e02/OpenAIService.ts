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
    model: string = "gpt-4",
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
}

/**
 * Loads images from the specified directory and analyzes each using the vision model.
 * @param mapsDir Directory containing map fragment images
 * @param prompt Prompt for the model
 */
export async function analyzeMapFragments(
  mapsDir: string,
  prompt: string,
  openaiService: OpenAIService
): Promise<any[]> {
  const files = fs.readdirSync(mapsDir);
  const imageFiles = files.filter(
    (f) =>
      f.endsWith(".png") ||
      f.endsWith(".jpg") ||
      f.endsWith(".jpeg") ||
      f.endsWith(".webp")
  );
  const results: any[] = [];

  for (const file of imageFiles) {
    const filePath = path.join(mapsDir, file);
    const buffer = fs.readFileSync(filePath);

    // Custom prompt for each map fragment
    const fullPrompt =
      prompt +
      "\n" +
      "Analyze this map fragment. Extract all street names, icons (bus stops, museums, buildings), their titles, and any road numbers. For each object found, return a short description of its location based on other objects present in the image.";

    try {
      const result = await openaiService.analyzeImage(buffer, fullPrompt);
      results.push({
        name: file,
        analysis: result,
      });
      console.log(`Analyzed map fragment: ${file}`);
    } catch (error) {
      console.error(`Error analyzing map fragment ${file}:`, error);
    }
  }
  return results;
}
