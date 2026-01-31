/**
 * slug.js - simple slug generator (placeholder)
 */
const slugify = require('slugify');
function makeSlug(name) {
  return slugify(String(name || ''), { lower: true, strict: true, trim: true });
}
module.exports = { makeSlug };
