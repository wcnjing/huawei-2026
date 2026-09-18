import supabase from '../supabase.js';

// take in smth like:
// const rawText = await extractPdfText(pdfPath);

// retun smth like:
// {
//   "scams": [
//     {
//       "scam_name": "Lucky Draw Scam",
//       "scam_category": "Prize / Lucky Draw Scam",
//       "description": "...",
//       "variants": [
//         {
//           "variant_name": "Fake Influencer Quiz",
//           "description": "...",
//           "modus_operandi": "...",
//           "communication_channel": "...",
//           "impersonated_entity": "...",
//           "target_victims": "...",
//           "red_flags": [],
//           "requested_action": "...",
//           "scam_tactics": [],
//           "victim_action": "...",
//           "verification_method": "...",
//           "prevention_advice": "..."
//         }
//       ]
//     }
//   ]
// }

async function testSupabase() {
  const { data, error } = await supabase
    .from('bulletins')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Supabase test failed:');
    console.error(error);
    return;
  }

  console.log('✅ Supabase connection works!');
  console.log('Bulletin:', data);
}

testSupabase();