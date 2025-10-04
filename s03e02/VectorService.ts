import { QdrantClient } from "@qdrant/js-client-rest";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";


const TEXT_EMBEDDING_3_SMALL_DIMMENSION_SIZE = 1536;
const TEXT_EMBEDDING_3_SMALL_METRIC = 'Cosine';



export const TextEmbedding3SmallCosineConfig: EmbeddingVectorConfig = {
  dimmensions: TEXT_EMBEDDING_3_SMALL_DIMMENSION_SIZE,
  metric: TEXT_EMBEDDING_3_SMALL_METRIC
}

export const TextEmbedding3SmallConfigs: Partial<Record<EmbeddingVectorMectric, EmbeddingVectorConfig>> = {
  Cosine: TextEmbedding3SmallCosineConfig
};

export type EmbeddingVectorConfig = {
  dimmensions: number;
  metric: EmbeddingVectorMectric
}

export type EmbeddingVectorMectric = 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan';


export class VectorService {
  private client: QdrantClient;

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
    });
  }

  async ensureCollection(name: string, vectorConfiguration: EmbeddingVectorConfig) {
    const collections = await this.client.getCollections();
    if (!collections.collections.some((c) => c.name === name)) {
      await this.client.createCollection(name, {
        vectors: { size: vectorConfiguration.dimmensions, distance: vectorConfiguration.metric },
      });
    }
  }

  async initializeCollectionWithData(
    name: string,
    createEmbeddingFunc: (text: string) => Promise<number[]>,
    vectorConfiguration: EmbeddingVectorConfig,
    points: Array<{
      id?: string;
      text: string;
      metadata?: Record<string, any>;
    }>
  ) {
    const collections = await this.client.getCollections();
    if (!collections.collections.some((c) => c.name === name)) {
      await this.ensureCollection(name, vectorConfiguration);
      await this.addPoints(name, points, createEmbeddingFunc);
    }
  }

  async addPoints(
    collectionName: string,
    points: Array<{
      id?: string;
      text: string;
      metadata?: Record<string, any>;
    }>,
    createEmbeddingFunc: (text: string) => Promise<number[]>
  ) {
    const pointsToUpsert = await Promise.all(
      points.map(async (point) => {
        const embedding = await createEmbeddingFunc(point.text);

        return {
          id: point.id || uuidv4(),
          vector: embedding,
          payload: {
            text: point.text,
            ...point.metadata,
          },
        };
      })
    );

    const pointsFilePath = path.join(__dirname, "points.json");
    await fs.writeFile(pointsFilePath, JSON.stringify(pointsToUpsert, null, 2));

    await this.client.upsert(collectionName, {
      wait: true,
      points: pointsToUpsert,
    });
  }

  async performSearch(
    collectionName: string,
    query: string,
    limit: number = 5,
    createEmbeddingFunc: (text: string) => Promise<number[]>
  ) {
    const queryEmbedding = await createEmbeddingFunc(query);
    return this.client.search(collectionName, {
      vector: queryEmbedding,
      limit,
      with_payload: true,
    });
  }

  async performSearchWithFilter(
    collectionName: string, 
    query: string,
    createEmbeddingFunc: (text: string) => Promise<number[]>,
    filter: Record<string, any> = {},
    limit: number = 5) {
    const queryEmbedding = await createEmbeddingFunc(query);
    return this.client.search(collectionName, {
      vector: queryEmbedding,
      limit,
      with_payload: true,
      filter
    });
  }
}
