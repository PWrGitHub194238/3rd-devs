import { CentralaService } from "./CentralaService";
import * as fs from "fs";
import * as path from "path";
import { OpenAIService } from "./OpenAIService";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { file } from "bun";

const audioDir = path.join(__dirname, "przesluchania");
const audioTextDir = path.join(__dirname, "przesluchania_text");

function loadAudioFiles(dir: string) {
  const files = fs.readdirSync(dir);
  const audioFiles = files.filter(
    (f) => f.endsWith(".m4a") || f.endsWith(".mp3")
  );
  return audioFiles.map((file) => {
    const filePath = path.join(dir, file);
    const buffer = fs.readFileSync(filePath);
    return { name: file, buffer };
  });
}

type Transcription = { name: string; text: string };

async function transcribeAll(
  onTranscription?: (transcription: Transcription) => Promise<boolean>
) {
  const loadedAudio = loadAudioFiles(audioDir);
  const openai = new OpenAIService();
  const transcriptions: Transcription[] = [];
  for (const audio of loadedAudio) {
    const filePath = path.join(audioTextDir, `${audio.name}.txt`);

    const text = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : await openai.transcribe(audio.buffer);

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, text, 'utf8');
    }
    const result = { name: audio.name, text };
    transcriptions.push(result);
    if (onTranscription) {
      const answerFound = await onTranscription(result);
      if (!answerFound) {
        break;
      }
    }
  }
  return transcriptions;
}

// Callback function for each transcription

let summary = "";
const aggregatedCompletions: {
  name: string;
  completion: any;
  summary: string;
}[] = [];

async function handleTranscription(
  transcription: Transcription
): Promise<boolean> {
  console.log(`Transcribed ${transcription.name}`);
  console.log(`Text: ${transcription.text}`);

  // Prepare prompt for fact extraction and summary update
  const prompt: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are an expert fact extractor. Your job is to analyze provided interrogation transcript about 'profesor Andrzej Maj'. Extract any facts about the professor Based on transcript and previous summary update the summary by any new facts or confirm the already existing ones. The summary should be a concise list of facts and should be improved with each new transcript. The overall goal is to determine the name of the street where the university institute where Professor Andrzej Maj lectures is located, so try to focus on gathering facts around that topic.",
    },
    {
      role: "assistant",
      content: `Current summary about profesor Andrzej Maj: ${summary ?? 'no summary yet'}`,
    },
    {
      role: "user",
      content: `Transcript: ${transcription.text}`,
    },
  ];

  const openai = new OpenAIService();
  try {
    const completion = await openai.completion(prompt, 'gpt-4o-mini');
    // Extract summary from completion.choices[0].message.content
    let newSummary = "";
    if (
      completion &&
      "choices" in completion &&
      completion.choices[0] &&
      completion.choices[0].message &&
      typeof completion.choices[0].message.content === "string"
    ) {
      newSummary = completion.choices[0].message.content;
    } else if (typeof completion === "string") {
      newSummary = completion;
    }
    summary = newSummary;
    aggregatedCompletions.push({
      name: transcription.name,
      completion,
      summary,
    });
    console.log(`Updated summary for ${transcription.name}:`, summary);

    // Second AI call: ask for street name
    const streetPrompt: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are an expert on Polish universities. Based on the summary below, determine the name of the street where the university institute where Professor Andrzej Maj lectures is located. The exact answer might not be provided but the summary might include enought details for you to determinate the university institute based on your knowledge from the Internet, hence the address. Reply with the following message: <reasoning>REASONING</reasoning><answer>ANSWER</answer>. In place of REASONING wrie down your though process of analyzing each fact to determinate the answer for the given question. Remember that the summary might include some addresses - you must validate if the address is indeed the one from the question. If you do not know, reply with 'I don't know' as for the ANSWER. Reply ONLY with the street name or 'I don't know' for the ANSWER.",
      },
      {
        role: "user",
        content: `Summary: ${summary}`,
      },
    ];
    // const streetResult = await openai.completion(streetPrompt, 'gpt-4o-mini');
    // let streetName = "";
    // if (
    //   streetResult &&
    //   "choices" in streetResult &&
    //   streetResult.choices[0] &&
    //   streetResult.choices[0].message &&
    //   typeof streetResult.choices[0].message.content === "string"
    // ) {
    //   streetName = streetResult.choices[0].message.content.trim();
    // } else if (typeof streetResult === "string") {
    //   streetName = (streetResult as string).trim();
    // }
    // console.log(`Street name result for ${transcription.name}:`, streetName);
    // if (streetName && !streetName.toLowerCase().includes("<answer>i don't know</answer>")) {
    //   console.log("Street found! Stopping further processing.");
    //   await CentralaService.sendStreetReport(streetName);
    //   return false; // Stop processing
    // }
  } catch (error) {
    console.error(`Error getting completion for ${transcription.name}:`, error);
  }
  return true; // Continue processing
}

// Example usage:
await transcribeAll(
  async (transcription) => await handleTranscription(transcription)
);

const openai = new OpenAIService();
// Second AI call: ask for street name
const streetPrompt: ChatCompletionMessageParam[] = [
  {
    role: "system",
    content:
      "You are an expert on Polish universities. Based on the summary below, determine the name of the street where the university institute where Professor Andrzej Maj lectures is located. The exact answer might not be provided but the summary might include enought details for you to determinate the university institute based on your knowledge from the Internet, hence the address. Reply with the following message: <reasoning>REASONING</reasoning><answer>ANSWER</answer>. In place of REASONING wrie down your though process of analyzing each fact to determinate the answer for the given question. Remember that the summary might include some addresses - you must validate if the address is indeed the one from the question. If you do not know, reply with 'I don't know' as for the ANSWER. Reply ONLY with the street name or 'I don't know' for the ANSWER.",
  },
  {
    role: "user",
    content: `Summary: ${summary}`,
  },
];
const streetResult = await openai.completion(streetPrompt, 'gpt-4o-mini');
let streetName = "";
if (
  streetResult &&
  "choices" in streetResult &&
  streetResult.choices[0] &&
  streetResult.choices[0].message &&
  typeof streetResult.choices[0].message.content === "string"
) {
  streetName = streetResult.choices[0].message.content.trim();
} else if (typeof streetResult === "string") {
  streetName = (streetResult as string).trim();
}
console.log(`Street name result:`, streetName);
if (streetName && !streetName.toLowerCase().includes("<answer>i don't know</answer>")) {
  console.log("Street found! Stopping further processing.");
  await CentralaService.sendStreetReport(streetName);
}