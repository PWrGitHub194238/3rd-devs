import type { ChatCompletionMessageParam } from "openai/resources/index.mjs";
import { CentralaService } from "./CentralaService";
import * as fs from "fs";
import * as path from "path";
import { OpenAIServiceWrapper } from "./OpenAIServiceWrapper";


const openAIWrapper = new OpenAIServiceWrapper();

const cacheDir = path.join(__dirname, "cache");
const validQueriesFile = path.join(cacheDir, "valid-queries.json");
const invalidQueriesFile = path.join(cacheDir, "invalid-queries.json");

const validQueries: Record<string, string> = {};
const invalidQueries: Record<string, string> = {};

// Function to validate if a SQL query is valid for MySQL
async function isValidSQLQuery(sqlQuery: string): Promise<boolean> {
  const validationMessages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are a SQL expert. Your task is to validate whether the provided SQL query is valid for a MySQL database. If it is valid, respond with 'Yes'. If it is not valid, explain why.",
    },
    {
      role: "user",
      content: `SQL Query:\n${sqlQuery}`,
    },
  ];

  const validationResponse =
    await openAIWrapper.completionContent(validationMessages);
  console.log("Validation response:", validationResponse);

  const response = validationResponse.toLowerCase().includes("yes");
  if (response) {
    console.log("The SQL query is valid for MySQL.");
  } else {
    console.log(
      `The SQL query is not valid for MySQL. Reason: ${validationResponse}`
    );
  }

  return response;
}

async function executeAndStoreSQLQuery(
  sqlQuery: string
): Promise<boolean> {
  const sqlQueryResults = await CentralaService.send(
    "https://c3ntrala.ag3nts.org/apidb",
    "database",
    { query: sqlQuery },
  );

  if (sqlQueryResults?.error == "OK") {
    validQueries[sqlQuery] = JSON.stringify(sqlQueryResults.reply!);
    // Save the updated queries to the cache file
    fs.writeFileSync(validQueriesFile, JSON.stringify(validQueries, null, 2));
    return true;
  }

  if (sqlQueryResults?.error && sqlQueryResults?.error !== "OK") {
    // Save the updated queries to the cache file
    invalidQueries[sqlQuery] = sqlQueryResults.error;
    fs.writeFileSync(invalidQueriesFile, JSON.stringify(invalidQueries, null, 2));
    return false;
  }

  invalidQueries[sqlQuery] = 'uknown error';
  fs.writeFileSync(invalidQueriesFile, JSON.stringify(invalidQueries, null, 2));
  return false;
}

async function generateFinalSQLOrQuestion(
  queries: Record<string, string>
): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "Your goal is to determine if you can generate a SQL query for a MySQL database that will return the DC_IDs of active datacenters whose managers (from the users table) are inactive." +
        "Wait for the user to provide you a context of any previous attempts that contains an SQL query and its result. Use them to help you construct the needed query." +
        "If you believe you can generate such a query, provide it, starting with a 'select'. Make sure this is a valid SQL query. " +
        "If you need more information, replay ONLY with a SINGLE question to which a SQL query should be constructed to prvide an answer." +
        "Keep in mind that only the knowledge of prevoius attempts might be used to construct such a querry.",
    },
    {
      role: "user",
      content: `<previous-attempts>${Object.entries(queries)
        .map(
          ([key, value], index) =>
            `\t<attempt_${index}>\n\t\t<query>${key}</query>\n\t\t<result>${value}</result>\n</attempt_${index}>`
        )
        .join("\n")}</previous-attempts>`
    },
  ];

  return await openAIWrapper.completionContent(messages);
}

