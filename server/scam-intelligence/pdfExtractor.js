import { PDFParse } from 'pdf-parse';
import supabase from '../supabase.js';

/**
 * Download a scam bulletin PDF from Supabase Storage
 * and extract text from page 1.
 *
 * @param {string} storagePath - Path inside the scam-bulletins bucket
 * @returns {Promise<string>} Extracted text from page 1
 */
export async function extractPdfText(storagePath) {
  const { data, error } = await supabase.storage
    .from('scam-bulletins')
    .download(storagePath);

  if (error) {
    throw new Error(`Failed to download PDF: ${error.message}`);
  }

  const buffer = Buffer.from(await data.arrayBuffer());

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