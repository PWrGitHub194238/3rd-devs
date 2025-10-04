import fetch from "node-fetch";

export class CentralaService {
  static async sendRaw(url: string, request: any): Promise<any> {
    const body = {
      apikey: process.env.PERSONAL_API_KEY || "API-KEY", // Replace with your actual API key or set as env var
      ...request,
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
  static async send(url: string, task: string, request: any): Promise<any> {
    const body = {
      task,
      apikey: process.env.PERSONAL_API_KEY || "API-KEY", // Replace with your actual API key or set as env var
      ...request,
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

  static async sendAnswer(task: string, answer: any): Promise<any | null> {
    const url = "https://c3ntrala.ag3nts.org/report";
    const body = {
      task,
      apikey: process.env.PERSONAL_API_KEY || "API-KEY", // Replace with your actual API key or set as env var
      answer: answer,
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

  static async fetch(urlWithPlaceholder: string): Promise<any> {
    const apiKey = process.env.PERSONAL_API_KEY || "KLUCZ-API";
    const url = urlWithPlaceholder.replace("KLUCZ-API", apiKey).replace("TUTAJ-KLUCZ", apiKey);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (err) {
      console.error("Error fetching data:", err);
      return "";
    }
  }
}
