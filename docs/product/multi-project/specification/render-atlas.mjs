import { readFile, writeFile } from 'node:fs/promises';

const directory = new URL('./', import.meta.url);
const data = JSON.parse(await readFile(new URL('feature-map.json', directory), 'utf8'));
const template = await readFile(new URL('atlas.template.html', directory), 'utf8');
const page = await readFile(new URL('atlas-page.template.html', directory), 'utf8');
const embedded = JSON.stringify(data).replaceAll('<', '\\u003c');
const fragment = template.replace('__VIVARY_SPEC_DATA__', embedded)
  .replace('__MODULE_COUNT__', String(data.modules.length))
  .replace('__ACTION_COUNT__', String(data.actions.length))
  .replace('__OUTCOME_COUNT__', String(new Set(data.modules.flatMap(module => module.outcomes)).size));
await writeFile(new URL('atlas.fragment.html', directory), fragment);
await writeFile(new URL('atlas.html', directory), page.replace('__VIVARY_ATLAS_FRAGMENT__', fragment));
console.log(`Rendered module atlas: ${data.modules.length} modules, ${data.actions.length} actions.`);
