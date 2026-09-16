import 'dotenv/config';
import { extractPdfText } from './pdfExtractor.js';

const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error('❌ Please provide a PDF file path.');
  console.error('Example:');
  console.error('node server/scam-intelligence/testPdfExtractor.js "path/to/file.pdf"');
  process.exit(1);
}

try {
  console.log('📄 Extracting PDF text...');
  console.log(`File: ${pdfPath}`);

  const text = await extractPdfText(pdfPath);

  console.log('\n✅ PDF extraction successful!');
  console.log(`Extracted ${text.length} characters.`);

  console.log('\n--- FIRST 3000 CHARACTERS ---\n');
  console.log(text.slice(0, 3000));

  console.log('\n--- END PREVIEW ---');
} catch (error) {
  console.error('❌ PDF extraction failed:');
  console.error(error);
  process.exit(1);
}