const fs = require('fs');
const bundle = 'D:/ai/ai_case-project/playwright-mcp/node_modules/playwright-core/lib/coreBundle.js';
let c = fs.readFileSync(bundle, 'utf8');

// Check if toHaveCSS exists
const hasToHaveCSS = c.includes('expect(locator2).toHaveCSS');
console.log('Has toHaveCSS:', hasToHaveCSS);

if (hasToHaveCSS) {
  // Replace the try/catch block with direct computed style check
  // Pattern: the handle function of verifyCSS
  const pattern = /(verifyCSS = defineTabTool\(\{[\s\S]*?handle: async \(tab2, params2, response2\) \{[\s\S]*?)try \{[\s\S]*?await expect\(locator2\)\.toHaveCSS\(params2\.property, params2\.expected, tab2\.expectTimeoutOptions\);[\s\S]*?\} catch \{[\s\S]*?const value2 = await locator2\.evaluate[\s\S]*?\}[\s\S]*?return;[\s\S]*?\}/;

  const match = c.match(pattern);
  if (match) {
    console.log('Found toHaveCSS pattern at index', match.index);
    console.log('Match length:', match[0].length);
  }

  // Simpler approach: just find and replace the try block
  const oldTryBlock = `        try {
          await expect(locator2).toHaveCSS(params2.property, params2.expected, tab2.expectTimeoutOptions);
        } catch {
          const value2 = await locator2.evaluate((el, prop) => {
            return window.getComputedStyle(el).getPropertyValue(prop);
          }, params2.property);
          response2.addError(\`Expected CSS "\${params2.property}" to be "\${params2.expected}", but got "\${value2}"\`);
          return;
        }`;

  const newBlock = `        const value2 = await locator2.evaluate((el, prop) => {
          return window.getComputedStyle(el).getPropertyValue(prop);
        }, params2.property);
        if (value2 !== params2.expected) {
          response2.addError(\`Expected CSS "\${params2.property}" to be "\${params2.expected}", but got "\${value2}"\`);
          return;
        }`;

  if (c.includes(oldTryBlock)) {
    c = c.replace(oldTryBlock, newBlock);
    fs.writeFileSync(bundle, c, 'utf-8');
    console.log('Fixed verifyCSS - replaced toHaveCSS try/catch with direct check');
  } else {
    console.log('Could not find exact try/catch block to replace');
    // Let's look at the actual code around verifyCSS
    const cssIdx = c.indexOf('verifyCSS = defineTabTool');
    console.log('verifyCSS code:');
    console.log(c.slice(cssIdx + 200, cssIdx + 800));
  }
} else {
  console.log('toHaveCSS already removed or not present');
}
