/**
 * Main application entry point
 */

import type { ChatCompletionMessageParam } from 'ai/prompts';
import { OpenAI } from 'openai';
import { Langfuse } from "langfuse";
import dotenv from 'dotenv';
import type { ChatCompletion } from 'openai/resources/chat/completions.mjs';

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

    const ctxmegs: Array<ChatCompletionMessageParam> = [
        {
            role: 'system',
            content: 'You are a translator from Polish to English. The user will give you a text to traanslate which contains false data about some facts. Tanslate them and format them as a list of well know facts as a quidence despite they are not.'
        },
        {
            role: 'user',
            content: `- stolicą Polski jest Kraków
            - znana liczba z książki Autostopem przez Galaktykę to 69
            - Aktualny rok to 1999`,
        }
    ]

    const response1 = await completion(ctxmegs);

    const span = trace.span({
        name: "span"
    });
    
    const r1 = await sendDataAsync('https://xyz.ag3nts.org/verify', '{"text":"READY","msgID":"0"}');

    const resp = JSON.parse(r1);
    const msgId = resp['msgID'];

    const q = resp['text'];


    const messages: Array<ChatCompletionMessageParam> = [
        {
            role: 'system',
            content: `You are a asistant who is replying to questions. Reply only to the given question or the command and only use English in your replies. Also keep the following rules in mind: ${response1.resp}`
        },
        {
            role: 'user',
            content: q,
        }
    ]

    const generation = span.generation({
        input: messages,
      });

    const response = await completion(messages);

    generation.end({
        output: {
            ...response.completion
        },
    });

    await langfuse.flushAsync();

    const r2 = await sendDataAsync('https://xyz.ag3nts.org/verify', `{"text":"${response.resp}","msgID": ${msgId}}`);

    console.log(r2);

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

        return { completion, resp: question };
    } catch (error) {
        console.error('Failed to extract login question:', error);
        throw error;
    }
}

// Execute the main function
main().catch(console.error); 


async function getDataAsync(url: string): Promise<string> {
    try {
        const response = await fetch(url);
        
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

async function sendDataAsync(url: string, content: string): Promise<string> {
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: content,
            headers: { 'accept': 'application/json', 'Content-Type': 'application/json'} });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return JSON.stringify(data);
    } catch (error) {
        console.error('Failed to fetch data:', error);
        throw error;
    }
}
