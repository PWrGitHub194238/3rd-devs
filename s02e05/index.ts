import { OpenAIService } from "./OpenAIService";
import { CentralaService } from "./CentralaService";
import axios from "axios";
import * as cheerio from "cheerio";
import * as fs from "fs/promises";
import * as path from "path";
import TurndownService from "turndown";
import * as dotenv from "dotenv";
import { OpenAIServiceWrapper } from "./OpenAIServiceWrapper";
import type { ChatCompletionMessageParam } from "openai/resources/index.mjs";

dotenv.config();

// Constants
const ARTICLE_URL = "https://c3ntrala.ag3nts.org/dane/arxiv-draft.html";
const QUESTIONS_URL = "https://c3ntrala.ag3nts.org/data/KLUCZ-API/arxiv.txt";
const OUTPUT_FOLDER = path.join(__dirname, "output");
const MARKDOWN_FILE = path.join(OUTPUT_FOLDER, "article.md");
const TASK_NAME = "arxiv";

async function main() {
  try {
    console.log('Rozpoczynam rozwiązywanie zadania "arxiv"...');

    // Create output directory if it doesn't exist
    await fs.mkdir(OUTPUT_FOLDER, { recursive: true });

    // Initialize OpenAI service
    const openAIService = new OpenAIServiceWrapper();

    // Step 1: Download and process the article
    console.log("Pobieranie artykułu profesora Maja...");
    const articleContent = await downloadArticle(ARTICLE_URL);

    // Step 2: Extract and process elements
    console.log("Przetwarzanie treści artykułu...");
    const { text, images, audioFiles } = await extractContentElements(
      articleContent,
      ARTICLE_URL
    );

    // Step 3: Convert HTML to Markdown
    console.log("Konwersja HTML do Markdown...");
    const markdownText = convertHtmlToMarkdown(text);

    // Step 4: Process images with OpenAI Vision
    console.log("Analizowanie obrazów...");
    const imageDescriptions = await processImages(images, openAIService);

    // Step 5: Transcribe audio files
    console.log("Transkrypcja plików audio...");
    const audioTranscriptions = await transcribeAudio(
      audioFiles,
      openAIService
    );

    // Step 6: Combine all content into a single Markdown file
    console.log("Tworzenie pliku Markdown z całą zawartością...");
    const fullContent = combineContent(
      markdownText,
      imageDescriptions,
      audioTranscriptions
    );
    await fs.writeFile(MARKDOWN_FILE, fullContent, "utf8");

    // Step 7: Download questions using CentralaService
    console.log("Pobieranie pytań od centrali...");
    const questionsText = await CentralaService.fetchText(QUESTIONS_URL);
    await fs.writeFile(
      path.join(OUTPUT_FOLDER, "questions.txt"),
      questionsText,
      "utf8"
    );
    const questions = parseQuestions(questionsText);

    // Step 8: Generate answers using OpenAI
    console.log("Generowanie odpowiedzi na pytania...");
    const answers = await generateAnswers(
      questions,
      fullContent,
      openAIService
    );

    // Step 9: Submit answers using CentralaService
    console.log("Wysyłanie odpowiedzi do centrali...");

    await submitAnswers(answers);

    console.log("Zadanie zostało zakończone pomyślnie!");
  } catch (error) {
    console.error("Wystąpił błąd podczas wykonywania programu:", error);
    process.exit(1);
  }
}

/**
 * Downloads the article from the given URL
 */
async function downloadArticle(url: string): Promise<string> {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    throw new Error(`Nie udało się pobrać artykułu: ${error}`);
  }
}

/**
 * Extracts text, image URLs, and audio file URLs from HTML content
 */
async function extractContentElements(
  html: string,
  baseUrl: string
): Promise<{
  text: string;
  images: Array<{ url: string; alt: string }>;
  audioFiles: Array<string>;
}> {
  const $ = cheerio.load(html);

  // Extract main text content
  const text = $("body").html() || "";

  // Extract image URLs and alt text
  const images = $("figure")
    .map((_, el) => {
      const src = $(el).children("img").attr("src");
      const alt = $(el).children("figcaption").text() || "";
      return { url: new URL(src || "", baseUrl).toString(), alt };
    })
    .get();

  // Extract audio file URLs
  const audioFiles = $("audio source")
    .map((_, el) => {
      const src = $(el).attr("src");
      return new URL(src || "", baseUrl).toString();
    })
    .get();

  return { text, images, audioFiles };
}

