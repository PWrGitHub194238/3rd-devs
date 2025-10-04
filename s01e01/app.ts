/**
 * Main application entry point
 */

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function main() {
    const loginPageUrl = 'https://xyz.ag3nts.org/';
    const login = 'tester';
    const password = '574e112a';
    try {
        var loginPageContent = await getLoginPageContent(loginPageUrl);
        var loginPageQuestion = await getLoginPageQuestion(loginPageContent);
        var loginPageAnswer = await getLoginPageAnswer(loginPageQuestion);
        var loginResult = await getLoginResult(login, password, loginPageAnswer);
        console.log(loginResult);
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

async function getLoginPageContent(loginPageUrl: string): Promise<string> {
    try {
        const response = await fetch(loginPageUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const content = await response.text();
        return content;
    } catch (error) {
        console.error('Failed to fetch login page:', error);
        throw error;
    }
}

async function getLoginPageQuestion(loginPageContent: string): Promise<string> {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that extracts login questions from the provided page content in the HTML format. Extract only the question that needs to be answered to prove that whoever is trying to login is a robot, nothing else."
                },
                {
                    role: "user",
                    content: `Extract the login question from this page content: ${loginPageContent}`
                }
            ],
            temperature: 0.3,
            max_tokens: 150
        });

        const question = completion.choices[0]?.message?.content;
        if (!question) {
            throw new Error('No question was extracted from the page content');
        }

        return question.trim();
    } catch (error) {
        console.error('Failed to extract login question:', error);
        throw error;
    }
}

async function getLoginPageAnswer(loginPageQuestion: string): Promise<string> {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that answers questions. Provide a direct and concise answer to the given question. Reply only with the answer. Never repeat the question. For example if you are asked about a date reply with the date"
                },
                {
                    role: "user",
                    content: `Answer this question: ${loginPageQuestion}`
                }
            ],
            temperature: 0.3,
            max_tokens: 100
        });

        const answer = completion.choices[0]?.message?.content;
        if (!answer) {
            throw new Error('Failed to generate an answer');
        }

        return answer.trim();
    } catch (error) {
        console.error('Failed to generate answer:', error);
        throw error;
    }
}

async function getLoginResult(login: string, password: string, loginPageAnswer: string): Promise<string> {
    try {
        const response = await fetch('https://xyz.ag3nts.org/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                username: login,
                password: password,
                answer: loginPageAnswer
            }).toString()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.text();
        return result;
    } catch (error) {
        console.error('Failed to send login request:', error);
        throw error;
    }
}

// Execute the main function
main().catch(console.error); 