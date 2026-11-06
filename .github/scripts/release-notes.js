'use strict';
// Prints the CHANGELOG.md section for one version, for the GitHub release body.
//   node .github/scripts/release-notes.js v0.6.0 > notes.md
const fs = require('fs');
const path = require('path');

function sectionFor(changelog, version) {
  const v = String(version).replace(/^v/, '');
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((l) => new RegExp(`^## \\[${v.replace(/\./g, '\\.')}\\]`).test(l));
  if (start < 0) return '';
  let end = lines.findIndex((l, i) => i > start && (/^## /.test(l) || /^\[[^\]]+\]: /.test(l)));
  if (end < 0) end = lines.length;
  return lines.slice(start + 1, end).join('\n').trim();
}

if (require.main === module) {
  const version = process.argv[2] || require('../../package.json').version;
  const file = path.join(__dirname, '..', '..', 'CHANGELOG.md');
  const notes = sectionFor(fs.readFileSync(file, 'utf8'), version);
  process.stdout.write(notes ? notes + '\n' : `Ada ${version.replace(/^v/, '')}\n`);
}

module.exports = { sectionFor };
