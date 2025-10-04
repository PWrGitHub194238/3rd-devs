import * as fs from "fs";
import * as path from "path";
import { OpenAIService } from "./OpenAIService";
import { OpenAIServiceWrapper } from "./OpenAIServiceWrapper";
import { CentralaService } from "./CentralaService";

/**
 * Reads all files from the pliki_z_fabryki directory and categorizes them by extension.
 * Returns an object where keys are extensions and values are arrays of file paths.
 */
export function categorizeFilesByExtension(
  dir: string
): Record<string, string[]> {
  const files = fs.readdirSync(dir);
  const categorized: Record<string, string[]> = {};

  files.forEach((file) => {
    const ext = path.extname(file).toLowerCase();
    if (!categorized[ext]) {
      categorized[ext] = [];
    }
    categorized[ext].push(path.join(dir, file));
  });

  return categorized;
}

// Methods to convert files to text
export async function convertMp3ToText(
  filePath: string,
  openaiService: OpenAIService
): Promise<string> {
  const wrapper = new OpenAIServiceWrapper(openaiService);
  const buffer = fs.readFileSync(filePath);
  const text = await openaiService.transcribe(buffer, 'en');
  return await wrapper.completionContent([
      { role: "system", content: 'Translate this message fro englsh to polish' },
      { role: "user", content: text },
    ])
}

export async function convertPngToText(
  filePath: string,
  openaiService: OpenAIService
): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const prompt =
    "Convert this image to text description. Image is a report of some sort. Keep the original language";
  const wrapper = new OpenAIServiceWrapper(openaiService);
  return await wrapper.analyzeImage(buffer, prompt);
}

export async function convertTxtToText(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, "utf-8");
}

// Main logic
const fabrykaDir = path.join(__dirname, "pliki_z_fabryki");
const categorizedFiles = categorizeFilesByExtension(fabrykaDir);
const openaiService = new OpenAIService();
const parsedDir = path.join(__dirname, "pliki_z_fabryki_parsed");
if (!fs.existsSync(parsedDir)) {
  fs.mkdirSync(parsedDir);
}

(async () => {
  for (const [ext, files] of Object.entries(categorizedFiles)) {
    for (const filePath of files) {
      const baseName = path.basename(filePath, ext);
      const outPath = path.join(parsedDir, `${baseName}${ext}.txt`);
      if (fs.existsSync(outPath)) {
        console.log(`Skipping ${filePath}, parsed file already exists.`);
        continue;
      }

      let text = "";
      if (ext === ".mp3") {
        text = await convertMp3ToText(filePath, openaiService);
      } else if (ext === ".png") {
        text = await convertPngToText(filePath, openaiService);
      } else if (ext === ".txt") {
        text = await convertTxtToText(filePath);
      } else {
        continue; // skip unsupported extensions
      }
      console.log(`Text for ${filePath}:`, text);

      // Write the result to pliki_z_fabryki_parsed with .txt extension
      fs.writeFileSync(outPath, text, "utf-8");
    }
  }

  // After processing all files, categorize each parsed file
  const parsedFiles = fs
    .readdirSync(parsedDir)
    .filter((f) => f.endsWith(".txt"));
  const wrapper = new OpenAIServiceWrapper(openaiService);

  const fileCategories: Record<string, string> = {};

  for (const file of parsedFiles) {
    const filePath = path.join(parsedDir, file);
    const text = fs.readFileSync(filePath, "utf-8");

    const systemMessage =
      "You are a helpful assistant. Categorize the following text as 'humans' (if about people), 'issues' (if about problems/fixes in the factory), or 'other' (if neither). Reply ONLY with the category name.";
    const userMessage = text;

    const category = await wrapper.completionContent([
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ]);

    fileCategories[file] = category;
    console.log(`File: ${file} => Category: ${category}`);
  }

  console.log("\n=== File Categories Record ===");
  console.table(fileCategories);

  // Further analysis based on category
  const assessedFiles: Record<string, string[]> = {
    humans: [],
    issues: [],
  };

  for (const [file, category] of Object.entries(fileCategories)) {
    const filePath = path.join(parsedDir, file);
    const text = fs.readFileSync(filePath, "utf-8");

    if (category.toLocaleLowerCase() === "humans") {
      const systemMessage =
        "You are a report analyser. Only consider notes that contain information about captured people or traces of their presence. Reply ONLY with 'Y' if note mett criteria or 'N' otherwise. Report files are written in Polish.";
      const userMessage = text;
      const answer = await wrapper.completionContent([
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ]);
      console.log(`File: ${file} [humans] => Captured or traces: ${answer}`);
      if (answer.trim() === "Y") {
        assessedFiles.humans!.push(file);
      }
    } else if (category.toLocaleLowerCase() === "issues") {
      const systemMessage =
        "You are a report analyser. Determinate if the following note is mentioning anything about some hardware issue inside the factory? Reply ONLY with 'Y' for yes or 'N' for no. Report files are written in Polish.";
      const userMessage = text;
      const answer = await wrapper.completionContent([
        { role: "system", content: systemMessage },
        { role: "user", content: userMessage },
      ]);
      console.log(`File: ${file} [issues] => Hardware issue: ${answer}`);
      if (answer.trim() === "Y") {
        assessedFiles.issues!.push(file);
      }
    }
  }

  console.log("\n=== Assessed Files with 'Y' Reply ===");
  console.table(assessedFiles);

  // Prepare answer in required format
  const stripTxtSuffix = (filename: string) => filename.replace(/\.txt$/, "");

  const reportAnswer = {
    people: assessedFiles.humans!.map(stripTxtSuffix),
    hardware: assessedFiles.issues!.map(stripTxtSuffix),
  };

  const json = JSON.stringify(reportAnswer);

  console.log(json);
  // const answer = {
  //   "humans": ["2024-11-12_report-00-sektor_C4.txt", "2024-11-12_report-10-sektor-C1.mp3"],
  //   "issues": ["2024-11-12_report-13.png", "2024-11-12_report-15.png", "2024-11-12_report-16.png", "2024-11-12_report-17.png"]
  // }
  // Send the answer to CentralaService
  const response = await CentralaService.send(
    "kategorie",
    reportAnswer
  );
  console.log("Report sent to CentralaService:", response);
})();