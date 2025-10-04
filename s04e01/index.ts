import { CentralaService } from "./CentralaService";
import { OpenAIServiceWrapper } from "./OpenAIServiceWrapper";

async function sendCommand(answer: string): Promise<any> {
  const task = "photos";
  return await CentralaService.sendAnswer(task, answer);
}

export async function sendStartCommand(): Promise<any> {
  const response = await sendCommand("START");
  console.log("Odpowiedź z API:", response);
  return response;
}

export async function sendPhotoCommand(
  command: "REPAIR" | "DARKEN" | "BRIGHTEN",
  filename: string
): Promise<any> {
  const answer = `${command} ${filename}`;
  const response = await sendCommand(answer);
  console.log(`Odpowiedź z API (${answer}):`, response);
  return response;
}

/**
 * Przekazuje odpowiedź z sendStartCommand do LLM i prosi o wyodrębnienie listy nazw plików zdjęć
 * oraz opcjonalnie wspólnego adresu URL, jeśli taki istnieje.
 * @param startResponse odpowiedź z sendStartCommand
 * @returns Promise<{ filenames: string[], baseUrl?: string }>
 */
export async function extractPhotoUrlsFromStartResponse(
  startResponse: any
): Promise<{ filenames: string[]; baseUrl?: string }> {
  const systemPrompt = `Jesteś asystentem AI. Otrzymasz opis zawierający opis zdjęć. Wyodrębnij i zwróć wyłącznie listę nazw plików zdjęć (np. ["IMG_123.PNG","IMG_456.PNG"]) w formacie JSON pod kluczem "filenames". Jeśli opis zawiera także adres URL, zwróć go pod kluczem "baseUrl". Przykład odpowiedzi: {"filenames":["IMG_123.PNG","IMG_456.PNG"],"baseUrl":"https://example.com/photos/"}. Jeśli nie ma wspólnego adresu URL, zwróć tylko "filenames". Nie dodawaj żadnych komentarzy ani tekstu.`;
  const userPrompt = `Opis: ${startResponse.message}`;
  const openai = new OpenAIServiceWrapper();
  const result = await openai.completionContent([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  try {
    return JSON.parse(result);
  } catch {
    return { filenames: [] };
  }
}

/**
 * Analizuje zdjęcie pod kątem jakości i decyduje, czy wymaga korekty.
 * Zwraca jedną z opcji: "REPAIR", "DARKEN", "BRIGHTEN" lub null (jeśli nie wymaga korekty).
 * @param imageUrl URL zdjęcia do analizy
 */
export async function analyzePhotoQuality(
  imageUrl: string
): Promise<"REPAIR" | "DARKEN" | "BRIGHTEN" | "OK" | null> {
  const systemPrompt = [
    `Jesteś ekspertem od analizy jakości zdjęć.`,
    `Twoim zadaniem jest ocenić, czy zdjęcie wymaga korekty.`,
    `Dobrej jakości zdjęcie to takie, które nadaje się do rozpoznania osoby na nim przedstawionej.`,
    `Jeśli zdjęcie wymaga naprawy szumów/glitchy, zwróć "REPAIR".`,
    `Jeśli jest zbyt jasne, zwróć "DARKEN".`,
    `Jeśli jest zbyt ciemne, zwróć "BRIGHTEN".`,
    `Jeśli zdjęcie jest dobrej jakości i nie wymaga korekty, zwróć "OK".`,
    `Odpowiadaj tylko jednym słowem spośród: REPAIR, DARKEN, BRIGHTEN, OK.`,
  ].join("\n");
  const openai = new OpenAIServiceWrapper();
  const result = await openai.analyzeImageByUrl(imageUrl, systemPrompt);
  const answer = result.trim().toUpperCase();
  if (
    answer === "REPAIR" ||
    answer === "DARKEN" ||
    answer === "BRIGHTEN" ||
    answer === "OK"
  ) {
    return answer as "REPAIR" | "DARKEN" | "BRIGHTEN" | "OK";
  }

  return null;
}

/**
 * Analizuje jakość zdjęcia i jeśli wymaga korekty, wysyła odpowiednią komendę do API.
 * @param imageUrl URL zdjęcia do analizy
 * @param filename Nazwa pliku zdjęcia (np. IMG_123.PNG)
 * @returns Odpowiedź z API po ewentualnej korekcie lub null jeśli nie wymaga korekty
 */
export async function processPhoto(
  imageUrl: string,
  filename: string
): Promise<any> {
  const quality = await analyzePhotoQuality(imageUrl);
  if (quality && quality !== "OK") {
    console.log(
      `[processPhoto] Wymagana korekta (${quality}) dla pliku: ${filename}`
    );
    return await sendPhotoCommand(quality, filename);
  }
  console.log(`[processPhoto] Plik ${filename} nie wymaga korekty.`);
  return null;
}

/**
 * Pyta LLM czy wiadomość z API oznacza, że zdjęcie nie może być już bardziej poprawione.
 * @param message Tekst wiadomości z API
 * @returns true jeśli nie można już poprawić, false w przeciwnym razie
 */
async function isPhotoUnimprovable(message: string): Promise<boolean> {
  const systemPrompt = [
    "Jesteś asystentem AI.",
    "Otrzymasz wiadomość z narzędzia do poprawy zdjęć.",
    "Odpowiedz 'TAK', jeśli z treści wynika, że zdjęcie nie może być już bardziej poprawione.",
    "Odpowiedz 'NIE' w przeciwnym razie.",
    "Odpowiadaj tylko jednym słowem: TAK lub NIE.",
  ].join("\n");
  const userPrompt = `Wiadomość z narzędzia:\n${message}`;
  const openai = new OpenAIServiceWrapper();
  const result = await openai.completionContent([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  return result.trim().toUpperCase() === "TAK";
}

/**
 * Poprawia zdjęcie iteracyjnie, aż analyzePhotoQuality zwróci "OK" lub nie będzie możliwa dalsza poprawa.
 * @param imageUrl URL zdjęcia do analizy
 * @param filename Nazwa pliku zdjęcia (np. IMG_123.PNG)
 * @returns Ostateczna nazwa pliku poprawionego zdjęcia lub null jeśli nie udało się poprawić
 */
export async function improvePhotoUntilOk(
  baseUrl: string,
  filename: string
): Promise<string | null> {
  let currentFilename = filename;
  let currentBaseUrl = baseUrl;
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const imageUrl = currentBaseUrl + currentFilename;
    await delay(2000);
    const quality = await analyzePhotoQuality(imageUrl);
    console.log(
      `[improvePhotoUntilOk] Próba ${attempts + 1} dla ${currentFilename}, jakość: ${quality}`
    );
    if (quality === "OK") {
      console.log(`[improvePhotoUntilOk] Plik ${currentFilename} jest OK.`);
      return currentFilename;
    }
    if (!quality) {
      console.log(
        `[improvePhotoUntilOk] Nie można poprawić pliku ${currentFilename} lub nie rozpoznano problemu.`
      );
      return null;
    }
    const response = await sendPhotoCommand(quality, currentFilename);
    const match = response?.message?.match(/([A-Z0-9_\-]+\.PNG)/i);
    if (match) {
      currentFilename = match[1];
      console.log(
        `[improvePhotoUntilOk] Nowa nazwa pliku po poprawie: ${currentFilename}`
      );
    } else {
      console.log(
        `[improvePhotoUntilOk] Nie udało się wyciągnąć nowej nazwy pliku z odpowiedzi dla ${currentFilename}.`
      );
      // Dodane: zapytaj LLM czy zdjęcie nie może być już poprawione
      const cannotImprove = await isPhotoUnimprovable(response?.message || "");
      if (cannotImprove) {
        console.log(
          `[improvePhotoUntilOk] LLM uznał, że zdjęcie nie może być już bardziej poprawione.`
        );
        return currentFilename;
      } else {
        console.log(
          `[improvePhotoUntilOk] LLM uznał, że można próbować dalej, ale brak nowej nazwy pliku.`
        );
        return null;
      }
    }
    attempts++;
  }
  console.log(
    `[improvePhotoUntilOk] Osiągnięto maksymalną liczbę prób dla ${filename}.`
  );
  return null;
}

/**
 * Generuje opis postaci znajdującej się na zdjęciu na podstawie podanego URL oraz opisu kogo szukamy.
 * @param imageUrl URL zdjęcia do analizy
 * @param targetDescription Opis osoby, której szukamy (np. "Barbara, kobieta, około 30 lat")
 * @returns Opis postaci w języku polskim
 */
export async function describePersonOnPhoto(
  imageUrl: string,
  targetDescription: string
): Promise<string> {
  const systemPrompt = [
    "Jesteś ekspertem od analizy zdjęć i rozpoznawania osób.",
    "Twoim zadaniem jest przeanalizować zdjęcie i wygenerować szczegółowy opis osoby znajdującej się na zdjęciu.",
    "Opis powinien być w języku polskim i zawierać cechy umożliwiające rozpoznanie tej osoby.",
    "Skup się na cechach istotnych dla identyfikacji.",
    `Szukaj osoby odpowiadającej opisowi: ${targetDescription}`,
    "Jeśli na zdjęciu nie ma takiej osoby, napisz: 'Brak osoby spełniającej kryteria.'",
  ].join("\n");
  const openai = new OpenAIServiceWrapper();
  console.log(`[describePersonOnPhoto] Analizuję zdjęcie: ${imageUrl}`);
  const result = await openai.analyzeImageByUrl(imageUrl, systemPrompt);
  console.log(`[describePersonOnPhoto] Wynik opisu: ${result}`);
  return result;
}

/**
 * Wysyła końcową odpowiedź tekstową (np. rysopis Barbary) do centrali.
 * @param answer Tekstowa odpowiedź do wysłania (np. rysopis)
 * @returns Odpowiedź z API
 */
export async function sendFinalReport(answer: string): Promise<any> {
  console.log(`[sendFinalReport] Wysyłam rysopis do centrali:\n${answer}`);
  return await CentralaService.sendAnswer("photos", answer);
}

/**
 * Łączy opisy osoby z wielu zdjęć, ignorując opisy, które znacząco odbiegają od targetDescription lub od siebie nawzajem.
 * @param photoDescriptions Tablica obiektów: { filename: string, description: string }
 * @param targetDescription Opis osoby, której szukamy
 * @returns Połączony opis osoby na podstawie spójnych opisów
 */
export async function mergeConsistentPersonDescriptions(
  photoDescriptions: { filename: string; description: string }[],
  targetDescription: string
): Promise<string> {
  const systemPrompt = [
    "Jesteś ekspertem od analizy opisów osób na zdjęciach.",
    "Otrzymasz kilka opisów osób z różnych zdjęć oraz docelowy opis osoby, której szukamy.",
    "Twoim zadaniem jest porównać opisy i wybrać tylko te, które opisują tę samą osobę co <targetDescription>.",
    "Jeśli któryś opis znacząco odbiega od reszty lub od <targetDescription>, zignoruj go.",
    "Na podstawie wybranych, spójnych opisów, stwórz jeden, połączony, szczegółowy rysopis tej osoby w języku polskim.",
    "Nie wspominaj o odrzuconych opisach ani o liczbie zdjęć.",
  ].join("\n");

  const userPrompt = [
    `<TargetDescription>${targetDescription}</TargetDescription>`,
    "<OpisyZdjęć>",
    ...photoDescriptions.map(
      (desc) =>
        `<OpisZdjęcia><Nazwa>${desc.filename}</Nazwa><Opis>${desc.description}</Opis></OpisZdjęcia>`
    ),
    "</OpisyZdjęć>",
    "Zwróć tylko jeden, połączony rysopis osoby.",
  ].join("\n");

  const openai = new OpenAIServiceWrapper();
  console.log(
    `[mergeConsistentPersonDescriptions] Łączenie opisów:\n${JSON.stringify(photoDescriptions, null, 2)}`
  );
  const result = await openai.completionContent([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  console.log(`[mergeConsistentPersonDescriptions] Wynik rysopisu:\n${result}`);
  return result.trim();
}

export async function solvePhotosTask(targetDescription: string) {
  console.log(
    `[solvePhotosTask] Start zadania z targetDescription: ${targetDescription}`
  );
  const startResponse = await sendStartCommand();

  const { filenames, baseUrl } =
    await extractPhotoUrlsFromStartResponse(startResponse);

  console.log(
    `[solvePhotosTask] Otrzymane pliki: ${JSON.stringify(filenames)}, baseUrl: ${baseUrl}`
  );

  const improvedPhotos: { filename: string; url: string }[] = [];
  for (const filename of filenames) {
    const url = baseUrl ? baseUrl + filename : filename;
    console.log(`[solvePhotosTask] Poprawiam zdjęcie: ${filename} (${url})`);
    const improvedFilename = await improvePhotoUntilOk(baseUrl!, filename);
    if (improvedFilename) {
      const improvedUrl = baseUrl
        ? baseUrl + improvedFilename
        : improvedFilename;
      improvedPhotos.push({ filename: improvedFilename, url: improvedUrl });
      console.log(
        `[solvePhotosTask] Poprawione zdjęcie: ${improvedFilename} (${improvedUrl})`
      );
    } else {
      console.log(
        `[solvePhotosTask] Nie udało się poprawić zdjęcia: ${filename}`
      );
    }
  }

 const photoDescriptions: { filename: string; description: string }[] = [];
//  const improvedPhotos = JSON.parse('[{"filename": "IMG_559_NRR7.PNG", "url": "https://centrala.ag3nts.org/dane/barbara/IMG_559_NRR7.PNG"}, {"filename": "IMG_1410_FXER.PNG", "url": "https://centrala.ag3nts.org/dane/barbara/IMG_1410_FXER.PNG"}, {"filename": "IMG_1443_FT12.PNG", "url": "https://centrala.ag3nts.org/dane/barbara/IMG_1443_FT12.PNG"}, {"filename": "IMG_1444.PNG", "url": "https://centrala.ag3nts.org/dane/barbara/IMG_1444.PNG"}]');
  for (const photo of improvedPhotos) {
    console.log(
      `[solvePhotosTask] Generuję opis osoby na zdjęciu: ${photo.filename}`
    );
    await delay(2000);
    const description = await describePersonOnPhoto(
      photo.url,
      targetDescription
    );
    if (
      description &&
      !description
        .trim()
        .toLowerCase()
        .startsWith("brak osoby spełniającej kryteria")
    ) {
      photoDescriptions.push({ filename: photo.filename, description });
      console.log(`[solvePhotosTask] Dodano opis dla ${photo.filename}`);
    } else {
      console.log(
        `[solvePhotosTask] Pominięto zdjęcie ${photo.filename} (brak osoby spełniającej kryteria)`
      );
    }
  }

  const finalDescription = await mergeConsistentPersonDescriptions(
    photoDescriptions,
    targetDescription
  );

  const reportResponse = await sendFinalReport(finalDescription);

  console.log(`[solvePhotosTask] Zakończono zadanie. Raport wysłany.`);
  return {
    improvedPhotos,
    photoDescriptions,
    finalDescription,
    reportResponse,
  };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

await solvePhotosTask("Na zdjęciu znajduje się kobieta");