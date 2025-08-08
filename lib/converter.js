import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import archiver from 'archiver';

export async function extractContent(url) {
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
  
  // Clean up HTML for EPUB XHTML compliance
  cleanHtmlForEpub(contentDoc);
  
  // Update article content with additional sanitization
  let cleanContent = contentDoc.body.innerHTML;
  
  // Additional aggressive cleaning for XHTML compliance
  cleanContent = sanitizeForXhtml(cleanContent);
  
  article.content = cleanContent;
  
  return {
    title: article.title,
    byline: article.byline || 'Unknown',
    content: article.content,
    textContent: contentDoc.body.textContent || '',
    wordCount: (contentDoc.body.textContent || '').split(/\s+/).length,
    readingTime: Math.ceil((contentDoc.body.textContent || '').split(/\s+/).length / 200)
  };
}

export async function createEpubBuffer(article) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver('zip', { store: true });
    
    archive.on('data', chunk => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    
    // EPUB structure
    archive.append('application/epub+zip', { name: 'mimetype' });
    
    // META-INF
    archive.append(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`, { name: 'META-INF/container.xml' });
    
    // Content OPF
    archive.append(`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${escapeXml(article.title)}</dc:title>
    <dc:creator>${escapeXml(article.byline)}</dc:creator>
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

    // Content - ensure valid XHTML
    const cleanContent = sanitizeForXhtml(article.content);
    archive.append(`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(article.title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>${escapeXml(article.title)}</h1>
  <p class="byline">by ${escapeXml(article.byline)}</p>
  ${cleanContent}
</body>
</html>`, { name: 'OEBPS/content.xhtml' });
    
    archive.finalize();
  });
}

function cleanHtmlForEpub(doc) {
  // Remove any script tags first
  doc.querySelectorAll('script').forEach(el => el.remove());
  
  // Remove any style tags (we have our own CSS)
  doc.querySelectorAll('style').forEach(el => el.remove());
  
  // Fix self-closing tags that need to be properly closed for XHTML
  const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr'];
  
  selfClosingTags.forEach(tagName => {
    const elements = doc.querySelectorAll(tagName);
    elements.forEach(el => {
      // Remove the element and replace with a properly formatted one
      const parent = el.parentNode;
      if (parent) {
        const newEl = doc.createElement(tagName);
        // Copy attributes
        for (let attr of el.attributes) {
          newEl.setAttribute(attr.name, attr.value);
        }
        parent.replaceChild(newEl, el);
      }
    });
  });
  
  // Remove any comments
  const walker = doc.createTreeWalker(
    doc.body,
    doc.defaultView.NodeFilter.SHOW_COMMENT,
    null,
    false
  );
  
  const comments = [];
  let node;
  while (node = walker.nextNode()) {
    comments.push(node);
  }
  comments.forEach(comment => comment.remove());
  
  // Clean up empty paragraphs and divs
  doc.querySelectorAll('p, div').forEach(el => {
    if (!el.textContent.trim() && !el.querySelector('img, br, hr')) {
      el.remove();
    }
  });
  
  // Remove any malformed or problematic elements
  doc.querySelectorAll('*').forEach(el => {
    // Remove elements with no tag name or malformed tags
    if (!el.tagName || el.tagName.includes(':')) {
      el.remove();
    }
  });
}

function sanitizeForXhtml(html) {
  if (!html) return '';
  
  // Fix common XHTML issues
  return html
    // Fix self-closing tags - more aggressive approach
    .replace(/<hr([^>]*?)(?<!\/)\s*>/gi, '<hr$1 />')
    .replace(/<br([^>]*?)(?<!\/)\s*>/gi, '<br$1 />')
    .replace(/<img([^>]*?)(?<!\/)\s*>/gi, '<img$1 />')
    .replace(/<input([^>]*?)(?<!\/)\s*>/gi, '<input$1 />')
    .replace(/<meta([^>]*?)(?<!\/)\s*>/gi, '<meta$1 />')
    .replace(/<link([^>]*?)(?<!\/)\s*>/gi, '<link$1 />')
    .replace(/<area([^>]*?)(?<!\/)\s*>/gi, '<area$1 />')
    .replace(/<base([^>]*?)(?<!\/)\s*>/gi, '<base$1 />')
    .replace(/<col([^>]*?)(?<!\/)\s*>/gi, '<col$1 />')
    .replace(/<embed([^>]*?)(?<!\/)\s*>/gi, '<embed$1 />')
    .replace(/<source([^>]*?)(?<!\/)\s*>/gi, '<source$1 />')
    .replace(/<track([^>]*?)(?<!\/)\s*>/gi, '<track$1 />')
    .replace(/<wbr([^>]*?)(?<!\/)\s*>/gi, '<wbr$1 />')
    // Fix any & that aren't part of entities
    .replace(/&(?![a-zA-Z0-9#]{1,7};)/g, '&amp;')
    // Remove any script or style tags that might have slipped through
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Fix any remaining malformed tags
    .replace(/<\/?(br|hr|img|input|meta|link|area|base|col|embed|source|track|wbr)\s*\/?\s*>/gi, (match, tag) => {
      return `<${tag} />`;
    });
}

function escapeXml(str) {
  if (!str) return '';
  return str.replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;'
  })[c]);
}