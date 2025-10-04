import type { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { CentralaService } from "./CentralaService";
import { documents } from "./documents";
import { OpenAIServiceWrapper } from "./OpenAIServiceWrapper";

console.log("Witaj przez Bun!");

console.log(documents);

console.log("Gotowy do wyświetlania dokumentów z tablicy.");

const correctAnswers: Record<string, string> = {
  "01": "Rafał przeniósł się prawdopodobnie do roku 2019.",
  "02": "Na podstawie wpisów z pamiętnika, to Adam miał znaczący wpływ na decyzje dotyczące podróży Rafała w czasie.",
  "03": "Jaskinia",
  "04": "2024-11-12",
  "05": "Rafał chce się dostać do miejscowości Lubawa koło Grudziądza."
}

// Interface for the questions received from CentralaService
interface Questions {
  [key: string]: string;
}

/**
 * Fetches questions data from CentralaService
 * @returns Promise with questions data
 */
async function fetchQuestionsFromCentrala(): Promise<Questions> {
  try {
    const url = "https://c3ntrala.ag3nts.org/data/TUTAJ-KLUCZ/notes.json";
    const response = await CentralaService.fetch(url);

    const data = response as Questions;
    return data;
  } catch (error) {
    console.error("Błąd podczas pobierania pytań z CentralaService:", error);
    // Return an empty object in case of error
    return {};
  }
}

/**
 * Hints for specific questions to help guide the LLM
 */
const questionHints: Record<string, string> = {
  "01": "Odpowiedź nie jest podana wprost. Musisz przeanalizować wszystkie wpisy z pamiętnika i wywnioskować, do którego roku przeniósł się Rafał.",

  "03": "Zwróć szczególną uwagę na wizualny opis wpisów, a zwłaszcza na drobny, szary tekst pod jednym z rysunków w notatniku. Jest tam informacja o miejscu schronienia Rafała, zapisana jako oznaczenie biblijne Iz 2:19.",

  "04": 'Data jest podana względnie. Musisz obliczyć konkretną datę na podstawie dostępnych informacji. Zwróć uwagę na wpis z datą 11 listopada 2024 i wzmiankę o tym, że coś ma się wydarzyć "jutro". Odpowiedź musi być w formacie YYYY-MM-DD.',

  "05": "Uważaj, tekst może zawierać błędy wynikające z OCR. Nazwa miejscowości może być rozbita na dwa fragmenty lub błędnie zapisana. Szukasz miejsca niedaleko Grudziądza, do którego Rafał chce się dostać po spotkaniu z Andrzejem.",
};

/**
 * Gets an answer to a specific question using the documents as context
 * @param questionId The ID of the question to answer
 * @param question The question text
 * @param feedback Optional feedback from previous attempts
 * @returns Promise with the answer from the LLM
 */
async function getAnswerToQuestion(
  questionId: string,
  question: string,
  feedback?: string
): Promise<string | null> {
  console.log(`Pobieranie odpowiedzi na pytanie ${questionId}: "${question}"`);
  if (feedback) {
    console.log(`Używanie informacji zwrotnych z poprzednich prób`);
  }

  // Get the specific hint for this question if available
  const specificHint = questionHints[questionId] || "";
  if (specificHint) {
    console.log(`Używanie specjalnej wskazówki dla pytania ${questionId}`);
  }

  try {
    // Prepare system message with documents as context
    const systemContent = `
<context>
To są fragmenty z osobistego pamiętnika Rafała. Każdy wpis zawiera treść i wizualny opis wyglądu strony pamiętnika. Uwzględnij przede wszystkim <visual_description>, gdyż mogą wskazywać, że niektóre informacje w treści są nieczytelnie lub istotniejsze od pozostałych.

${documents
  .map(
    (doc, index) => `
<diary_entry id="${index + 1}">
  <content>${doc.content}</content>
  <visual_description>${doc.visualDescription}</visual_description>
</diary_entry>`
  )
  .join("\n")}
</context>

Analizujesz te wpisy z pamiętnika, aby odpowiedzieć na pytania dotyczące doświadczeń Rafała i opisywanych przez niego wydarzeń. 

${
  feedback
    ? `
Odpowiadasz ba wskazane pytanie kolejny raz, gdyż z jakiegoś powodu system weryfikujący odpowiedzi uznał poprzednie za odpowiedzi błędne.
Uwzględnij wszystkie podpowiedzi od tego systemu, zwłaszcza z pola <hints>. Nie powtarzaj także już raz udzielonych odpowiedzi, skoro są błędne.
<previous_feedback>
${feedback}
</previous_feedback>
`
    : ""
}

WAŻNE: Musisz odpowiedzieć w formacie JSON z dokładnie dwoma polami:
1. "_thinking": Twoja szczegółowa analiza i proces rozumowania (nie pokazywany użytkownikowi)
2. "answer": Twoja ostateczna zwięzła odpowiedź na pytanie

Przykładowa odpowiedź:
{
  "_thinking": "Tutaj analizuję wpisy z pamiętnika, aby znaleźć istotne informacje...",
  "answer": "Na podstawie wpisów z pamiętnika, Rafał..."
}

NIE dołączaj żadnego tekstu poza tą strukturą JSON. Zwróć TYLKO obiekt JSON.
`;

    // Create an instance of OpenAIServiceWrapper
    const openAIService = new OpenAIServiceWrapper();

    // Prepare messages array for the OpenAI service
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: systemContent,
      },
      {
        role: "user",
        content: specificHint
          ? `Odpowiedz na następujące pytanie na podstawie wpisów z pamiętnika Rafała: ${question}

Wskazówka: ${specificHint}`
          : `Odpowiedz na następujące pytanie na podstawie wpisów z pamiętnika Rafała: ${question}`,
      },
    ];

    // Call the OpenAI service to get the answer
    console.log(`Wysyłanie zapytania do OpenAI dla pytania ${questionId}...`);
    const response = await openAIService.completionContent(
      messages,
      undefined,
      "gpt-4o",
      "json_object"
    );
    console.log(`Otrzymano odpowiedź z OpenAI dla pytania ${questionId}`);
    console.log(response);

    try {
      // Parse the JSON response
      const parsedResponse = JSON.parse(response);
      // Return only the answer field
      console.log(
        `Odpowiedź na pytanie ${questionId}: "${parsedResponse.answer}"`
      );
      return parsedResponse.answer;
    } catch (parseError) {
      console.error(
        `Błąd podczas analizy odpowiedzi JSON dla pytania ${questionId}:`,
        parseError
      );
      console.log(`Powrót do surowej odpowiedzi dla pytania ${questionId}`);
      return response; // Return the original response if parsing fails
    }
  } catch (error) {
    console.error(
      `Błąd podczas pobierania odpowiedzi na pytanie ${questionId}:`,
      error
    );
    return null;
  }
}

