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

      const jsonStruct = await getDataAsync();
      const jsonQuestions = jsonStruct['test-data'];
      let i = 0;

      for (const element of jsonQuestions) {
        const span = trace.span({
            name: `question-#${i++}`,
        });

        if (element.test === undefined)
        {
            span.update({
                input: {
                    ...element,
                    type: 'test'
                }
            });


            const task = element.question.split(' + ');
            const n1 =  Number(task[0]);
            const n2 =  Number(task[1]);

            const a = n1 + n2;

            const resp: ResponseItem = {
                isValid: a == element.answer ? "1" : "0",
                solution: a == element.answer ? String(element.answer) : String(a),
            }

            if (resp.isValid === "0")
            {
                span.update({
                    output: {
                        originalAnswer: element.answer,
                        ...resp
                    }
                });
                element.answer = Number(resp.solution);
            }

            span.end({});
        } else {
            span.update({
                input: {
                    ...element,
                    type: 'open question'
                }
            });

            const messages: Array<ChatCompletionMessageParam> = [
                {
                    role: 'system',
                    content: 'You are a asistant who is replying to questions. 1st user prompt is a question. 2nd is an answer. Reply in the following format: { "isValid": "1 - the users solution is valid, 0 - otheriwse", "solution": "repeat the answer from the user or provde your own valid answer" }. Reply only in the given format.'
                },
                {
                    role: 'user',
                    content: element.test.q,
                },
                {
                    role: 'user',
                    content: element.test.a,
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
            
            const resp: ResponseItem = JSON.parse(response.resp);

            if (resp.isValid === "0")
            {
                span.update({
                    output: {
                        originalAnswer: element.answer,
                        ...resp
                    }
                });
                element.test.a = resp.solution;
            }

            span.end({});
        }

        jsonStruct.apikey = process.env.API_KEY as string;
    }

    console.log('--------------------------');

    console.log(jsonStruct);

    await langfuse.flushAsync();

    const r = await sendDataAsync(jsonStruct);

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

interface ResponseItem
{
    isValid: string,
    solution: string,
}
interface TestDataQuestionItem {
    question: string;
    answer: number;
    test?: TestDataQuestionTestItem | undefined;
}

interface TestDataQuestionTestItem {
    q: string;
    a: string;
}

interface DataResponse {
    apikey: string;
    description: string;
    copyright: string;
    "test-data": TestDataQuestionItem[];
}

async function getDataAsync(): Promise<DataResponse> {
    try {
        const response = await fetch(`https://c3ntrala.ag3nts.org/data/${process.env.API_KEY}/json.txt`);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data as DataResponse;
    } catch (error) {
        console.error('Failed to fetch data:', error);
        throw error;
    }
}

async function sendDataAsync(content: DataResponse): Promise<string> {
    try {
        const body = `{ "task": "JSON", "apikey": "${process.env.API_KEY}", "answer": ${JSON.stringify(content)} }`;

        // const body = '{"task": "JSON","apikey": "%PUT-YOUR-API-KEY-HERE%","answer": {"apikey": "%PUT-YOUR-API-KEY-HERE%","description": "This is simple calibration data used for testing purposes. Do not use it in production environment!","copyright": "Copyright (C) 2238 by BanAN Technologies Inc.", "test-data": [{ "question": "45 + 86","answer": 131}, {"question": "97 + 34","answer": 131},{"question": "97 + 6","answer": 103,"test": {"q": "name of the 2020 USA president","a": "???"}}]}}';
        writeFileSync(join(__dirname, 'output.json'), body, {
            flag: 'w',
          });
        const response = await fetch('https://c3ntrala.ag3nts.org/report', {
            method: 'POST',
            body: body,
            headers: { 'accept': 'application/json', 'Content-Type': 'application/json'} });
        
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
