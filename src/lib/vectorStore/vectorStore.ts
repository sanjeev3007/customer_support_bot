import { prisma } from '../prisma';
import { randomUUID } from 'crypto';

export interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  metadata: any;
  score: number;
  rrfScore?: number;
}

/**
 * Inserts a document chunk with its vector embedding and metadata into the database.
 * Uses raw SQL execution because Prisma does not natively serialize Unsupported("vector") types.
 */
export async function addDocumentChunk(
  documentId: string,
  content: string,
  embedding: number[],
  metadata: any
): Promise<string> {
  const id = randomUUID();
  const embeddingString = `[${embedding.join(',')}]`;
  const metadataString = JSON.stringify(metadata);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "document_chunks" ("id", "documentId", "content", "embedding", "metadata", "createdAt")
    VALUES ($1, $2, $3, $4::vector, $5::jsonb, NOW())
  `, id, documentId, content, embeddingString, metadataString);

  return id;
}

/**
 * Performs vector similarity search using pgvector's cosine distance operator.
 * 1 - (embedding <=> query_vector) represents the cosine similarity.
 */
export async function vectorSearch(
  embedding: number[],
  topK: number = 5,
  similarityThreshold: number = 0.5
): Promise<SearchResult[]> {
  const embeddingString = `[${embedding.join(',')}]`;

  const results = await prisma.$queryRawUnsafe<SearchResult[]>(`
    SELECT 
      id, 
      "documentId", 
      content, 
      metadata,
      (1 - (embedding <=> $1::vector))::double precision as score
    FROM "document_chunks"
    WHERE (1 - (embedding <=> $1::vector)) >= $2
    ORDER BY embedding <=> $1::vector ASC
    LIMIT $3
  `, embeddingString, similarityThreshold, topK);

  return results || [];
}

/**
 * Performs full-text keyword search using PostgreSQL English dictionary text search.
 */
export async function keywordSearch(
  query: string,
  topK: number = 5
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  // Pre-process search query: clean up and construct an AND search string
  const cleanTerms = query
    .trim()
    .replace(/[^\w\s]/g, '') // remove special characters
    .split(/\s+/)
    .filter(Boolean)
    .map(term => `${term}:*`) // support prefix matching
    .join(' & ');

  if (!cleanTerms) {
    return [];
  }

  try {
    const results = await prisma.$queryRawUnsafe<SearchResult[]>(`
      SELECT 
        id, 
        "documentId", 
        content, 
        metadata,
        ts_rank(to_tsvector('english', content), to_tsquery('english', $1))::double precision as score
      FROM "document_chunks"
      WHERE to_tsvector('english', content) @@ to_tsquery('english', $1)
      ORDER BY score DESC
      LIMIT $2
    `, cleanTerms, topK);

    return results || [];
  } catch (error) {
    console.error('FTS query failed, falling back to ILIKE search:', error);
    // Fallback: simple case-insensitive substring match
    const results = await prisma.$queryRawUnsafe<SearchResult[]>(`
      SELECT 
        id, 
        "documentId", 
        content, 
        metadata,
        0.5::double precision as score
      FROM "document_chunks"
      WHERE content ILIKE $1
      LIMIT $2
    `, `%${query}%`, topK);
    return results || [];
  }
}

/**
 * Executes a Hybrid Search using Reciprocal Rank Fusion (RRF).
 * Combines top K semantic vector matches and keyword full-text matches.
 */
export async function hybridSearch(
  query: string,
  embedding: number[],
  options: { topK?: number; similarityThreshold?: number } = {}
): Promise<SearchResult[]> {
  const topK = options.topK ?? 5;
  const similarityThreshold = options.similarityThreshold ?? 0.3; // Default threshold for hybrid

  // Query vector and keyword search in parallel
  const [vectorResults, keywordResults] = await Promise.all([
    vectorSearch(embedding, topK * 2, similarityThreshold),
    keywordSearch(query, topK * 2),
  ]);

  // Reciprocal Rank Fusion parameter (typically 60)
  const k = 60;
  const rrfScores: Record<string, { chunk: SearchResult; score: number }> = {};

  // Rank matches from Vector Search
  vectorResults.forEach((chunk, index) => {
    const rank = index + 1;
    if (!rrfScores[chunk.id]) {
      rrfScores[chunk.id] = { chunk, score: 0 };
    }
    rrfScores[chunk.id].score += 1 / (rank + k);
  });

  // Rank matches from Keyword Search
  keywordResults.forEach((chunk, index) => {
    const rank = index + 1;
    if (!rrfScores[chunk.id]) {
      rrfScores[chunk.id] = { chunk, score: 0 };
    }
    rrfScores[chunk.id].score += 1 / (rank + k);
  });

  // Sort chunks by RRF score descending and trim to topK
  const sorted = Object.values(rrfScores)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => ({
      ...item.chunk,
      rrfScore: item.score,
    }));

  return sorted;
}

/**
 * Deletes all chunks associated with a document.
 */
export async function deleteDocumentChunks(documentId: string): Promise<void> {
  await prisma.documentChunk.deleteMany({
    where: {
      documentId,
    },
  });
}
