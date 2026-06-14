import mammoth from 'mammoth';
import * as cheerio from 'cheerio';

export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error('Failed to parse PDF file');
  }
}

/**
 * Parses a DOCX file buffer and returns its raw text content.
 */
export async function parseDOCX(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    throw new Error('Failed to parse DOCX file');
  }
}

/**
 * Parses a plaintext (TXT) or Markdown (MD) buffer.
 */
export function parseText(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

/**
 * Fetches content from a URL and extracts its main body text using cheerio.
 */
export async function parseURL(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove non-content elements to clean up text
    $('script, style, iframe, noscript, header, footer, nav, aside, svg, form').remove();

    // Extract text from the body
    let bodyText = $('body').text();
    
    // Fallback if body is empty or too small, get all page text
    if (!bodyText || bodyText.trim().length < 50) {
      bodyText = $.text();
    }

    // Clean whitespace
    const cleanText = bodyText
      .replace(/\s+/g, ' ') // replace multiple spaces/newlines with a single space
      .replace(/\n+/g, '\n') // remove redundant newlines
      .trim();

    return cleanText;
  } catch (error) {
    console.error('Error parsing URL:', error);
    throw new Error(`Failed to parse URL content: ${(error as Error).message}`);
  }
}

/**
 * Route router to parse documents based on extension / type.
 */
export async function parseDocument(
  buffer: Buffer,
  fileExtension: string
): Promise<string> {
  const ext = fileExtension.toLowerCase().replace(/^\./, '');
  switch (ext) {
    case 'pdf':
      return await parsePDF(buffer);
    case 'docx':
      return await parseDOCX(buffer);
    case 'txt':
    case 'md':
    case 'markdown':
      return parseText(buffer);
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}
