import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
// No image processing needed
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

async function webToEpub(url) {
  // Fetch and parse webpage
  const response = await fetch(url);
  const html = await response.text();
  const dom = new JSDOM(html, { url });
  
  // Extract content with Readability
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  
  if (!article) throw new Error('Could not extract article content');
  
  // Remove images and captions from content
  const contentDom = new JSDOM(article.content);
  const contentDoc = contentDom.window.document;
  
  // Remove all images
  contentDoc.querySelectorAll('img').forEach(img => img.remove());
  
  // Remove figure elements (often contain images + captions)
  contentDoc.querySelectorAll('figure').forEach(fig => fig.remove());
  
  // Remove figcaption elements
  contentDoc.querySelectorAll('figcaption').forEach(cap => cap.remove());
  
  // Remove elements with image-related classes
  contentDoc.querySelectorAll('[class*="image"], [class*="photo"], [class*="caption"]').forEach(el => el.remove());
  
  // Update article content
  article.content = contentDoc.body.innerHTML;
  
  // No cover image - using article title only
  
  // Generate EPUB
  const filename = `${article.title.replace(/[^a-zA-Z0-9]/g, '_')}.epub`;
  await createEpub(article, filename);
  
  console.log(`EPUB created: ${filename}`);
  return filename;
}

async function createEpub(article, filename) {
  const output = fs.createWriteStream(filename);
  const archive = archiver('zip', { store: true });
  
  archive.pipe(output);
  
  // EPUB structure
  archive.append('application/epub+zip', { name: 'mimetype' });
  
  // META-INF
  archive.append(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`, { name: 'META-INF/container.xml' });
  
  // Content OPF - no cover image
  
  archive.append(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(article.title)}</dc:title>
    <dc:creator>${escapeXml(article.byline || 'Unknown')}</dc:creator>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">${Date.now()}</dc:identifier>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="styles.css" media-type="text/css"/>
  </manifest>
  <spine toc="ncx">
    <itemref idref="content"/>
  </spine>
</package>`, { name: 'OEBPS/content.opf' });
  
  // NCX
  archive.append(`<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${Date.now()}"/>
  </head>
  <docTitle><text>${escapeXml(article.title)}</text></docTitle>
  <navMap>
    <navPoint id="navpoint-1" playOrder="1">
      <navLabel><text>${escapeXml(article.title)}</text></navLabel>
      <content src="content.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`, { name: 'OEBPS/toc.ncx' });
  
  // Enhanced CSS with Bookerly font
  archive.append(`/* Bookerly font stack with fallbacks */
body {
  font-family: "Bookerly", "Amazon Ember", "Times New Roman", Times, serif;
  font-size: 1em;
  line-height: 1.5;
  margin: 1.5em 1em;
  text-align: left;
  color: #000;
  background: #fff;
}

/* Headings */
h1, h2, h3, h4, h5, h6 {
  font-family: "Amazon Ember", "Helvetica Neue", Arial, sans-serif;
  font-weight: bold;
  margin: 1.5em 0 0.75em 0;
  line-height: 1.2;
}

h1 {
  font-size: 1.8em;
  margin-bottom: 0.5em;
  border-bottom: 1px solid #ddd;
  padding-bottom: 0.3em;
}

h2 { font-size: 1.5em; }
h3 { font-size: 1.3em; }
h4 { font-size: 1.1em; }

/* Paragraphs */
p {
  margin: 0 0 1em 0;
  text-align: justify;
  text-indent: 0;
  orphans: 2;
  widows: 2;
}

/* Author byline */
.byline {
  font-style: italic;
  color: #666;
  margin-bottom: 2em;
  font-size: 0.95em;
}

/* Links */
a {
  color: #0066cc;
  text-decoration: underline;
}

/* Lists */
ul, ol {
  margin: 1em 0;
  padding-left: 2em;
}

li {
  margin: 0.5em 0;
}

/* Blockquotes */
blockquote {
  margin: 1.5em 2em;
  padding: 0.5em 1em;
  border-left: 3px solid #ddd;
  font-style: italic;
  background: #f9f9f9;
}

/* Code */
code {
  font-family: "Courier New", monospace;
  background: #f5f5f5;
  padding: 0.1em 0.3em;
  border-radius: 3px;
}

/* Strong and emphasis */
strong, b {
  font-weight: bold;
}

em, i {
  font-style: italic;
}

/* Page breaks */
.page-break {
  page-break-before: always;
}`, { name: 'OEBPS/styles.css' });

  // Content
  archive.append(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(article.title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>${escapeXml(article.title)}</h1>
  ${article.byline ? `<p class="byline">by ${escapeXml(article.byline)}</p>` : ''}
  ${article.content}
</body>
</html>`, { name: 'OEBPS/content.xhtml' });
  
  // No cover image needed
  
  await archive.finalize();
}

function escapeXml(str) {
  return str.replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  })[c]);
}

// Usage
const url = process.argv[2];
if (!url) {
  console.log('Usage: node index.js <url>');
  process.exit(1);
}

webToEpub(url).catch(console.error);