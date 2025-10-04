import { CentralaService } from "./CentralaService";
import * as fs from "fs/promises";
import { OpenAIServiceWrapper } from "./OpenAIServiceWrapper";
import type { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import path from "path";

// Get people data by query (name)
export async function getPeopleByQuery(query: string): Promise<any> {
  const url = "https://c3ntrala.ag3nts.org/people";
  const request = { query };
  return await CentralaService.sendRaw(url, request);
}

// Get places data by query (city)
export async function getPlacesByQuery(query: string): Promise<any> {
  const url = "https://c3ntrala.ag3nts.org/places";
  const request = { query };
  return await CentralaService.sendRaw(url, request);
}

export async function readBarbaraFile(): Promise<string> {
  try {
    const data = await fs.readFile(path.join(__dirname,"barbara.txt"), "utf-8");
    return data;
  } catch (err) {
    console.error("Error reading barbara.txt:", err);
    return "";
  }
}

const openai = new OpenAIServiceWrapper();

async function extractNamesAndCities(note: string): Promise<{
  names: Set<string>;
  cities: Set<string>;
}> {
  // Użyj OpenAIServiceWrapper do wyciągnięcia imion i miast
  const prompt: string =
    "Wypisz osobno wszystkie imiona osób oraz osobno wszystkie nazwy miast, które pojawiają się w poniższej notatce." +
    "Zwróć wynik w formacie JSON:" +
    '{"names":["IMIE1","IMIE2"],"cities":["MIASTO1","MIASTO2"]}';
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: prompt },
    { role: "user", content: note },
  ]; // ChatCompletionMessageParam[]
  const response = await openai.completionContent(messages, undefined, 'gpt-4o-mini', 'json_object');
  try {
    const parsed = JSON.parse(response);
    return {
      names: new Set(parsed.names || []),
      cities: new Set(parsed.cities || []),
    };
  } catch {
    // fallback: pusta lista jeśli nie uda się sparsować
    return { names: new Set(), cities: new Set() };
  }
}

async function normalizeName(name: string): Promise<string> {
  const prompt = [
    "Znormalizuj podane imię i nazwisko do mianownika.",
    "Wypisz imię zamieniając polskie znaki na ich wersję 'bez ognoka' (polskie znaki to: ŻŹĆŃĄŚŁĘÓ).",
    "Uwzględnij możliwość literówek w danych wejściowych.",
    "Jako odpowidź zwróć TYLKO imię (pierwszy człon bez białych znaków). Wypisz je dużymi literami.",
    name,
  ].join("\n");
  const messages: ChatCompletionMessageParam[] = [
    { role: "user", content: prompt },
  ];
  const response = await openai.completionContent(messages);
  return response.trim();
}

async function normalizeCity(city: string): Promise<string> {
  const prompt = [
    "Znormalizuj podaną nazwę miasta do mianownika, wielkimi literami, bez polskich znaków.",
    "Zwróć tylko nazwę miasta w tej formie.",
    city,
  ].join("\n");
  const messages: ChatCompletionMessageParam[] = [
    { role: "user", content: prompt },
  ];
  const response = await openai.completionContent(messages);
  return response.trim();
}

async function askLLMForBarbaraLocation(
  note: string,
  peopleApiResponses: Record<string, string[]>,
  placesApiResponses: Record<string, string[]>,
  foundCities: string[],
  excludedCities: Set<string> = new Set()
): Promise<string> {
  const prompt = [
    "Oto notatka:",
    note,
    "",
    "Oto lista osób wraz z miastami, w których byli (format: {osoba: [miasta]}):",
    JSON.stringify(peopleApiResponses, null, 2),
    "",
    "Oto lista miast wraz z osobami, które w nich widziano (format: {miasto: [osoby]}):",
    JSON.stringify(placesApiResponses, null, 2),
    "",
    "Oto lista miast, w których widziano Barbarę:",
    JSON.stringify(foundCities, null, 2),
    "",
    excludedCities.size > 0
      ? "Nie bierz pod uwagę następujących miast jako aktualnego miejsca pobytu Barbary: " +
        Array.from(excludedCities).join(", ")
      : "",
    "",
    "Na podstawie powyższych danych wskaż, w którym mieście aktualnie przebywa Barbara. Zwróć tylko nazwę miasta wielkimi literami, bez żadnych dodatkowych znaków ani komentarzy.",
  ].join("\n");
  const messages: ChatCompletionMessageParam[] = [
    { role: "user", content: prompt },
  ];
  const response = await openai.completionContent(messages);
  return response.trim();
}