/**
 * Converts HTML content to Markdown format
 */
function convertHtmlToMarkdown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
  });

  return turndownService.turndown(html);
}

/**
 * Downloads and processes images using OpenAI Vision
 */
async function processImages(
  images: Array<{ url: string; alt: string }>,
  openAIService: OpenAIServiceWrapper
): Promise<Array<{ url: string; alt: string, description: string }>> {
  const descriptions: Array<{ url: string; alt: string, description: string }> = [];
  const descriptionsDir = path.join(OUTPUT_FOLDER, "image_descriptions");

  // Create descriptions directory if it doesn't exist
  await fs.mkdir(descriptionsDir, { recursive: true });

  for (const [index, image] of images.entries()) {
    console.log(
      `Przetwarzanie obrazu ${index + 1}/${images.length}: ${image.url}`
    );

    try {
      // Generate filenames based on index
      const imageFilename = `image_${index}.jpg`;
      const imagePath = path.join(OUTPUT_FOLDER, imageFilename);
      const descriptionFilename = `description_${index}.txt`;
      const descriptionPath = path.join(descriptionsDir, descriptionFilename);

      let description = "";

      // Check if description already exists
      try {
        const existingDescription = await fs.readFile(descriptionPath, "utf8");
        console.log(`Znaleziono istniejący opis dla obrazu ${imageFilename}`);
        description = existingDescription;
      } catch (err) {
        // Description doesn't exist, proceed with downloading and processing

        // Check if image file already exists
        let imageBuffer: Buffer;
        try {
          imageBuffer = await fs.readFile(imagePath);
          console.log(`Używam istniejącego pliku obrazu: ${imagePath}`);
        } catch (err) {
          // Image file doesn't exist, download it
          console.log(`Pobieranie pliku obrazu: ${image.url}`);
          const response = await axios.get(image.url, {
            responseType: "arraybuffer",
          });
          imageBuffer = Buffer.from(response.data);
          await fs.writeFile(imagePath, imageBuffer);
        }

        // Generate image description using OpenAI
        console.log(`Generowanie opisu dla obrazu: ${imagePath}`);
        const prompt = `Opisz krótko ten obraz w kontekście artykułu naukowego. Postaraj się rozpoznać co znajduje się na obrazie. ${image.alt ? `Obraz ma podpis: "${image.alt}".` : ""}`;
        const visionResult = await openAIService.analyzeImage(
          imageBuffer,
          prompt
        );

        description = visionResult;
        // Save description to file
        await fs.writeFile(descriptionPath, description, "utf8");
      }

      descriptions.push({ url: image.url, alt: image.alt, description });
    } catch (error) {
      console.error(`Błąd podczas przetwarzania obrazu ${image.url}:`, error);
      descriptions.push({
        url: image.url,
        alt: image.alt,
        description: `[Nie udało się przetworzyć obrazu: ${error}]`,
      });
    }
  }

  return descriptions;
}

/**
 * Downloads and transcribes audio files using OpenAI Whisper
 */
async function transcribeAudio(
  audioUrls: string[],
  openAIService: OpenAIServiceWrapper
): Promise<Array<{ url: string; transcription: string }>> {
  const transcriptions = [];
  const transcriptionDir = path.join(OUTPUT_FOLDER, "transcriptions");

  // Create transcription directory if it doesn't exist
  await fs.mkdir(transcriptionDir, { recursive: true });

  for (const [index, url] of audioUrls.entries()) {
    console.log(
      `Transkrypcja pliku audio ${index + 1}/${audioUrls.length}: ${url}`
    );

    try {
      // Generate a filename based on the URL
      const audioFilename = `audio_${index}.mp3`;
      const audioPath = path.join(OUTPUT_FOLDER, audioFilename);
      const transcriptionFilename = `transcription_${index}.txt`;
      const transcriptionPath = path.join(
        transcriptionDir,
        transcriptionFilename
      );

      let transcription = "";

      // Check if transcription already exists
      try {
        const existingTranscription = await fs.readFile(
          transcriptionPath,
          "utf8"
        );
        console.log(
          `Znaleziono istniejącą transkrypcję dla pliku ${audioFilename}`
        );
        transcription = existingTranscription;
      } catch (err) {
        // Transcription doesn't exist, proceed with downloading and processing

        // Check if audio file already exists
        let audioBuffer: Buffer;
        try {
          audioBuffer = await fs.readFile(audioPath);
          console.log(`Używam istniejącego pliku audio: ${audioPath}`);
        } catch (err) {
          // Audio file doesn't exist, download it
          console.log(`Pobieranie pliku audio: ${url}`);
          const response = await axios.get(url, {
            responseType: "arraybuffer",
          });
          audioBuffer = Buffer.from(response.data);
          await fs.writeFile(audioPath, audioBuffer);
        }

        // Transcribe audio using OpenAI Whisper
        console.log(`Transkrybuję plik audio: ${audioPath}`);
        transcription = await openAIService.transcribeAudio(audioPath);

        // Save transcription to file
        await fs.writeFile(transcriptionPath, transcription, "utf8");
      }

      transcriptions.push({ url, transcription });
    } catch (error) {
      console.error(`Błąd podczas transkrypcji pliku audio ${url}:`, error);
      transcriptions.push({
        url,
        transcription: `[Nie udało się dokonać transkrypcji: ${error}]`,
      });
    }
  }

  return transcriptions;
}

