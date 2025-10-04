// Matrix representation of the provided data
export const matrix: number[][] = [
  [0, 1, 2, 3],
  [1, 4, 1, 1],
  [1, 1, 5, 6],
  [7, 7, 8, 9],
];

export const tileTypes = [
{ name: "start position", description: "pozycja startowa" }, // 0
{ name: "empty field", description: "puste pole" }, // 1
{ name: "trees_1", description: "pojedyncze drzewo" }, // 2
{ name: "house", description: "pojedynczy dom" }, // 3
{ name: "mill", description: "pojedynczy młyn" }, // 4
{ name: "rocks_1", description: "kilka skał" }, // 5
{ name: "trees_2", description: "dwa drzewa" }, // 6
{ name: "mountains", description: "góry" }, // 7
{ name: "car", description: "pojedynczy samochód" }, // 8
{ name: "cave", description: "wejście jaskini" }, // 9
];

import { serve } from "bun";
import { OpenAIServiceWrapper } from "../s04e01/OpenAIServiceWrapper";

const server = serve({
  port: process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 3000,
  async fetch(req) {
    const url = new URL(req.url);
    console.log(`[SERVER] ${req.method} ${url.pathname}`);
    if (req.method === "POST" && url.pathname === "/fly") {
      try {
        const body: any = await req.json();
        console.log(`[FLY] Received body:`, body);
        const instruction = body?.instruction;
        if (typeof instruction !== "string") {
          console.log(`[FLY] Invalid instruction:`, instruction);
          return new Response(
            JSON.stringify({ error: "Invalid instruction" }),
            { status: 400 }
          );
        }
        const coords = await getDroneCoordinatesFromDescription(instruction);
        console.log(`[FLY] Calculated coordinates:`, coords);
        const description = getTileDescriptionFromCoords(coords);
        console.log(`[FLY] Tile description:`, description);
        console.log(`[FLY]Respponse:`, JSON.stringify({ description }));
        return new Response(JSON.stringify({ description }), { status: 200 });
      } catch (e) {
        console.log(`[FLY] Error:`, e);
        return new Response(JSON.stringify({ error: "Invalid request" }), {
          status: 400,
        });
      }
    }
    console.log(`[SERVER] Not Found: ${req.method} ${url.pathname}`);
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Listening on http://localhost:${server.port}`);

/**
 * Uses OpenAIServiceWrapper to get coordinates from a drone movement description.
 * The model should return an object: { "_thoughts": "...", coordinates: [x, y] }
 * (zero-based, top-left is [0,0], bottom-right is [3,3]).
 * @param movementDescription Description of drone movements
 * @param modelName (optional) Model name to use
 * @returns Promise<[number, number]> Coordinates after movements
 */
export async function getDroneCoordinatesFromDescription(
  movementDescription: string,
  modelName: string = "gpt-4o"
): Promise<[number, number]> {
  console.log(
    `[getDroneCoordinatesFromDescription] movementDescription:`,
    movementDescription
  );
  const systemPrompt = [
    "Jesteś asystentem analizującym ruch drona na mapie 4x4.",
    "Dron zawsze startuje z pozycji [0,0] (lewy górny róg).",
    "Pozycje są w formacie [x, y], gdzie x to kolumna (0-3), y to wiersz (0-3).",
    "Najpierw napisz krok po kroku swoje rozumowanie (myślenie na głos) i zapisz je do pola '_thoughts' w obiekcie JSON.",
    'W tym samym obiekcie JSON zwróć końcowe współrzędne w polu \'coordinates\', np. {"_thoughts": "...", "coordinates": [2,3]}',
    "Nie dodawaj żadnych komentarzy ani tekstu poza tym obiektem JSON.",
  ].join("\n");
  const userPrompt = `Opis ruchów drona: ${movementDescription}`;
  const openai = new OpenAIServiceWrapper();
  console.log(
    `[getDroneCoordinatesFromDescription] Sending prompt to OpenAIServiceWrapper`
  );
  const result = await openai.completionContent(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    undefined,
    modelName,
    "json_object"
  );
  console.log(`[getDroneCoordinatesFromDescription] Model response:`, result);
  try {
    const obj = JSON.parse(result.trim());
    console.log(`[getDroneCoordinatesFromDescription] Parsed object:`, obj);
    if (
      obj &&
      Array.isArray(obj.coordinates) &&
      obj.coordinates.length === 2 &&
      obj.coordinates.every((v: any) => typeof v === "number")
    ) {
      return obj.coordinates as [number, number];
    }
  } catch (err) {
    console.log(`[getDroneCoordinatesFromDescription] JSON parse error:`, err);
  }
  throw new Error("Could not parse coordinates from model response: " + result);
}

/**
 * Zwraca opis pola na podstawie koordynatów [x, y] (zero-based).
 * @param coords [x, y] - współrzędne na macierzy
 * @returns opis pola (string)
 */
export function getTileDescriptionFromCoords(coords: [number, number]): string {
  console.log(`[getTileDescriptionFromCoords] Input coords:`, coords);
  const [x, y] = coords;
  if (y < 0 || y >= matrix.length || x < 0 || x >= matrix[0]!.length) {
    console.log(
      `[getTileDescriptionFromCoords] Out of bounds for coords:`,
      coords
    );
    return "out of bounds";
  }
  const tileIndex = matrix[y]![x]!;
  const tile = tileTypes[tileIndex];
  console.log(
    `[getTileDescriptionFromCoords] tileIndex: ${tileIndex}, tile:`,
    tile
  );
  return tile ? tile.description : "unknown";
}
