import 'dotenv/config';
import OpenAI from 'openai';
import supabase from '../supabase.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function extractScams(rawText) {
    const response = await openai.responses.create({
        model: 'gpt-5-mini',

        input: [
            {
                role: 'system',
                content: `
You are a scam intelligence data extraction assistant.

Extract structured scam information from Singapore scam bulletins.

IMPORTANT RULES:
- Only extract information explicitly supported by the bulletin.
- Do not invent information.
- If information is unavailable, return null.
- A bulletin may contain multiple scams.
- A scam may contain multiple variants.
- red_flags and scam_tactics must be arrays of strings.
- Do not generate IDs.
- Do not generate created_at values.
- Do not generate bulletin_id or scam_id.
- Keep the wording factual and concise.
- scam_name must be a canonical scam type name.
- Use stable, generic scam type names across different bulletins.
- Do not omit the word "scam" when it is part of the canonical scam type.
- For example, use "Lucky Draw scam" consistently rather than "Lucky Draw", "Lucky Draw scheme", or "Lucky Draw promotion".
- Do not include specific variants, platforms, dates, locations, impersonated entities, or individual organisations in scam_name.
- Do not include communication platforms, dates, locations, victim groups, or impersonated entities in scam_name.
- Do not infer target victims from the communication channel or scenario.
- Only populate target_victims when the bulletin explicitly identifies the target group.
- Do not add facts or interpretations that are not explicitly supported by the bulletin.

Return JSON in exactly this structure:

{
  "scams": [
    {
      "scam_name": "string",
      "scam_category": "string or null",
      "description": "string or null",

      "variants": [
        {
          "variant_name": "string",
          "description": "string or null",
          "modus_operandi": "string or null",
          "communication_channel": "string or null",
          "impersonated_entity": "string or null",
          "target_victims": "string or null",
          "red_flags": [],
          "requested_action": "string or null",
          "scam_tactics": [],
          "victim_action": "string or null",
          "verification_method": "string or null",
          "prevention_advice": "string or null"
        }
      ]
    }
  ]
}
        `
            },
            {
                role: 'user',
                content: rawText
            }
        ]
    });

    return JSON.parse(response.output_text);
}

function validateExtractionResult(result) {
    if (!result || typeof result !== 'object') {
        throw new Error('AI response is not a valid object.');
    }

    if (!Array.isArray(result.scams)) {
        throw new Error('AI response is missing a valid scams array.');
    }

    for (const scam of result.scams) {
        if (!scam || typeof scam !== 'object') {
            throw new Error('AI response contains an invalid scam object.');
        }

        if (
            typeof scam.scam_name !== 'string' ||
            scam.scam_name.trim() === ''
        ) {
            throw new Error('AI response contains a scam without a valid scam_name.');
        }

        if (!Array.isArray(scam.variants)) {
            throw new Error(
                `Scam "${scam.scam_name}" is missing a valid variants array.`
            );
        }

        for (const variant of scam.variants) {
            if (!variant || typeof variant !== 'object') {
                throw new Error(
                    `Scam "${scam.scam_name}" contains an invalid variant object.`
                );
            }

            if (
                typeof variant.variant_name !== 'string' ||
                variant.variant_name.trim() === ''
            ) {
                throw new Error(
                    `Scam "${scam.scam_name}" contains a variant without a valid variant_name.`
                );
            }

            if (!Array.isArray(variant.red_flags)) {
                throw new Error(
                    `Variant "${variant.variant_name}" must have red_flags as an array.`
                );
            }

            if (!Array.isArray(variant.scam_tactics)) {
                throw new Error(
                    `Variant "${variant.variant_name}" must have scam_tactics as an array.`
                );
            }
        }
    }

    return true;
}

