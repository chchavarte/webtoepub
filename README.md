# Web to EPUB Converter

Convert web articles to EPUB format for your e-reader. Clean, distraction-free reading experience powered by Mozilla's Readability.js.

## Features

- 📖 Extract clean article content from any URL
- 🎨 Beautiful Bookerly font styling optimized for e-readers
- 📱 Responsive web interface with live preview
- 🚫 No images, ads, or distractions - just pure content
- ⚡ Fast conversion and download
- 🔒 Privacy-focused - no data stored permanently

## Tech Stack

- **Backend**: Node.js + Express
- **Content Extraction**: Mozilla Readability.js
- **EPUB Generation**: Custom implementation with proper styling
- **Frontend**: Vanilla JavaScript + CSS

## Local Development

```bash
# Install dependencies
npm install

# Start the server
npm start

# Open http://localhost:3000
```

## Deployment

This app is ready to deploy on Render, Vercel, or any Node.js hosting platform.

### Render Deployment

1. Connect your GitHub repository to Render
2. Use the included `render.yaml` configuration
3. Deploy automatically

## Usage

1. Enter any article URL
2. Click "Preview" to see extracted content
3. Click "Download EPUB" to get your e-book file
4. Transfer to your Kindle, Kobo, or any EPUB reader

## Supported Sites

Works with most news sites, blogs, and article pages including:
- Medium, Substack, Ghost blogs
- News sites (Guardian, BBC, etc.)
- Technical blogs and documentation
- Any site with readable article content

## License

MIT License - feel free to use and modify!