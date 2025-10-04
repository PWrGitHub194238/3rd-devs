import { CentralaService } from "./CentralaService";
import * as fs from "fs";
import * as path from "path";
import { Neo4jService } from "./Neo4jService";
import { OpenAIService } from "./OpenAIService";

const openAIService = new OpenAIService();
const neo4jService = new Neo4jService(
  process.env.NEO4J_URI!,
  process.env.NEO4J_USER!,
  process.env.NEO4J_PASSWORD!,
  openAIService
);

async function executeSQLQuery(sqlQuery: string): Promise<any> {
  const sqlQueryResults = await CentralaService.send(
    "https://c3ntrala.ag3nts.org/apidb",
    "database",
    { query: sqlQuery }
  );

  return sqlQueryResults;
}

async function executeGetUsersSQLQuery(): Promise<any> {
  const query = "SELECT id, username AS name FROM users";

  return await executeSQLQuery(query);
}

async function executeGetConnectionsSQLQuery(): Promise<any> {
  const query = "SELECT * FROM connections";

  return await executeSQLQuery(query);
}

async function storeSqlResult(result: any, path: string): Promise<void> {
  fs.writeFileSync(path, JSON.stringify(result, null, 2));
}

async function readUsersSqlResult(
  path: string
): Promise<Array<{ user_id: string; user_name: string }>> {
  const data = fs.readFileSync(path, "utf-8");
  const jsonData = JSON.parse(data);
  if (Array.isArray(jsonData.reply)) {
    return jsonData.reply.map((item: any) => ({
      user_id: item.id,
      user_name: item.name,
    }));
  }
  return [];
}

async function readConnectionsSqlResult(
  path: string
): Promise<Array<{ user1_id: string; user2_id: string }>> {
  const data = fs.readFileSync(path, "utf-8");
  const jsonData = JSON.parse(data);
  if (Array.isArray(jsonData.reply)) {
    return jsonData.reply.map((item: any) => ({
      user1_id: item.user1_id,
      user2_id: item.user2_id,
    }));
  }
  return [];
}

async function createUserNodesFromSql(path: string) {
  const users = await readUsersSqlResult(path);

  // Create vector index for users if not exists
  await neo4jService.createVectorIndex("user_index", "User", "embedding", 3072);
  await neo4jService.waitForIndexToBeOnline("user_index");

  await neo4jService.deleteNodes("User");

  for (const user of users) {
    const existingNode = await neo4jService.findNodeByProperty(
      "User",
      "id",
      user.user_id
    );

    if (existingNode) {
      console.log(`User node for a user with ID: ${user.user_id} alrady exists.`)
      continue;
    }

    const embedding = await openAIService.createEmbedding(user.user_name);
    await neo4jService.addNode("User", {
      id: user.user_id,
      name: user.user_name,
      embedding,
    });
  }
}

async function createConnectionsFromSql(path: string) {
  const connections = await readConnectionsSqlResult(path);

  const relationName = "CONNECTED_TO";

  for (const conn of connections) {
    const relationExists = await neo4jService.hasOutgoingRelation(
      conn.user1_id,
      conn.user2_id,
      relationName
    );

    if (relationExists) {
      console.log(`Relation ${relationName} between: ${conn.user1_id} and ${conn.user2_id} alrady exists.`)
      continue;
    }

    // Find both user nodes by id
    const user1 = await neo4jService.findNodeByProperty(
      "User",
      "id",
      conn.user1_id
    );

    const user2 = await neo4jService.findNodeByProperty(
      "User",
      "id",
      conn.user2_id
    );
    if (user1 && user2) {
      await neo4jService.connectNodes(user1.id, user2.id, "CONNECTED_TO");
    }
  }
}

async function findShortestPathNamesBetweenUsers(
  userIdA: string,
  userIdB: string
): Promise<string[]> {
  const cypher = `
    MATCH (start:User {id: $userIdA}), (end:User {id: $userIdB})
    MATCH path = shortestPath((start)-[:CONNECTED_TO*]-(end))
    WITH nodes(path) AS nodelist
    UNWIND nodelist AS n
    RETURN collect(DISTINCT n.name) AS names
  `;
  const params = { userIdA, userIdB };
  const result = await neo4jService.runQuery(cypher, params);

  if (result.records.length > 0) {
    // Return array of user names (including start and end)
    return result.records[0]!.get("names");
  }
  return [];
}

async function findUserNodeByName(userName: string): Promise<string | null> {
  const cypher = `
    MATCH (u:User {name: $userName})
    RETURN u.id AS id
    LIMIT 1
  `;
  const params = { userName };
  const result = await neo4jService.runQuery(cypher, params);

  if (result.records.length > 0) {
    return result.records[0]!.get("id");
  }
  return null;
}

function formatNamesPath(names: string[]): string {
  return names.join(", ");
}

async function sendConnectionsAnswer(answer: string): Promise<void> {
  await CentralaService.sendAnswer("connections", answer);
}

async function init(): Promise<void> {
  const usersPath = path.join(__dirname, "users.json");
  const connectionsPath = path.join(__dirname, "connections.json");

  // 1. Execute and store SQL results only if files do not exist
  if (!fs.existsSync(usersPath)) {
    const usersResult = await executeGetUsersSQLQuery();
    await storeSqlResult(usersResult, usersPath);
  }
  if (!fs.existsSync(connectionsPath)) {
    const connectionsResult = await executeGetConnectionsSQLQuery();
    await storeSqlResult(connectionsResult, connectionsPath);
  }

  // 2. Create user nodes and connections in Neo4j
  await createUserNodesFromSql(usersPath);
  await createConnectionsFromSql(connectionsPath);
}

async function main(userIdA: string, userIdB: string) {
  // 3. Find the shortest path between two users (replace with actual IDs)
  const namesPath = await findShortestPathNamesBetweenUsers(userIdA, userIdB);

  // 4. Format and send the answer
  const answer = formatNamesPath(namesPath);
  await sendConnectionsAnswer(answer);

  console.log("Done! Answer sent:", answer);
}

const userNameA = "Rafał";
const userNameB = "Barbara";

await init();

const userIdA = await findUserNodeByName(userNameA);
const userIdB = await findUserNodeByName(userNameB);

if (!userIdA || !userIdB) {
  console.error(
    `Nie znaleziono użytkownika: ${!userIdA ? userNameA : userNameB}`
  );
  process.exit(1);
}

await main(userIdA, userIdB);
