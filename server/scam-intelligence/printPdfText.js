// prints extracted raw text from pdf, not in pipeline (for manual use)
// run:
// node server/scam-intelligence/printPdfText.js <YYYY>/scam_bulletin_<YYYY>_<MM>.pdf

import supabase from '../supabase.js';
import { extractPdfText } from './pdfExtractor.js';

const storagePath = process.argv[2];

if (!storagePath) {
    throw new Error(
        'Please provide the PDF storage path.'
    );
}

console.log(`📄 PDF: ${storagePath}`);
console.log('📖 Extracting PDF text...\n');

const rawText = await extractPdfText(storagePath);

if (!rawText || rawText.trim() === '') {
    throw new Error('No text was extracted from the PDF.');
}

console.log('========== RAW TEXT START ==========\n');
console.log(rawText);
console.log('\n========== RAW TEXT END ==========\n');