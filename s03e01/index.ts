import fs from "fs";
import path from "path";
import { OpenAIServiceWithCacheWrapper } from "./OpenAIServiceWithCacheWrapper";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const FACTS_DIR = path.join(__dirname, "pliki_z_fabryki/facts");
const REPORTS_DIR = path.join(__dirname, "pliki_z_fabryki");
const CACHE_DIR = path.join(__dirname, "cache/keywords");

async function main() {
  console.log("Starting keyword extraction...");

  // Create OpenAI service with cache
  const openaiService = new OpenAIServiceWithCacheWrapper();

  // Process fact files
  console.log("\n--- Processing fact files ---");
  const factKeywords = await processFactFiles(openaiService, false);

  // Process report files
  console.log("\n--- Processing report files ---");
  const reportKeywords = await processReportFiles(openaiService, false);

  // Log all results
  console.log("\n--- RESULTS: Fact Files Keywords ---");
  for (const [filename, keywords] of Object.entries(factKeywords)) {
    console.log(`${filename} - ${keywords}`);
  }

  console.log("\n--- RESULTS: Report Files Keywords ---");
  for (const [filename, keywords] of Object.entries(reportKeywords)) {
    console.log(`${filename} - ${keywords}`);
  }

  // Analyze correlations between reports and facts
  console.log("\n--- Analyzing Correlations Between Reports and Facts ---");
  const correlations = await analyzeCorrelations(
    openaiService,
    factKeywords,
    reportKeywords,
    false
  );
  console.log(correlations);

  // Generate final consolidated report
  console.log("\n--- Generating Final Consolidated Report ---");
  const finalReport = await generateFinalReport(
    openaiService,
    correlations,
    reportKeywords,
    factKeywords,
    false
  );
  console.log(finalReport);

  let response: any = {};

  finalReport.forEach(x => {
    response[x.reportName] = x.keywords.join(',')
  });

  console.log(response);
  console.log("\nKeyword extraction completed!");
}

async function processFactFiles(
  openaiService: OpenAIServiceWithCacheWrapper,
  override: boolean,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  // Ensure the directory exists
  if (!fs.existsSync(FACTS_DIR)) {
    console.error(`Directory ${FACTS_DIR} does not exist!`);
    return results;
  }

  // Read all files from the facts directory
  const files = fs.readdirSync(FACTS_DIR);

  for (const file of files) {
    const filePath = path.join(FACTS_DIR, file);
    if (fs.statSync(filePath).isFile()) {
      console.log(`Processing fact file: ${file}`);

      try {
        // Read file content
        const content = fs.readFileSync(filePath, "utf8");

        // Generate cache path
        const cachePath = path.join(CACHE_DIR, "facts", `${file}.keywords.txt`);

        // Extract keywords
        const keywords = await extractKeywords(
          openaiService,
          file,
          content,
          cachePath,
          override,
        );
        results[file] = keywords;
      } catch (error) {
        console.error(`Error processing ${file}:`, error);
        results[file] = "Error extracting keywords";
      }
    }
  }

  return results;
}

async function processReportFiles(
  openaiService: OpenAIServiceWithCacheWrapper,
  override: boolean,
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  // Ensure the directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    console.error(`Directory ${REPORTS_DIR} does not exist!`);
    return results;
  }

  // Read all files from the reports directory
  const files = fs.readdirSync(REPORTS_DIR);

  // Process only text files
  for (const fileName of files) {
    const filePath = path.join(REPORTS_DIR, fileName);

    // Only process .txt files
    if (fs.statSync(filePath).isFile() && fileName.endsWith(".txt")) {
      console.log(`Processing report file: ${fileName}`);

      try {
        // Read file content
        const content = fs.readFileSync(filePath, "utf8");

        // Generate cache path
        const cachePath = path.join(
          CACHE_DIR,
          "reports",
          `${fileName}.keywords.txt`
        );

        // Extract keywords
        const keywords = await extractKeywords(
          openaiService,
          fileName,
          content,
          cachePath,
          override
        );
        results[fileName] = keywords;
      } catch (error) {
        console.error(`Error processing ${fileName}:`, error);
        results[fileName] = "Error extracting keywords";
      }
    }
  }

  return results;
}