async function generateFollowUpSqlQuery(
  question: string
): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        `Your goal is to generate a query for a MySQL database ` +
        `that will return an answer for the given question: ${question}. ` +
        "Do not assume anything. You can only rely on the prevoius queries and their results if any were provided by the user in <previous-attempts>. " +
        "Reply ONLY with a SQL query. Reply ONLY with a SINGLE query. Return a RAW SQL, do not wrap it inside markdown. " +
        "Do not attach any other statement. DO NOT return multiple queries." +
        "Inside <invalid-queries> you will find all the queries that were invalid for the same question.",
    },
    {
      role: "user",
      content: `<previous-attempts>${Object.entries(validQueries)
        .map(
          ([key, value], index) =>
            `\t<attempt_${index}>\n\t\t<query>${key}</query>\n\t\t<result>${value}</result>\n</attempt_${index}>`
        )
        .join("\n")}</previous-attempts>`
    },
    {
      role: "user",
      content: `<invalid-queries>${Object.entries(invalidQueries)
        .map(
          ([key, value], index) =>
            `\t<invalid-query_${index}>\n\t\t<query>${key}</query>\n\t\t<result>${value}</result>\n</invalid-query_${index}>`
        )
        .join("\n")}</invalid-queries>`
    },
  ];

  return await openAIWrapper.completionContent(messages);
}

async function generateSQLForActiveDatacenters() {
  // Ensure cache directory exists
  fs.mkdirSync(cacheDir, { recursive: true });

  // Load existing queries from the queries file
  const validQueriesFromFile: Record<string, string> = fs.existsSync(validQueriesFile)
    ? JSON.parse(fs.readFileSync(validQueriesFile, "utf8"))
    : {};

  for (const queryFromFile of Object.entries(validQueriesFromFile))
  {
    validQueries[queryFromFile[0]] = queryFromFile[1];
  }

    const invalidQueriesFromFile: Record<string, string> = fs.existsSync(invalidQueriesFile)
    ? JSON.parse(fs.readFileSync(invalidQueriesFile, "utf8"))
    : {};

  for (const queryFromFile of Object.entries(invalidQueriesFromFile))
  {
    invalidQueries[queryFromFile[0]] = queryFromFile[1];
  }

  let isQueryComplete = false;
  let i = 0;

  while (!isQueryComplete) {
    i += 1;
    console.log(`Iteration ${i}: Starting new query generation cycle...`);

    const sqlOrQuestion = await generateFinalSQLOrQuestion(validQueries);

    console.log("OpenAI response:", sqlOrQuestion);

    if (sqlOrQuestion.toLowerCase().includes("select")) {
      const sqlQuery = sqlOrQuestion.trim();
      console.log("Query generated:", sqlQuery);

      // Validate the SQL query
      const isValid = await isValidSQLQuery(sqlQuery);

      if (isValid) {
        console.log("The SQL query is valid for MySQL.");
        await executeAndStoreSQLQuery(sqlQuery);
        isQueryComplete = true; // Mark the query as complete
      } else {
        console.log("The SQL query is not valid.");
        return;
      }
    } else if (sqlOrQuestion) {
      let hasBeenExecuted = false;

      do {
        console.log("No valid SQL query generated, need more context.");
        const followupSqlQueryResult = await generateFollowUpSqlQuery(
          sqlOrQuestion
        );

        console.log("Follow-up question response:", followupSqlQueryResult);

        
        const splitedQueries = followupSqlQueryResult.split(';');

        for (const splitedQuery of splitedQueries) {
          var trimedQuery = splitedQuery.trim();
          console.log("Validating query:", trimedQuery);

          // Validate the SQL query
          const isValid = await isValidSQLQuery(trimedQuery);

          if (isValid) {
            console.log("The SQL query is valid for MySQL.");
            hasBeenExecuted = hasBeenExecuted || await executeAndStoreSQLQuery(trimedQuery);
          } else {
            console.log("The SQL query is not valid.");
            invalidQueries[trimedQuery] = "this is not a valid SQL query";
          }

          if (!hasBeenExecuted) {
            break;
          }
        }
      } while (!hasBeenExecuted);
    }
  }
}

// Execute the function
await generateSQLForActiveDatacenters();