async function findOrCreateScam(scam) {
    // 1. Check whether the canonical scam already exists
    const { data: existingScam, error: findError } = await supabase
        .from('scams')
        .select('id, scam_name')
        .ilike('scam_name', scam.scam_name)
        .maybeSingle();

    if (findError) {
        throw new Error(`Failed to find scam: ${findError.message}`);
    }

    // 2. If it already exists, reuse it
    if (existingScam) {
        console.log(`♻️ Existing scam found: ${existingScam.scam_name}`);
        return existingScam;
    }

    // 3. Otherwise, create a new canonical scam
    const { data: newScam, error: insertError } = await supabase
        .from('scams')
        .insert({
            scam_name: scam.scam_name,
            scam_category: scam.scam_category,
            description: scam.description
        })
        .select('id, scam_name')
        .single();

    if (insertError) {
        throw new Error(`Failed to create scam: ${insertError.message}`);
    }

    console.log(`🆕 New scam created: ${newScam.scam_name}`);

    return newScam;
}

async function linkBulletinToScam(bulletinId, scamId) {
    const { data: existingLink, error: findError } = await supabase
        .from('bulletin_scams')
        .select('bulletin_id, scam_id')
        .eq('bulletin_id', bulletinId)
        .eq('scam_id', scamId)
        .maybeSingle();

    if (findError) {
        throw new Error(`Failed to find bulletin-scam link: ${findError.message}`);
    }

    if (existingLink) {
        console.log(`🔗 Existing bulletin-scam link found`);
        return existingLink;
    }

    const { data, error } = await supabase
        .from('bulletin_scams')
        .insert({
            bulletin_id: bulletinId,
            scam_id: scamId
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to link bulletin to scam: ${error.message}`);
    }

    console.log(`🔗 Bulletin linked to scam`);

    return data;
}

async function approveBulletin(bulletinId) {
    const { data, error } = await supabase
        .from('bulletins')
        .update({
            processing_status: 'approved'
        })
        .eq('id', bulletinId)
        .eq('processing_status', 'review')
        .select()
        .maybeSingle();

    if (error) {
        throw new Error(`Failed to approve bulletin: ${error.message}`);
    }

    if (!data) {
        throw new Error(
            `Bulletin ${bulletinId} could not be approved. It may not exist or is not currently in review.`
        );
    }

    console.log(`✅ Bulletin approved: ${data.id}`);

    return data;
}

async function failBulletin(bulletinId) {
    const { data, error } = await supabase
        .from('bulletins')
        .update({
            processing_status: 'failed'
        })
        .eq('id', bulletinId)
        .eq('processing_status', 'processing')
        .select()
        .maybeSingle();

    if (error) {
        throw new Error(`Failed to mark bulletin as failed: ${error.message}`);
    }

    if (!data) {
        throw new Error(
            `Bulletin ${bulletinId} could not be marked as failed. It may not exist or is not currently processing.`
        );
    }

    console.log(`❌ Bulletin marked as failed: ${data.id}`);

    return data;
}

function normalizeVariantName(name) {
    const ignoredWords = new Set([
        'and',
        'of',
        'with',
        'the',
        'a',
        'an',
        'for',
        'variant',
        'scam'
    ]);

    return name
        .toLowerCase()
        .replace(/[-/]/g, ' ')
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .filter(word => !ignoredWords.has(word))
        .map(word => {
            // Basic singularisation
            if (word.endsWith('ies')) return word.slice(0, -3) + 'y';

            if (word.endsWith('s') && !word.endsWith('ss')) {
                return word.slice(0, -1);
            }

            return word;
        });
}

function variantSimilarity(nameA, nameB) {
    const wordsA = new Set(normalizeVariantName(nameA));
    const wordsB = new Set(normalizeVariantName(nameB));

    const commonWords = [...wordsA].filter(word => wordsB.has(word));

    // Compare against the smaller set.
    // This catches cases where the AI adds/removes descriptive words.
    const smallerSize = Math.min(wordsA.size, wordsB.size);

    if (smallerSize === 0) {
        return 0;
    }

    return commonWords.length / smallerSize;
}

async function insertVariant(scamId, variant) {
    const { data: existingVariants, error: findError } = await supabase
        .from('scam_variants')
        .select('id, variant_name')
        .eq('scam_id', scamId);

    if (findError) {
        throw new Error(`Failed to find existing variants: ${findError.message}`);
    }

    // Check for an exact or highly similar existing variant
    const existingVariant = existingVariants.find(existing => {
        const similarity = variantSimilarity(
            existing.variant_name,
            variant.variant_name
        );

        console.log(
            `   🔍 Comparing "${variant.variant_name}" with "${existing.variant_name}" → ${(similarity * 100).toFixed(0)}%`
        );

        return similarity >= 0.75;
    });

    if (existingVariant) {
        console.log(
            `♻️ Existing similar variant found: ${existingVariant.variant_name}`
        );

        return existingVariant;
    }

    // No similar variant found → create new variant
    const { data, error } = await supabase
        .from('scam_variants')
        .insert({
            scam_id: scamId,
            variant_name: variant.variant_name,
            description: variant.description,
            modus_operandi: variant.modus_operandi,
            communication_channel: variant.communication_channel,
            impersonated_entity: variant.impersonated_entity,
            target_victims: variant.target_victims,
            red_flags: variant.red_flags,
            requested_action: variant.requested_action,
            scam_tactics: variant.scam_tactics,
            victim_action: variant.victim_action,
            verification_method: variant.verification_method,
            prevention_advice: variant.prevention_advice
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to insert variant: ${error.message}`);
    }

    console.log(`   🆕 Variant created: ${data.variant_name}`);

    return data;
}

