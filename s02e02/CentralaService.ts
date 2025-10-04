import fetch from "node-fetch";

export class CentralaService {
  static async sendStreetReport(streetName: string) {
    const url = "https://c3ntrala.ag3nts.org/report";
    const body = {
      task: "mp3",
      apikey: process.env.PERSONAL_API_KEY || "API-KEY", // Replace with your actual API key or set as env var
      answer: streetName,
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
}
