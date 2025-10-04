import type { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { OpenAIService } from "./OpenAIService";
import { OpenAIServiceWithCacheWrapper } from "./OpenAIServiceWithCacheWrapper";
import { TextSplitter } from "./TextService";
import { TextEmbedding3SmallConfigs, VectorService } from "./VectorService";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import { LangfuseService, LangfuseTraceClient } from "./LangfuseService";

const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);

const COLLECTION_NAME = "aidevs";
let sessionId: string;

const openai = new OpenAIService();
const openAIServiceWithCacheWrapper = new OpenAIServiceWithCacheWrapper();
const langfuseService = new LangfuseService();
const vectorService = new VectorService();
const textSplitter = new TextSplitter();

const resourceDir = path.join(__dirname, "do-not-share");
const cacheDir = path.join(__dirname, "cache");



async function createEmbedding(text: string): Promise<number[]> {
  const doc = await openai.createEmbedding(text);
  return doc;
}

interface DocumentMetadata {
  fileName: string;
  reportDate: string;
  keywords: string[];
  summary: string;
}

interface ProcessedDocument {
  data: string;
  metadata: DocumentMetadata;
}

async function loadAndProcessFiles(): Promise<ProcessedDocument[]> {
  try {
    const files = await readdir(resourceDir);
    const processedDocs: ProcessedDocument[] = [];

    for (const file of files) {
      const filePath = path.join(resourceDir, file);
      const content = await readFile(filePath, "utf8");

      // Extract date from filename (assuming format includes YYYY-MM-DD)
      const dateMatch = file.match(/(\d{4})_(\d{2})_(\d{2})/);
      const reportDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : "unknown";

      // Generate summary using OpenAI
      const summaryPrompt: ChatCompletionMessageParam[] = [
        {
          role: "user",
          content: `Please provide a brief summary of the following document:\n\n${content}`,
        },
      ];

      const trace = await langfuseService.createTrace(sessionId, file, summaryPrompt);
      const summary = await openAIServiceWithCacheWrapper.completionContent(
        path.join(cacheDir, `${file}-summary.txt`),
        summaryPrompt,
        () => ({
          sessionId,
          traceClient: trace,
          spanName: `generate_summary_${file}`,
        }),
        false
      );

      // Extract keywords using OpenAI
      const keywordsPrompt: ChatCompletionMessageParam[] = [
        {
          role: "user",
          content: `Please extract 5-7 key keywords from the following document as a comma-separated list:\n\n${content}`,
        },
      ];
      const keywordsResponse =
        await openAIServiceWithCacheWrapper.completionContent(
          path.join(cacheDir, `${file}-keywords.txt`),
          keywordsPrompt,
          () => ({
            sessionId,
            traceClient: trace,
            spanName: `extract_keywords_${file}`
          }),
          false
        );

      const keywords = keywordsResponse.split(",").map((k) => k.trim());

      processedDocs.push({
        data: content,
        metadata: {
          fileName: file,
          reportDate: reportDate!,
          keywords,
          summary,
        },
      });
    }

    return processedDocs;
  } catch (error) {
    console.error("Error loading and processing files:", error);
    return [];
  }
}

async function initializeData() {
  const processedDocuments = await loadAndProcessFiles();

  const points = await Promise.all(
    processedDocuments.map(async (doc) => {
      const textDoc = await textSplitter.document(doc.data, "gpt-4o", {
        metadata: doc.metadata,
      });
      return textDoc;
    })
  );

  await vectorService.initializeCollectionWithData(
    COLLECTION_NAME,
    createEmbedding,
    TextEmbedding3SmallConfigs['Cosine']!,
    points
  );
}

/*
GET collections/aidevs
POST collections/aidevs/points/scroll
{
  "limit": 40,
  "filter": {
  }
}
PUT /collections/aidevs/index
{
    "field_name": "metadata.keywords",
    "field_schema": "keyword"
}
// List points in a collection, using filter
POST collections/aidevs/points/scroll
{
  "limit": 10,
  "filter": {
    "must": [
      {
        "key": "metadata.keywords",
        "match": {
          "any": ["kradzież"]
        }
      }
    ]
  }
}

*/
async function main() {
  console.log("starting")
  const session = await langfuseService.createSession("s03e02");
  sessionId = session.sessionId;
  await initializeData();

  const query =
    "W raporcie, z którego dnia znajduje się wzmianka o kradzieży prototypu broni?";

  const searchResults = await vectorService.performSearchWithFilter(
    COLLECTION_NAME,
    query,
    createEmbedding,
    {
      must: [{
        key: "metadata.keywords",
        match: {
          any: ["kradzież"]
        }
      }]
    },
    1
  );

  console.table(searchResults);
}

await main().catch(console.error);