async function processBulletin(bulletin) {
    // Mark bulletin as currently being processed
    const { error: statusError } = await supabase
        .from('bulletins')
        .update({
            processing_status: 'processing'
        })
        .eq('id', bulletin.id);

    if (statusError) {
        throw new Error(
            `Failed to update processing status: ${statusError.message}`
        );
    }

    console.log('🔄 Bulletin status updated: processing');

    try {
        console.log('\n🤖 Sending raw_text to OpenAI...\n');

        const result = await extractScams(bulletin.raw_text);

        validateExtractionResult(result);

        console.log('✅ AI extraction successful and validated!\n');
        console.log(JSON.stringify(result, null, 2));

        for (const scam of result.scams) {
            const savedScam = await findOrCreateScam(scam);

            console.log('\n📦 Database scam:');
            console.log(savedScam);

            await linkBulletinToScam(bulletin.id, savedScam.id);

            for (const variant of scam.variants) {
                await insertVariant(savedScam.id, variant);
            }
        }

        // Mark bulletin as ready for review
        const { error: reviewStatusError } = await supabase
            .from('bulletins')
            .update({
                processing_status: 'review'
            })
            .eq('id', bulletin.id);

        if (reviewStatusError) {
            throw new Error(
                `Failed to update processing status to review: ${reviewStatusError.message}`
            );
        }

        console.log('\n🔎 Bulletin status updated: review');
        console.log('✅ Bulletin processing completed successfully.');

    } catch (error) {
        console.error('❌ AI extraction failed:');
        console.error(error);

        try {
            await failBulletin(bulletin.id);
        } catch (failError) {
            console.error('❌ Failed to mark bulletin as failed:');
            console.error(failError);
        }
    }
}

async function processNextPendingBulletin() {
    const { data: bulletin, error } = await supabase
        .from('bulletins')
        .select('*')
        .eq('processing_status', 'pending')
        .not('raw_text', 'is', null)
        .order('published_date', { ascending: true })
        .limit(1)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            console.log('ℹ️ No pending bulletins found.');
            return;
        }

        throw new Error(`Failed to get pending bulletin: ${error.message}`);
    }

    console.log('✅ Pending bulletin found:');
    console.log(`   ${bulletin.title}`);

    console.log(`🔒 Claiming bulletin: ${bulletin.title}`);

    await processBulletin(bulletin);
}

//main
processNextPendingBulletin();