/**
 * Combines markdown text, image descriptions, and audio transcriptions into a single document
 */
function combineContent(
  markdownText: string,
  imageDescriptions: Array<{ url: string; alt: string, description: string }>,
  audioTranscriptions: Array<{ url: string; transcription: string }>
): string {
  let combinedContent = markdownText;

  // Replace image anchors
  const imageRegex = /!\[[^\]]*\]\((.*[.](png|jpg)+)\)/g;
  let imageMatch;

  // Match all markdown images in the format "![](i/fruit02.png)"
  while ((imageMatch = imageRegex.exec(markdownText)) !== null) {
    const imagePath = imageMatch[1] as string;
    const imageIndex = imageDescriptions.findIndex(x => x.url.includes(imagePath));

    if (imageIndex !== -1)
    {
      combinedContent = combinedContent.replace(imageMatch[0], `(Załącznik: Opisy obrazów, załącznik numer ${imageIndex + 1})`)
    }
  }

  // Replace image anchors
  const audioRegex = /\[[^\]]*\]\((.*[.](mp3|wav)+)\)/g;
  let audioMatch;

  // Match all markdown audios in the format "![](i/fruit02.png)"
  while ((audioMatch = audioRegex.exec(markdownText)) !== null) {
    const audioPath = audioMatch[1] as string;
    const audioIndex = audioTranscriptions.findIndex(x => x.url.includes(audioPath));

    if (audioIndex !== -1)
    {
      combinedContent = combinedContent.replace(audioMatch[0], `(Załącznik: Transkrypcje plików audio, załącznik numer ${audioIndex + 1})`)
    }
  }

  // Add image descriptions
  if (imageDescriptions.length > 0) {
    combinedContent += "\n\n## Opisy obrazów\n\n";
    imageDescriptions.forEach((image, index) => {
      combinedContent += `### Obraz ${index + 1}: ${image.url}\n\nOpis tesktowy z artykułu:${image.alt}\n\nOpis grafiki: ${image.description}\n\n`;
    });
  }

  // Add audio transcriptions
  if (audioTranscriptions.length > 0) {
    combinedContent += "\n\n## Transkrypcje plików audio\n\n";
    audioTranscriptions.forEach((audio, index) => {
      combinedContent += `### Nagranie ${index + 1}: ${audio.url}\n\n${audio.transcription}\n\n`;
    });
  }

  return combinedContent;
}

/**
 * Parses questions from the text format
 */
function parseQuestions(questionsText: string): Record<string, string> {
  const questions: Record<string, string> = {};
  const regex = /(\d+)=\s*(.+)\n/g;
  let match;
  // Match all questions in the format "ID-pytania-<id>: <question>"
  while ((match = regex.exec(questionsText)) !== null) {
    const id = match[1] as string;
    const question = match[2]!.trim();
    questions[id] = question;
  }

  return questions;
}

/**
 * Generates answers to questions using OpenAI based on the content
 */
