// creates bulletin row in Supabase (with raw text field)
// run:
// node server/scam-intelligence/ingestBulletin.js <YYYY>/scam_bulletin_<YYYY>_<MM>.pdf

import supabase from '../supabase.js';
import { extractPdfText } from './pdfExtractor.js';

const storagePath = process.argv[2];

if (!storagePath) {
    throw new Error(
        'Please provide the PDF storage path. Example: node server/scam-intelligence/ingestBulletin.js 2026/scam_bulletin_2026_09.pdf'
    );
}

function getIssueNumber(storagePath) {
    const match = storagePath.match(/scam_bulletin_\d{4}_(\d{2})\.pdf$/i);

    if (!match) {
        throw new Error(
            'Could not determine issue number from PDF filename.'
        );
    }

    return Number(match[1]);
}

function getPublishedDate(rawText) {
    const match = rawText.match(
        /(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})/i
    );

    if (!match) {
        throw new Error('Could not determine published date from PDF text.');
    }

    const [, day, monthName, year] = match;

    const months = {
        jan: '01',
        january: '01',
        feb: '02',
        february: '02',
        mar: '03',
        march: '03',
        apr: '04',
        april: '04',
        may: '05',
        jun: '06',
        june: '06',
        jul: '07',
        july: '07',
        aug: '08',
        august: '08',
        sep: '09',
        september: '09',
        oct: '10',
        october: '10',
        nov: '11',
        november: '11',
        dec: '12',
        december: '12',
    };

    const month = months[monthName.toLowerCase()];

    return `${year}-${month}-${day.padStart(2, '0')}`;
}

const issueNumber = getIssueNumber(storagePath);

const title = `Monthly Scams Bulletin Issue ${String(issueNumber).padStart(2, '0')}`;

console.log(`📄 Bulletin: ${title}`);
console.log(`📁 Storage path: ${storagePath}`);

console.log('📖 Extracting PDF text...');

const rawText = await extractPdfText(storagePath);

if (!rawText || rawText.trim() === '') {
    throw new Error('No text was extracted from the PDF.');
}

const publishedDate = getPublishedDate(rawText);

console.log(`📅 Published date: ${publishedDate}`);

console.log('✅ PDF text extracted successfully.');

console.log('💾 Creating bulletin record...');

const { data, error } = await supabase
    .from('bulletins')
    .insert({
        issue_number: issueNumber,
        title,
        published_date: publishedDate,
        pdf_storage_path: storagePath,
        raw_text: rawText,
        processing_status: 'pending',
    })
    .select()
    .single();

if (error) {
    throw new Error(`Failed to create bulletin: ${error.message}`);
}

console.log('✅ Bulletin created successfully:');
console.log(`   ${data.title}`);
console.log(`   ID: ${data.id}`);
console.log(`   Status: ${data.processing_status}`);