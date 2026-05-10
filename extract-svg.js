const fs = require('fs');

async function getSvgs() {
  const res = await fetch("https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2MyZjQyNjdlMDYwNDRmMDhhMzk3NzM0N2E5OTE2OWM0EgsSBxCQ4-OcxxEYAZIBIwoKcHJvamVjdF9pZBIVQhMyMTMwNTIyMzE0Mzg3MDAwNjYz&filename=&opi=89354086");
  const html = await res.text();
  const svgs = html.match(/<svg[\s\S]*?<\/svg>/g);
  if (svgs) {
    svgs.slice(0, 10).forEach((svg, i) => console.log(`--- SVG ${i} ---\n${svg}\n`));
  } else {
    console.log('No SVGs found');
  }
}
getSvgs();
