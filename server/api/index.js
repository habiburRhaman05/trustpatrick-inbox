// Vercel serverless entry point.
// Vercel's @vercel/node builder expects a module.exports = handler or app.
// Express apps work directly — Vercel wraps them into a Node.js serverless fn.

const app = require('../app');

module.exports = app;
