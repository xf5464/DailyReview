'use strict';

const fs = require('node:fs');

const TARGET = 'scripts/send-hot-news-email.js';
let source = fs.readFileSync(TARGET, 'utf8');

const fallbackBefore = `        catch (fallbackError) {
          console.warn(\`Could not translate title from \${language}: MyMemory: \${error.message}; Google fallback: \${fallbackError.message}\`);
        }`;
const fallbackAfter = `        catch (fallbackError) {
          output[indexes[0]].titleZh = items[indexes[0]].title;
          console.warn(\`Could not translate title from \${language}; kept original title: MyMemory: \${error.message}; Google fallback: \${fallbackError.message}\`);
        }`;

if (!source.includes(fallbackBefore) && !source.includes(fallbackAfter)) {
  throw new Error('Could not find the title-translation fallback block.');
}
source = source.replace(fallbackBefore, fallbackAfter);

const strictReturn = '  return assertChineseTranslations(output);';
const bestEffortReturn = '  return output; // Best effort: failed translations keep the original title.';
if (!source.includes(strictReturn) && !source.includes(bestEffortReturn)) {
  throw new Error('Could not find the strict translation return statement.');
}
source = source.replace(strictReturn, bestEffortReturn);

fs.writeFileSync(TARGET, source, 'utf8');
console.log('Enabled best-effort title translation fallback for reader refresh.');