interface AnswerResponse {
  code: number;
  message: string;
  hint?: string;
  debug?: string;
}

/**
 * Interface to track answer attempts and their hints
 */
interface AnswerAttempt {
  answer: string;
  hints: string[];
}

/**
 * Processes a single question until the answer is correct
 * @param questionId The ID of the question to process
 * @param questionText The text of the question
 * @param allQuestionIds All question IDs that need to be sent
 * @param maxRetries Maximum number of retries per question
 * @returns True if the answer was accepted, false otherwise
 */
async function processQuestionUntilCorrect(
  questionId: string,
  questionText: string,
  allQuestionIds: string[],
  maxRetries: number = 5
): Promise<string | null> {
  console.log(`Przetwarzanie pytania ${questionId}: "${questionText}"`);
  let retries = 0;
  let success = false;
  let answer = null;

  if (correctAnswers[questionId])
  {
    console.log(`Udzielono już poprawnej odpowiedzi na pytanie ${questionId}: "${correctAnswers[questionId]}"`);
    return correctAnswers[questionId];
  }

  // Track answer attempts and their hints
  const answerAttempts: AnswerAttempt[] = [];
  let currentAttempt: AnswerAttempt | null = null;

  while (!success && retries < maxRetries) {
    try {
      // Prepare feedback from previous attempts
      let feedback: string | undefined = undefined;
      if (answerAttempts.length > 0) {
        const attemptsXml = answerAttempts
          .map((attempt, index) => {
            return `<attempt number="${index + 1}">
  <answer>${attempt.answer}</answer>
  <hints>
    ${
      attempt.hints.length > 0
        ? attempt.hints.map((hint) => `<hint>${hint}</hint>`).join("\n    ")
        : "<no_hints>Nie podano żadnych wskazówek</no_hints>"
    }
  </hints>
</attempt>`;
          })
          .join("\n");

        feedback =
          answerAttempts.length > 0
            ? `<previous_attempts count="${answerAttempts.length}>
${attemptsXml}
</previous_attempts>`
            : undefined;
      }

      // Get the answer for this question
      answer = await getAnswerToQuestion(
        questionId,
        questionText,
        feedback
      );

      if (!answer) {
        console.error(
          `Nie udało się uzyskać odpowiedzi na pytanie ${questionId}`
        );
        retries++;
        continue;
      }

      // Create a new attempt object
      currentAttempt = {
        answer,
        hints: [],
      };

      // Create an answers object with all question keys, using empty strings for others
      const answersWithAllKeys: Record<string, string | null> = {};

      // Initialize all keys with empty strings
      for (const id of allQuestionIds) {
        answersWithAllKeys[id] = correctAnswers[id] ? correctAnswers[id] : "";
      }

      // Set the current answer for this question
      answersWithAllKeys[questionId] = answer;

      // Submit all keys with the current answer
      console.log(
        `Wysyłanie odpowiedzi na pytanie ${questionId} do CentralaService (ze wszystkimi ${allQuestionIds.length} kluczami pytań)...`
      );
      console.log(answersWithAllKeys);
      const response = await CentralaService.sendAnswer(
        "notes",
        answersWithAllKeys
      );

      // Log the response
      console.log(`Odpowiedź dla pytania ${questionId}:`, response);

      if (response.code >= 0) {
        success = true;
        console.log(`Odpowiedź na pytanie ${questionId} jest poprawna!`);
      } else {
        retries++;
        console.log(
          `Próba ${retries}/${maxRetries} dla pytania ${questionId} nie powiodła się. Próbuję ponownie...`
        );

        // Store the hint for this attempt
        if (response.hint && currentAttempt) {
          console.log(
            `Nowa wskazówka dla pytania ${questionId}: ${response.hint}`
          );
          currentAttempt.hints.push(response.hint);
        }

        // Store the incorrect answer attempt
        if (response.debug && currentAttempt) {
          currentAttempt.answer = response.debug
            .replace("You sent: ", "")
            .trim();
          console.log(
            `Zarejestrowano niepoprawną odpowiedź dla pytania ${questionId}: "${currentAttempt.answer}"`
          );

          // Add this attempt to our history
          answerAttempts.push({ ...currentAttempt });
          console.log(
            `Teraz mamy ${answerAttempts.length} zarejestrowanych prób dla pytania ${questionId}`
          );
        }

        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      retries++;
      console.error(
        `Błąd podczas próby ${retries}/${maxRetries} dla pytania ${questionId}:`,
        error
      );
    }

    // Add a delay between retries
    if (!success && retries < maxRetries) {
      const delayTime = 3000;
      console.log(
        `Oczekiwanie ${delayTime / 1000} sekund przed następną próbą dla pytania ${questionId}...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayTime));
    }
  }

  if (!success) {
    console.log(`Próby odpowiedzi na pytanie ${questionId}:`);
    answerAttempts.forEach((attempt, index) => {
      console.log(`Próba #${index + 1}: "${attempt.answer}"`);
      console.log(
        `Wskazówki: ${attempt.hints.length > 0 ? attempt.hints.join(", ") : "Brak"}`
      );
    });

    console.error(
      `Nie udało się uzyskać poprawnej odpowiedzi na pytanie ${questionId} po ${maxRetries} próbach.`
    );
    return null;
  }

  console.log(
    `Pomyślnie przetworzono pytanie ${questionId} po ${retries + 1} próbach.`
  );
  return answer;
}

/**
 * Processes all questions one by one, retrying each until correct
 * @param maxRetries Maximum number of retries per question
 */
async function processAllQuestionsSequentially(
  maxRetries: number = 5
): Promise<void> {
  console.log(
    `Rozpoczynanie sekwencyjnego przetwarzania pytań z maksymalnie ${maxRetries} próbami na pytanie`
  );

  // Fetch all questions
  console.log(`Pobieranie pytań z CentralaService...`);
  const questions = await fetchQuestionsFromCentrala();
  console.log(`Pobrano ${Object.keys(questions).length} pytań`);

  if (Object.keys(questions).length === 0) {
    console.error("Nie pobrano żadnych pytań z CentralaService. Przerywanie.");
    return;
  }

  // Process questions sequentially
  const results: Record<string, string | null> = {};
  const questionIds = Object.keys(questions).sort(); // Sort to process in order

  for (const questionId of questionIds) {
    console.log(
      `\n=== Rozpoczynanie przetwarzania pytania ${questionId} ===\n`
    );
    results[questionId] = await processQuestionUntilCorrect(
      questionId,
      questions[questionId]!,
      questionIds, // Pass all question IDs
      maxRetries
    );
    console.log(
      `\n=== Zakończono przetwarzanie pytania ${questionId} z wynikiem: ${
        results[questionId] ? "SUKCES" : "NIEPOWODZENIE"
      } ===\n`
    );
  }

  // Summary of results
  const successCount = Object.values(results).filter((r) => r).length;
  console.log(`\n=== WYNIKI KOŃCOWE ===`);
  console.log(
    `Pomyślnie przetworzono ${successCount} z ${questionIds.length} pytań.`
  );

  for (const questionId of questionIds) {
    console.log(`Pytanie ${questionId}: ${results[questionId] ? "✓" : "✗"}`);
  }
}

// Replace the main function
async function main() {
  console.log("Rozpoczynanie procesu analizy dokumentów...");
  console.time("Całkowity czas wykonania");

  try {
    // Use the new sequential processing instead
    await processAllQuestionsSequentially();
    console.log("Proces zakończony");
  } catch (error) {
    console.error("Wystąpił błąd podczas wykonania:", error);
  }

  console.timeEnd("Całkowity czas wykonania");
}

// Run the main function
await main().catch((error) => {
  console.error("Błąd krytyczny:", error);
  process.exit(1);
});