async function generateAnswers(
  questions: Record<string, string>,
  content: string,
  openAIService: OpenAIServiceWrapper
): Promise<Record<string, string>> {
  const answers: Record<string, string> = {};
  const wrongAnswersFile = path.join(OUTPUT_FOLDER, "wrong_answers.json");
  const goodAnswersFile = path.join(OUTPUT_FOLDER, "good_answers.json");

  // Load wrong answers if they exist
  let wrongAnswers: Record<string, string[]> = {};
  try {
    const wrongAnswersData = await fs.readFile(wrongAnswersFile, "utf8");
    wrongAnswers = JSON.parse(wrongAnswersData);
    console.log(
      "Znaleziono wcześniejsze niepoprawne odpowiedzi:",
      wrongAnswers
    );
  } catch (err) {
    // File doesn't exist or is invalid, start with empty record
    console.log("Brak wcześniejszych niepoprawnych odpowiedzi");
  }

  // Load good answers if they exist
  let goodAnswers: Record<string, string[]> = {};
  try {
    const goodAnswersData = await fs.readFile(goodAnswersFile, "utf8");
    goodAnswers = JSON.parse(goodAnswersData);
    console.log(
      "Znaleziono wcześniejsze poprawne odpowiedzi:",
      goodAnswers
    );
  } catch (err) {
    // File doesn't exist or is invalid, start with empty record
    console.log("Brak wcześniejszych poprawnych odpowiedzi");
  }

  // Create a context for OpenAI with content summary if it's too large
  let contextContent = content;
  if (content.length > 50000) {
    // If content is too large, summarize it first
    console.log("Za długi tekst - trwa podsumowywanie...");
    const summary = await summarizeContent(content, openAIService);
    contextContent = summary;
  }

  // Process each question
  for (const [id, question] of Object.entries(questions)) {
    console.log(`Generowanie odpowiedzi na pytanie ${id}: ${question}`);

    // Check if there are previous good answers for this question
    const previousGoodAnswers = goodAnswers[id] || [];

    if (previousGoodAnswers.length > 0) {
      console.log(`Udzielono już poprawnej odpowiedzi na pytanie ${id}: ${question}`);
      console.log(previousGoodAnswers);
      
      answers[id] = previousGoodAnswers[0] as string;
      continue;
    }

    // Check if there are previous wrong answers for this question
    const previousWrongAnswers = wrongAnswers[id] || [];
    

    let systemPrompt = `Jesteś asystentem analizującym artykuł profesora Maja. Poniżej znajduje się treść artykułu wraz z opisami obrazów i transkrypcjami nagrań. Odpowiedz na pytanie w jednym zwięzłym zdaniu, bazując wyłącznie na podanych informacjach.\n\n${contextContent}`;
    let userPrompt = `Pytanie: ${question}\n\nOdpowiedz w jednym zwięzłym zdaniu, używając tylko faktów z artykułu. Uwzględnij też opisy załączników z artykułu oraz ich szczegółowe opisy, łączać je z treścią arykułu. Ilekroć natkniesz się na fragment: (Załącznik: ...), fragment ten został przeniesiony na koniec artykułu.`;

    // If there are previous wrong answers, add them to the prompt
    if (previousWrongAnswers.length > 0) {
      systemPrompt +=
        "\n\nWAŻNE: Poprzednie odpowiedzi na to pytanie zostały uznane za niepoprawne. Udziel zupełnie innej odpowiedzi.";
      userPrompt += `\n\nNastępujące odpowiedzi zostały uznane za NIEPOPRAWNE (NIE powtarzaj ich ani podobnych do nich):\n${previousWrongAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
    }

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const completion = await openAIService.completionContent(messages);
    let answer = completion;

    // If answer contains multiple sentences, extract just the first one
    if (answer.includes(". ")) {
      answer = answer.split(". ")[0] + ".";
    }

    answers[id] = answer;
  }

  return answers;
}

/**
 * Summarizes content if it's too large for the context window
 */
async function summarizeContent(
  content: string,
  openAIService: OpenAIServiceWrapper
): Promise<string> {
  console.log("Streszczanie zawartości artykułu...");

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "Streszcz poniższy tekst, zachowując wszystkie kluczowe informacje, fakty, liczby, nazwy, daty i szczegóły techniczne.",
    },
    {
      role: "user",
      content,
    },
  ];

  const completion = await openAIService.completionContent(messages);

  return completion;
}

/**
 * Submits answers to the centrala API
 */
async function submitAnswers(answers: Record<string, string>): Promise<void> {
  console.log("Przygotowane odpowiedzi:", answers);

  try {
    const response = await CentralaService.send(TASK_NAME, answers);

    if (!response) {
      throw new Error("Nie otrzymano odpowiedzi z centrali.");
    }

    console.log("Odpowiedź od API:", response);

    // Save the submission and response for reference
    await fs.writeFile(
      path.join(OUTPUT_FOLDER, "submission.json"),
      JSON.stringify(answers, null, 2),
      "utf8"
    );

    await fs.writeFile(
      path.join(OUTPUT_FOLDER, "response.json"),
      JSON.stringify(response, null, 2),
      "utf8"
    );

    // Check if the response indicates a wrong answer
    if (response && response.code === -304 && response.message) {
      // Extract the question number from the error message
      const match = response.message.match(
        /wrong answer for question (\d+)/i
      );
      if (match && match[1]) {
        const questionId = match[1] as string;

        await updateGoodAnswers(questionId, answers);
        
        console.log(`Odpowiedź na pytanie ${questionId} jest niepoprawna!`);

        await updateWrongAnswers(questionId, answers);

        console.warn(`Niepoprawna odpowiedź na pytanie ${questionId}: ${answers[questionId]}`);
      }
    }
  } catch (error) {
    console.error(`Błąd podczas wysyłania odpowiedzi: ${error}`);
    throw error;
  }
}

async function updateGoodAnswers(firstWrongAnswerId: string, answers: Record<string, string>) {
  const goodAnswersFile = path.join(OUTPUT_FOLDER, "good_answers.json");
  let goodAnswers: Record<string, string[]> = {};

  console.log(
    `Dodaję poprawne odpowiedzi do listy poprawnie udzielonych odpowiedzi.`
  );
  try {
    const goodAnswersData = await fs.readFile(goodAnswersFile, "utf8");
    goodAnswers = JSON.parse(goodAnswersData);
  } catch (err) {
    // File doesn't exist or is invalid, start with empty record
  }
  var questionIds = Object.keys(answers);

  for (const questionId of questionIds) {
    if (questionId !== firstWrongAnswerId) {
      // Add the current wrong answer to the list
      if (!goodAnswers[questionId]) {
        goodAnswers[questionId] = [];
      }

      if (answers[questionId]) {
        if (goodAnswers[questionId].includes(answers[questionId]))
        {
          console.log(
            `Taka sama poprawna odpowiedź na pytanie ${questionId} już została udzielona wcześniej - pomijam.`
          );
        }
        else
        {
        console.log(
          `Dodaję poprawną odpowiedź do listy: ${answers[questionId]}`
        );
        goodAnswers[questionId].push(answers[questionId]);
        }
      } else {
        console.log(`Nie znaleziono odpowiedzi dla pytania ${questionId}`);
      }
    } else {
      break;
    }
  }

  // Save updated good answers
  await fs.writeFile(
    goodAnswersFile,
    JSON.stringify(goodAnswers, null, 2),
    "utf8"
  );
}

async function updateWrongAnswers(firstWrongAnswerId: string, answers: Record<string, string>) {
    // Load existing wrong answers
  let wrongAnswers: Record<string, string[]> = {};
  const wrongAnswersFile = path.join(OUTPUT_FOLDER, "wrong_answers.json");

  console.log(
    `Dodaję błędną odpowiedź do listy niepoprawnie udzielonych odpowiedzi.`
  );

  try {
    const wrongAnswersData = await fs.readFile(wrongAnswersFile, "utf8");
    wrongAnswers = JSON.parse(wrongAnswersData);
  } catch (err) {
    // File doesn't exist or is invalid, start with empty record
  }

  // Add the current wrong answer to the list
  if (!wrongAnswers[firstWrongAnswerId]) {
    wrongAnswers[firstWrongAnswerId] = [];
  }

  if (answers[firstWrongAnswerId]) {
    console.log(
      `Dodaję niepoprawną odpowiedź do listy: ${answers[firstWrongAnswerId]}`
    );
    wrongAnswers[firstWrongAnswerId].push(answers[firstWrongAnswerId]);
  } else {
    console.log(`Nie znaleziono odpowiedzi dla pytania ${firstWrongAnswerId}`);
  }

  // Save updated wrong answers
  await fs.writeFile(
    wrongAnswersFile,
    JSON.stringify(wrongAnswers, null, 2),
    "utf8"
  );
}

// Start the program
main();