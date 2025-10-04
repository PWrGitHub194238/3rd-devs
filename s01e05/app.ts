/**
 * Main application entry point
 */

import type { ChatCompletionMessageParam } from 'ai/prompts';
import { OpenAI } from 'openai';
import { Langfuse } from "langfuse";
import dotenv from 'dotenv';
import type { ChatCompletion } from 'openai/resources/chat/completions.mjs';
import { string } from 'zod';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Langfuse client
const langfuse = new Langfuse({
    publicKey: process.env.LANGFUSE_PUBLIC_KEY,
    secretKey: process.env.LANGFUSE_SECRET_KEY,
    baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
});


async function main() {
    const trace = langfuse.trace({
        name: "my-AI-application-endpoint",
    });

    trace.client.debug();

    langfuse.on("error", (error: Error) => {
        console.error("Langfuse error:", error);
      });

    const message = await getDataAsync<string>('https://c3ntrala.ag3nts.org/data/KLUCZ/cenzura.txt', 'text');
      
    const span = trace.span({
        name: `Anonym`,
        input: message,
    });

    const messages: Array<ChatCompletionMessageParam> = [
        {
            role: 'system',
            content: 'You are a data animiser. You need to identify every potential personal data and replace it with a word CENZURA. Keep in mind that addresses can be comprosed from multiple part like house number or apartement. Same goes for person`s name and surename. Treat them as one information.'
        },
        {
            role: 'user',
            content: message,
        },
    ]

    const response = await completion(messages);

    const generation = span.generation({
        name: 'generation',
        input: messages,
      });


    generation.end({
        output: {
            ...response.completion
        },
    });
    span.end();
    // try {
    //     await langfuse.flushAsync();
    // } catch (error) {
    //     console.error('Failed to extract login question:', error);
    //     throw error;
    // }

    const r = await sendDataAsync('https://c3ntrala.ag3nts.org/report ', 'CENZURA', 'text', () => response.resp);

    console.log(r);
}

async function completion(messages: Array<ChatCompletionMessageParam>): Promise<{ completion: ChatCompletion, resp: string }> {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages,
            temperature: 0.3,
            max_tokens: 150
        });

        const question = completion.choices[0]?.message?.content;
        if (!question) {
            throw new Error('No question was extracted from the page content');
        }

        return { completion, resp: question.trim() };
    } catch (error) {
        console.error('Failed to extract login question:', error);
        throw error;
    }
}

// Execute the main function
main().catch(console.error); 


async function getDataAsync<T>(url: string, format: string = 'json'): Promise<T> {
    try {
        const response = await fetch(url.replace('KLUCZ', process.env.PERSONAL_API_KEY || ''));
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = format === 'json' ? await response.json() : await response.text();
        return data as T;
    } catch (error) {
        console.error('Failed to fetch data:', error);
        throw error;
    }
}

async function sendDataAsync(url: string, task: string, format: string = 'json', bodyFun: (apiKey: string) => string): Promise<string> {
    try {
        const answer = bodyFun(process.env.PERSONAL_API_KEY || '');
        const wrappedAnswer = format === 'json' ? JSON.parse(answer) : `"${answer}"`;
        const body = JSON.stringify(JSON.parse(`{"task": "${task}","apikey": "${process.env.PERSONAL_API_KEY }","answer": ${wrappedAnswer} }`));


        const response = await fetch(url.replace('KLUCZ', process.env.PERSONAL_API_KEY || ''), {
            method: 'POST',
            body: body,
            headers: { 'accept': 'application/json', 'Content-Type': 'application/json',  'charset': 'utf-8' } });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to fetch data:', error);
        throw error;
    }
}