async function extractKeywords(
  openaiService: OpenAIServiceWithCacheWrapper,
  filename: string,
  content: string,
  cachePath: string,
  override: boolean,
): Promise<string> {
  // Create prompt for keyword extraction
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are an AI assistant that extracts important keywords from text content. " +
        "Extract 5-10 most important keywords or key phrases that best represent the main topics and concepts in the text given by the user. " +
        "Firstly summarise the text in a few sentences and then return a comma-separated list of keywords or short phrases, with no additional text or explanation." +
        "Take a file name and content as input and return keywords." +
        "Returned keywords as well as the summary should be in Polish, same as the original files are." + 
        'Return in a JSON format: { "summary": "summary of the given text", "keywords": "list of comma-separated keywords" }',
    },
    {
      role: "user",
      content: `File name: ${filename}\n\nContent: ${content}`,
    },
  ];

  // Use cached completion if available
  const response = await openaiService.completionContent(
    messages,
    cachePath,
    override,
    "gpt-4o-mini"
  );

  try {
    // Parse the JSON response
    const parsedResponse = JSON.parse(response);

    // Return just the keywords for the log output
    return parsedResponse.keywords || "No keywords found";
  } catch (error) {
    console.warn(`Failed to parse JSON response for ${filename}:`, error);
    // If JSON parsing fails, return the raw response
    return response;
  }
}

type CorrelationResult = { reportFile: string, relatedFacts: string[], rationale: string};
/**
 * Analyzes potential correlations between reports and facts based on their keywords
 */
async function analyzeCorrelations(
  openaiService: OpenAIServiceWithCacheWrapper,
  factKeywords: Record<string, string>,
  reportKeywords: Record<string, string>,
  override: boolean
): Promise<CorrelationResult[]> {
  console.log("Analyzing correlations between reports and facts...");

  // Create a structured representation of all keywords
  const keywordData = {
    facts: Object.entries(factKeywords).map(([filename, keywords]) => ({
      filename,
      keywords,
    })),
    reports: Object.entries(reportKeywords).map(([filename, keywords]) => ({
      filename,
      keywords,
    })),
  };

  // Generate cache path for correlation analysis
  const cachePath = path.join(CACHE_DIR, "correlation_analysis.txt");

  // Create prompt for correlation analysis
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are an analyst tasked with identifying potential correlations between different documents " +
        "based on their extracted keywords. You will be given two sets of documents: 'facts' and 'reports', " +
        "each with their associated keywords. Your task is to identify which reports might be related to which facts " +
        "based on keyword similarity, shared themes, or other semantic connections. " +
        "Instead of a prose analysis, you must return a structured JSON array. " +
        "The JSON format should be an array of objects, where each object represents a report and contains: " +
        "1. 'reportFile': the filename of the report " +
        "2. 'relatedFacts': an array of fact filenames that are potentially related to this report, ordered by likelihood of connection (most likely first) " +
        "3. 'rationale': a brief explanation of why these facts are likely related to the report. Use Polish language. " +
        "\n\nExample: " +
        '{[{"reportFile": "01.txt", "relatedFacts": ["fact1.txt", "fact3.txt"], "rationale": "Both share keywords related to..."}]}',
    },
    {
        role: "user",
        content: `
        Analyze the following sets of document keywords to identify potential correlations between reports and facts.
        <facts>
        ${keywordData.facts
          .map(
            (fact) => `
          <fact>
            <name>${fact.filename}</name>
            <keywords>${fact.keywords}</keywords>
          </fact>
        `
          )
          .join("")}
        </facts>
        <reports>
        ${keywordData.reports
          .map(
            (report) => `
          <report>
            <name>${report.filename}</name>
            <keywords>${report.keywords}</keywords>
          </report>
        `
          )
          .join("")}
        </reports>
        `,
      },
  ];

  // Use cached completion if available
  const response = await openaiService.completionContent(
    messages,
    cachePath,
    override,
    "gpt-4o", // Using a more capable model for this complex analysis
    false,
    'json_object'
  );

  try {
    // Parse the JSON response to ensure it's valid
    const parsedResponse = JSON.parse(response);
    return parsedResponse.results;
  } catch (error) {
    console.warn("Failed to parse correlation analysis as JSON:", error);
    return [];
  }
}

/**
 * Generates a final consolidated report with improved keywords for each report
 * based on the correlations with facts
 */
