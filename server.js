import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractContent, createEpubBuffer } from './lib/converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// In-memory storage for preview content
const previewCache = new Map();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Preview endpoint
app.post('/api/preview', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Validate URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    console.log(`Extracting content from: ${url}`);
    const article = await extractContent(url);
    
    // Store in cache for download
    const cacheKey = Date.now().toString();
    previewCache.set(cacheKey, article);
    
    // Clean up old cache entries (keep last 100)
    if (previewCache.size > 100) {
      const oldestKey = previewCache.keys().next().value;
      previewCache.delete(oldestKey);
    }
    
    res.json({
      success: true,
      cacheKey,
      preview: {
        title: article.title,
        byline: article.byline,
        content: article.content,
        wordCount: article.wordCount,
        readingTime: article.readingTime
      }
    });
    
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).json({ 
      error: 'Failed to extract content',
      message: error.message 
    });
  }
});

// Download endpoint
app.post('/api/download', async (req, res) => {
  try {
    const { cacheKey } = req.body;
    
    if (!cacheKey || !previewCache.has(cacheKey)) {
      return res.status(400).json({ error: 'Invalid or expired cache key' });
    }
    
    const article = previewCache.get(cacheKey);
    console.log(`Generating EPUB for: ${article.title}`);
    
    const epubBuffer = await createEpubBuffer(article);
    const filename = `${article.title.replace(/[^a-zA-Z0-9]/g, '_')}.epub`;
    
    res.set({
      'Content-Type': 'application/epub+zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': epubBuffer.length
    });
    
    res.send(epubBuffer);
    
    // Clean up cache entry
    previewCache.delete(cacheKey);
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      error: 'Failed to generate EPUB',
      message: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// For Vercel, export the app instead of listening
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Web to EPUB server running on http://localhost:${PORT}`);
  });
}

export default app;