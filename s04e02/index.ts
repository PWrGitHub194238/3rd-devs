import * as fs from "fs";
import * as path from "path";
import { OpenAIServiceWrapper } from "../s04e01/OpenAIServiceWrapper";
import { CentralaService } from "./CentralaService";

async function prepareJsonl() {
  const correctPath = path.join(__dirname, "lab_data", "correct.txt");
  const incorrectPath = path.join(__dirname, "lab_data", "incorect.txt");
  const outputPath = path.join(__dirname, "fine_tuning.jsonl");

  const systemPrompt = "validate data";

  const correctLines = fs
    .readFileSync(correctPath, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const incorrectLines = fs
    .readFileSync(incorrectPath, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const jsonlLines: string[] = [];

  for (const line of correctLines) {
    jsonlLines.push(
      JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: line },
          { role: "assistant", content: "1" },
        ],
      })
    );
  }

  for (const line of incorrectLines) {
    jsonlLines.push(
      JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: line },
          { role: "assistant", content: "0" },
        ],
      })
    );
  }

  fs.writeFileSync(outputPath, jsonlLines.join("\n"), "utf-8");
  console.log(`Saved ${jsonlLines.length} records to ${outputPath}`);
}

/**
 * Reads lines from lab_data/VERIFY and asks a model to categorise each line as "1" (correct) or "0" (incorrect).
 * @param modelCategorizeFn - async function that takes a string and returns "1" or "0"
 */
export async function verifyDataWithModel(
  modelCategorizeFn: (data: string) => Promise<"1" | "0">
) {
  const verifyPath = path.join(__dirname, "lab_data", "verify.txt");
  const lines = fs
    .readFileSync(verifyPath, "utf-8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const results: { index: string; data: string; category: "1" | "0" }[] = [];

  for (const line of lines) {
    const [index, data] = line.split("=");
    if (!index || !data) continue;
    const category = await modelCategorizeFn(data);
    results.push({ index, data, category });
    console.log(`[${index}] "${data}" => ${category}`);
  }

  return results;
}

/**
 * Uses OpenAIServiceWrapper to categorize a data string as "1" or "0" using a custom model.
 * @param data Input string to categorize
 * @param modelName Name of the fine-tuned model to use
 * @returns Promise<"1" | "0">
 */
export async function categorizeWithOpenAI(
  data: string,
  modelName: string
): Promise<"1" | "0"> {
  const systemPrompt = "validate data";
  const openai = new OpenAIServiceWrapper();
  const result = await openai.completionContent(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: data },
    ],
    undefined,
    modelName,
    "text"
  );
  const answer = result.trim();
  if (answer === "1" || answer === "0") {
    return answer;
  }
  // fallback: treat anything else as incorrect
  return "0";
}

/**
 * Returns an array of indexes for which the answer was "1" (correct).
 * @param results Array of objects: { index: string; data: string; category: "1" | "0" }
 * @returns string[] array of indexes with category "1"
 */
export function getCorrectIndexes(
  results: { index: string; data: string; category: "1" | "0" }[]
): string[] {
  return results.filter((r) => r.category === "1").map((r) => r.index);
}

/**
 * Wysyła odpowiedź do API dla zadania "research" z podaną listą indeksów.
 * @param indexes Tablica indeksów do wysłania jako odpowiedź
 * @returns Odpowiedź z API
 */
export async function sendResearchAnswer(indexes: string[]): Promise<any> {
  return await CentralaService.sendAnswer("research", indexes);
}

/**
 * Kompletny pipeline:
 * 1. Weryfikuje dane z verify.txt za pomocą modelu (np. fine-tuned OpenAI)
 * 2. Zwraca indeksy poprawnych odpowiedzi
 * 3. Wysyła odpowiedź do centrali
 * @param modelName nazwa modelu fine-tuned
 */
export async function solveResearchTask(modelName: string) {
  console.log(
    `[solveResearchTask] Start weryfikacji danych z modelem: ${modelName}`
  );
  // 1. Weryfikacja danych
  const results = await verifyDataWithModel((data) =>
    categorizeWithOpenAI(data, modelName)
  );
  // 2. Wyciągnięcie indeksów poprawnych odpowiedzi
  const correctIndexes = getCorrectIndexes(results);
  console.log(
    `[solveResearchTask] Indeksy poprawnych odpowiedzi: ${JSON.stringify(correctIndexes)}`
  );
  // 3. Wysłanie odpowiedzi do centrali
  const response = await sendResearchAnswer(correctIndexes);
  console.log(`[solveResearchTask] Odpowiedź z centrali:`, response);
  return {
    correctIndexes,
    response,
  };
}

// prepareJsonl();

await solveResearchTask("ft:gpt-4.1-mini-2025-04-14:tomasz-saletnik:ai-devs:C3qZYsDe");
