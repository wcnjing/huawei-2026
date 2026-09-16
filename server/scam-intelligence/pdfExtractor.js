import { PDFParse } from 'pdf-parse';
import fs from 'fs/promises';

/**
 * Extract English text from page 1 of a scam bulletin PDF.
 *
 * @param {string} filePath - Absolute path to the PDF
 * @returns {Promise<string>} Extracted English text from page 1
 */
export async function extractPdfText(filePath) {
  const buffer = await fs.readFile(filePath);

  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText({
      first: 1,
      last: 1,
    });

    return result.text;
  } finally {
    await parser.destroy();
  }
}