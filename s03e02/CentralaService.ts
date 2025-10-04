import fetch from "node-fetch";

export class CentralaService {
  static async send(task: string, answer: string): Promise<string | null> {
    const url = "https://c3ntrala.ag3nts.org/report";
    const body = {
      task,
      apikey: process.env.PERSONAL_API_KEY || "API-KEY", // Replace with your actual API key or set as env var
      answer,
    };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      console.log("Report response:", result);
      return result;
    } catch (err) {
      console.error("Error sending report:", err);
      return null;
    }
  }

  static async fetch(urlWithPlaceholder: string): Promise<string> {
    const apiKey = process.env.PERSONAL_API_KEY || "KLUCZ-API";
    const url = urlWithPlaceholder.replace("KLUCZ-API", apiKey);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return typeof data.description === "string" ? data.description : "";
    } catch (err) {
      console.error("Error fetching robot description:", err);
      return "";
    }
  }
}
