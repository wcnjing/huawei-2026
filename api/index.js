// Vercel serverless entry point.
//
// Vercel treats every file in api/ as a function and hands it a (req, res) pair, which
// is exactly what an Express app is. server/index.js only calls app.listen() when it is
// the process entrypoint, so importing it here starts no listener.
//
// Static assets are NOT served through this function — vercel.json points those at the
// built dist/ directory, so the CDN serves them and the function only handles /api/*.
export { app as default } from '../server/index.js';
