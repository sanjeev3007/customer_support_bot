interface ChunkerOptions {
  chunkSize?: number;
  chunkOverlap?: number;
}

/**
 * Splits text into segments using a sliding-window boundary-aware splitter.
 * It attempts to break chunks on paragraph breaks (\n\n), newline breaks (\n), 
 * sentence boundaries (. , ? , !), or word boundaries (spaces) to preserve context.
 */
export function splitText(text: string, options: ChunkerOptions = {}): string[] {
  const chunkSize = options.chunkSize ?? 1000;
  const chunkOverlap = options.chunkOverlap ?? 200;

  if (chunkOverlap >= chunkSize) {
    throw new Error('Chunk overlap must be less than chunk size.');
  }

  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    // If the remaining text fits entirely within a chunk, take it all and finish
    if (startIndex + chunkSize >= text.length) {
      const chunk = text.substring(startIndex).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      break;
    }

    let endIndex = startIndex + chunkSize;
    const window = text.substring(startIndex, endIndex);

    // Look for a clean boundary in the last half of the window
    let splitIndex = -1;
    
    // Ordered preference for boundaries
    const separators = [
      '\n\n', // paragraph
      '\n',   // line break
      '. ',   // sentence end
      '? ',   // question end
      '! ',   // exclamation end
      '; ',   // semicolon
      ', ',   // comma
      ' '     // space
    ];

    for (const separator of separators) {
      const lastIdx = window.lastIndexOf(separator);
      // We want to split at a boundary that is reasonably far into the chunk (at least 30%)
      if (lastIdx !== -1 && lastIdx > chunkSize * 0.3) {
        splitIndex = lastIdx + separator.length;
        break;
      }
    }

    // If we found a good split index, adjust the endIndex
    if (splitIndex !== -1) {
      endIndex = startIndex + splitIndex;
    }

    const chunk = text.substring(startIndex, endIndex).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // Move start index forward for next chunk (offsetting by overlap)
    const nextStartIndex = endIndex - chunkOverlap;
    
    // Ensure we always make progress even with weird whitespace
    if (nextStartIndex <= startIndex) {
      startIndex = endIndex;
    } else {
      startIndex = nextStartIndex;
    }
  }

  return chunks;
}
