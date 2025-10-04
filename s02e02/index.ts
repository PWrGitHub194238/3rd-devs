import * as fs from "fs";
import * as path from "path";
import { OpenAIService } from "./OpenAIService";
import { OpenAIServiceWrapper } from "./OpenAIServiceWrapper";

/**
 * Analyzes a single map fragment image using the vision model.
 * @param buffer Buffer containing image data
 * @param prompt Prompt for the model
 * @param openaiService Instance of OpenAIService
 */
export async function analyzeMapFragment(
  buffer: Buffer,
  openaiService: OpenAIService
): Promise<any> {
  
  const fullPrompt =
    `Analyze this map fragment of a Polish unknown city. Extract all street names, icons (bus stops, museums, buildings), their titles, and any road numbers. For each object found, return a short description of its location based on other objects present in the image.`;

  try {
    const openaiWrapper = new OpenAIServiceWrapper(openaiService);
    const result = await openaiWrapper.analyzeImage(buffer, fullPrompt);
    return result;
  } catch (error) {
    console.error(`Error analyzing map fragment:`, error);
    return null;
  }
}

/**
 * Uses the OpenAI model to analyze the map fragment description and try to match it to a real Polish city.
 * @param description The description generated for a map fragment
 * @param openaiService Instance of OpenAIService
 * @returns City's name(s) or empty string if no match
 */
export async function matchCityFromDescription(
  description: string,
  openaiService: OpenAIService
): Promise<string> {
  const systemMessage = `
You are an expert in Polish geography and infrastructure. Your task is to analyze map fragment descriptions and determine if the described infrastructure matches any real Polish city.
The city you are after is having granaries and fortresses in it. Before giving the answer, please verify if each of the names given in the description exists in that city.
Reply ONLY with the city's name. If there are multiple possible matches, list them separated by commas. If no match is found, reply with an empty response.
  `;
  const userMessage = description;

  try {
    const openaiWrapper = new OpenAIServiceWrapper(openaiService);
    const content = await openaiWrapper.completionContent([
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ]);
    if (typeof content === "string") {
      return content.trim();
    }
    return "";
  } catch (error) {
    console.error("Error matching city from description:", error);
    return "";
  }
}

const mapsDir = path.join(__dirname, "maps");
const openaiService = new OpenAIService();

const files = fs.readdirSync(mapsDir);
const imageFiles = files.filter(
  (f) =>
    f.endsWith(".png") ||
    f.endsWith(".jpg") ||
    f.endsWith(".jpeg") ||
    f.endsWith(".webp")
);

(async () => {
  const results: any[] = [];
  for (const file of imageFiles) {
    
    const filePathParsed = path.join(mapsDir, `${file}.txt`);

    let analysis = "";
    if (fs.existsSync(filePathParsed))
    {
      analysis = fs.readFileSync(filePathParsed, 'utf-8');
    } else {
      const filePath = path.join(mapsDir, file);
      const buffer = fs.readFileSync(filePath);

      analysis = await analyzeMapFragment(buffer, openaiService);
      fs.writeFileSync(filePathParsed, analysis, 'utf-8');
    }

    let cityMatch = "";
    if (analysis && typeof analysis === "string") {
      cityMatch = await matchCityFromDescription(analysis, openaiService);
      console.log(`Possible city match for ${file}:`, cityMatch);
    }

    results.push({
      name: file,
      analysis,
      cityMatch,
    });
    console.log(`Analyzed map fragment: ${file}`);
  }
  console.log("Map fragment analyses:", results);

  // List all potential matches in a human readable form
  console.log("\n=== Potential City Matches ===");
  results.forEach((result) => {
    if (result.cityMatch) {
      console.log(
        `Map fragment "${result.name}": Possible city match(es): ${result.cityMatch}`
      );
    } else {
      console.log(`Map fragment "${result.name}": No city match found.`);
    }
  });

  // Transform results: enumerate each city with the number of potential matches grouped by city name
  console.log("\n=== City Match Counts Across All Fragments ===");
  const cityStats: Record<string, { count: number; files: string[] }> = {};

  results.forEach((result) => {
    if (result.cityMatch) {
      const cities = result.cityMatch
        .split(",")
        .map((c: string) => c.trim())
        .filter(Boolean);
      cities.forEach((city: string) => {
        if (!cityStats[city]) {
          cityStats[city] = { count: 0, files: [] };
        }
        cityStats[city].count += 1;
        cityStats[city].files.push(result.name);
      });
    }
  });

  Object.entries(cityStats).forEach(([city, stat]) => {
    console.log(
      `City "${city}": ${stat.count} potential match(es) in fragments: ${stat.files.join(", ")}`
    );
  });
})();