async function generateFinalReport(
  openaiService: OpenAIServiceWithCacheWrapper,
  correlations: CorrelationResult[],
  reportKeywords: Record<string, string>,
  factKeywords: Record<string, string>,
  override: boolean,
): Promise<{reportName: string, keywords:string[]}[]> {
  console.log("Generating final consolidated report...");

  // Create an array to store the final report entries
  const finalReportEntries = [];

  // Process each report in the correlations
  for (const correlation of correlations) {
    const reportFile = correlation.reportFile;
    const relatedFacts = correlation.relatedFacts;
    const reportKeywordsList = reportKeywords[reportFile] || "";

    // Get the content of the report file
    let reportContent = "";
    try {
      const reportPath = path.join(REPORTS_DIR, reportFile);
      reportContent = fs.existsSync(reportPath)
        ? fs.readFileSync(reportPath, "utf8")
        : "";
    } catch (error) {
      console.error(`Error reading report file ${reportFile}:`, error);
    }

    // Get the content and keywords of related facts
    const relatedFactsData = [];
    for (const factFile of relatedFacts) {
      try {
        const factPath = path.join(FACTS_DIR, factFile);
        const factContent = fs.existsSync(factPath)
          ? fs.readFileSync(factPath, "utf8")
          : "";
        const factKeywordsList = factKeywords[factFile] || "";

        relatedFactsData.push({
          filename: factFile,
          content: factContent,
          keywords: factKeywordsList,
        });
      } catch (error) {
        console.error(`Error reading fact file ${factFile}:`, error);
      }
    }

    // Generate cache path for the final report entry
    const cachePath = path.join(
      CACHE_DIR,
      "final_report",
      `${reportFile}.json`
    );

    // Create prompt for generating the final report entry
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are an expert analyst consolidating information from related documents. " +
          "You will receive a report, its keywords, and a set of related fact documents with their keywords. " +
          "Your task is to analyze this information and produce an improved, consolidated set of keywords that can be assigned to that report." +
          "Reason about the connections. For example if the keywords are 'capture', add the context to it based on the connections - for example 'capture of a teacher'." + 
          "While reasoning, follow the given rules:" +
          " - Be sure to use the information from the .txt files in the facts folder." +
          " - If a person appears in the report and the 'facts' contain information about that person or other relevant details, they must be included in the keywords for that report." +
          " - In 'facts' there may be minor differences in the spelling of surnames (e.g., 'Kowaski' and 'Kowalki') - try to deal with that." + 
          " - Use Polish language, nominative for keywords. " +
          " - Try to make the keywords as specific as possible to the given report and related facts." +
          " - Try to group keywords together. For example if the report mentions \"wild fauna\", \"game animals\" or \"wildlife\", return a more general keyword, such as \"animals\". " +
          " - Surnames and first names: They should be included if they are relevant. " +
          " - use <to-checks> to help you focus on given facts if they are relevant to the report you are processing - if it is then make sure the report can be correlate to it by its keywords." +
          "Return the response in the following format: { \"reasoning\": \"reason about the keywords toselect and their connections\", \"keywords\": \"a list of keywords separated by a comma\"}."
      },
      {
        role: "user",
        content: `
        <report-name>${reportFile}</report-name>
        <report-content>${reportContent}</report-content>
        <report-keywords>${reportKeywordsList}</report-keywords>
        <related-facts>
        ${relatedFactsData
          .map(
            (fact) => `
          <fact>
            <name>${fact.filename}</name>
            <content>${fact.content}</content>
            <keywords>${fact.keywords}</keywords>
          </fact>
        `
          )
          .join("")}
        </related-facts>
        <to-checks>
          <to-check>
            in which sector Barbara Zawadzka's fingerprints were found
          <to-check>
          <to-check>
            capture of a teacher
          <to-check>
          <to-check>
            JavaScript programmer
          <to-check>
        <to-checks>
        `,
      },
    ];

    // Use cached completion if available
    const response = await openaiService.completionContent(
      messages,
      cachePath,
      override,
      "gpt-4o" // Using a more capable model for this complex analysis
    );

    try {
      // Parse the JSON response
      const parsedResponse = JSON.parse(response);

      console.log(parsedResponse);
      finalReportEntries.push({
        reportFile,
        improvedKeywords: parsedResponse.keywords,
      });
    } catch (error) {
      console.warn(`Failed to parse JSON response for a report: ${reportFile}:`, error);
    }
  }

  return finalReportEntries.map(x => ({
    reportName: x.reportFile,
    keywords: x.improvedKeywords.split(','),
  }))
}

// Execute the main function
main().catch((error) => {
  console.error("An error occurred:", error);
  process.exit(1);
});