export async function findBarbaraLocation() {
  const note = await readBarbaraFile();
  const { names, cities } = await extractNamesAndCities(note);

  // LLM normalization for names and cities
  const kolejka_osob: Set<string> = new Set();
  for (const name of names) {
    kolejka_osob.add(await normalizeName(name));
  }
  const kolejka_miast: Set<string> = new Set();
  for (const city of cities) {
    kolejka_miast.add(await normalizeCity(city));
  }

  const sprawdzone_osoby: Set<string> = new Set();
  const sprawdzone_miasta: Set<string> = new Set();

  // Record for API responses
  const peopleApiResponses: Record<string, string[]> = {};
  const placesApiResponses: Record<string, string[]> = {};

  // Zbierz znane miejsca Barbary z notatki przy pomocy AI
  const barbaraPrompt = [
    "Wypisz wszystkie miasta, w których według poniższej notatki Barbara była wcześniej.",
    "Zwróć wynik w formacie JSON:",
    '{"cities":["MIASTO1","MIASTO2"]}',
    "Notatka:",
    note,
  ].join("\n");
  const barbaraMessages: ChatCompletionMessageParam[] = [
    { role: "user", content: barbaraPrompt },
  ];
  const barbaraResponse = await openai.completionContent(barbaraMessages, undefined, 'gpt-4o-mini', 'json_object');
  let knownBarbaraCities = new Set<string>();
  try {
    const parsed = JSON.parse(barbaraResponse);
    if (Array.isArray(parsed.cities)) {
      for (const city of parsed.cities) {
        knownBarbaraCities.add(await normalizeCity(city));
      }
    }
  } catch {
    knownBarbaraCities = new Set();
  }

  let foundCities: string[] = [];

  while (kolejka_osob.size > 0 || kolejka_miast.size > 0) {
    // Przetwarzaj osoby
    const osobyDoPrzetworzenia = Array.from(kolejka_osob);
    for (const name of osobyDoPrzetworzenia) {
      if (sprawdzone_osoby.has(name)) continue;
      sprawdzone_osoby.add(name);
      // kolejka_osob.delete(name); // nie usuwaj podczas iteracji po oryginalnym zbiorze
      kolejka_osob.delete(name); // usuwaj po iteracji po kopii

      const peopleData = await getPeopleByQuery(name);
      // Zapisz odpowiedź do peopleApiResponses
      if (peopleData.code === 0 && peopleData.message != '[**RESTRICTED DATA**]') {
        peopleApiResponses[name] = (peopleData.message as string).split(' ');
        for (const place of peopleApiResponses[name]) {
          const cityNorm = await normalizeCity(place);
          if (!sprawdzone_miasta.has(cityNorm)) {
            kolejka_miast.add(cityNorm);
          }
        }
      } else {
        peopleApiResponses[name] = [];
      }
    }

    // Przetwarzaj miasta
    const miastaDoPrzetworzenia = Array.from(kolejka_miast);
    for (const city of miastaDoPrzetworzenia) {
      if (sprawdzone_miasta.has(city)) continue;
      sprawdzone_miasta.add(city);
      // kolejka_miast.delete(city); // nie usuwaj podczas iteracji po oryginalnym zbiorze
      kolejka_miast.delete(city); // usuwaj po iteracji po kopii

      const placesData = await getPlacesByQuery(city);
      // Zapisz odpowiedź do placesApiResponses
      if (placesData.code === 0) {
        if (placesData.message === '[**RESTRICTED DATA**]') {
            if (!knownBarbaraCities.has(city)) {
              foundCities.push(city);
            }
        } else {
          placesApiResponses[city] = (placesData.message as string).split(' ');
          for (const person of placesApiResponses[city]) {
            const personNorm = await normalizeName(person);
            if (!sprawdzone_osoby.has(personNorm)) {
              kolejka_osob.add(personNorm);
            }
            if (personNorm === "BARBARA") {
              if (!knownBarbaraCities.has(city)) {
                foundCities.push(city);
              }
            }
          }
        }
      } else {
        placesApiResponses[city] = [];
      }
      // Sprawdź flagę w innych polach odpowiedzi
      if (placesData && typeof placesData.flag === "string") {
        console.log("Sekretna flaga 🚩:", placesData.flag);
      }
    }
  }

  if (foundCities.length > 0) {
    const excludedCities = new Set<string>();
    let llmAnswer: string | null = null;
    let success = false;
    let attempts = 0;
    const maxAttempts = 5;

    while (!success && attempts < maxAttempts) {
      llmAnswer = await askLLMForBarbaraLocation(
        note,
        peopleApiResponses,
        placesApiResponses,
        foundCities,
        excludedCities
      );
      try {
        const result = await CentralaService.sendAnswer("loop", llmAnswer);
        // Jeśli CentralaService.sendAnswer zwraca błąd, przejdzie do catch
        success = true;
        console.log("Barbara wg LLM jest w:", llmAnswer);
      } catch (err) {
        excludedCities.add(llmAnswer);
        console.warn(
          `Miasto "${llmAnswer}" zostało wykluczone z powodu błędu zgłoszenia. Próbuję ponownie...`
        );
        attempts++;
      }
    }
    if (!success) {
      console.log(
        "Nie udało się zgłosić żadnego miasta jako aktualnego miejsca Barbary."
      );
    }
  } else {
    console.log("Nie znaleziono Barbary w nowych miastach.");
  }

  // Dodatkowo: wypisz zebrane odpowiedzi z API
  console.log("Odpowiedzi z getPeopleByQuery:", peopleApiResponses);
  console.log("Odpowiedzi z getPlacesByQuery:", placesApiResponses);
}


await findBarbaraLocation()