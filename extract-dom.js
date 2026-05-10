const fs = require('fs');
const html = fs.readFileSync('stitch_kitsune_finance/kitsune_dashboard_mobile_focus/code.html', 'utf-8');
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
if (bodyMatch) {
  let bodyContent = bodyMatch[1];
  bodyContent = bodyContent.replace(/class=/g, 'className=');
  bodyContent = bodyContent.replace(/<!--[\s\S]*?-->/g, '');
  bodyContent = bodyContent.replace(/style='[^']*'/g, '');
  bodyContent = bodyContent.replace(/style=\"[^\"]*\"/g, '');
  bodyContent = bodyContent.replace(/<img([^>]*)>/g, '<img$1/>');
  bodyContent = bodyContent.replace(/<svg([^>]*)>([\s\S]*?)<\/svg>/g, (match, attrs, content) => {
    return `<svg${attrs.replace(/viewbox/ig, 'viewBox').replace(/fill-rule/ig, 'fillRule').replace(/clip-rule/ig, 'clipRule').replace(/stroke-width/ig, 'strokeWidth').replace(/stroke-linecap/ig, 'strokeLinecap').replace(/stroke-linejoin/ig, 'strokeLinejoin').replace(/preserveaspectratio/ig, 'preserveAspectRatio')}>${content}</svg>`;
  });
  // Fix gradients and defs in SVGs
  bodyContent = bodyContent.replace(/<lineargradient/ig, '<linearGradient');
  bodyContent = bodyContent.replace(/<\/lineargradient>/ig, '</linearGradient>');
  bodyContent = bodyContent.replace(/gradientunits/ig, 'gradientUnits');
  bodyContent = bodyContent.replace(/stop-color/ig, 'stopColor');
  bodyContent = bodyContent.replace(/stop-opacity/ig, 'stopOpacity');
  
  fs.writeFileSync('temp_page.txt', bodyContent);
  console.log('Done');
}
