class WebToEpubApp {
    constructor() {
        this.cacheKey = null;
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.urlForm = document.getElementById('urlForm');
        this.urlInput = document.getElementById('urlInput');
        this.previewBtn = document.getElementById('previewBtn');
        this.downloadBtn = document.getElementById('downloadBtn');
        this.errorMessage = document.getElementById('errorMessage');
        this.previewSection = document.getElementById('previewSection');
        this.articleTitle = document.getElementById('articleTitle');
        this.articleByline = document.getElementById('articleByline');
        this.articleContent = document.getElementById('articleContent');
        this.wordCount = document.getElementById('wordCount');
        this.readingTime = document.getElementById('readingTime');
    }

    bindEvents() {
        this.urlForm.addEventListener('submit', (e) => this.handlePreview(e));
        this.downloadBtn.addEventListener('click', () => this.handleDownload());
    }

    async handlePreview(e) {
        e.preventDefault();
        
        const url = this.urlInput.value.trim();
        if (!url) return;

        this.setLoading(this.previewBtn, true);
        this.hideError();
        this.hidePreview();

        try {
            const response = await fetch('/api/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to extract content');
            }

            this.cacheKey = data.cacheKey;
            this.showPreview(data.preview);

        } catch (error) {
            console.error('Preview error:', error);
            this.showError(error.message || 'Failed to extract content from the URL');
        } finally {
            this.setLoading(this.previewBtn, false);
        }
    }

    async handleDownload() {
        if (!this.cacheKey) return;

        this.setLoading(this.downloadBtn, true);

        try {
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ cacheKey: this.cacheKey })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to generate EPUB');
            }

            // Get filename from response headers
            const contentDisposition = response.headers.get('content-disposition');
            const filename = contentDisposition 
                ? contentDisposition.split('filename=')[1].replace(/"/g, '')
                : 'article.epub';

            // Create download
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(downloadUrl);

            // Clear cache key after successful download
            this.cacheKey = null;

        } catch (error) {
            console.error('Download error:', error);
            this.showError(error.message || 'Failed to download EPUB');
        } finally {
            this.setLoading(this.downloadBtn, false);
        }
    }

    showPreview(preview) {
        this.articleTitle.textContent = preview.title;
        this.articleByline.textContent = preview.byline;
        this.articleContent.innerHTML = preview.content;
        this.wordCount.textContent = `${preview.wordCount} words`;
        this.readingTime.textContent = `${preview.readingTime} min read`;
        
        this.previewSection.style.display = 'block';
        this.previewSection.scrollIntoView({ behavior: 'smooth' });
    }

    hidePreview() {
        this.previewSection.style.display = 'none';
        this.cacheKey = null;
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        this.errorMessage.scrollIntoView({ behavior: 'smooth' });
    }

    hideError() {
        this.errorMessage.style.display = 'none';
    }

    setLoading(button, loading) {
        const btnText = button.querySelector('.btn-text');
        const spinner = button.querySelector('.spinner');
        
        if (loading) {
            button.disabled = true;
            btnText.style.display = 'none';
            spinner.style.display = 'block';
        } else {
            button.disabled = false;
            btnText.style.display = 'block';
            spinner.style.display = 'none';
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WebToEpubApp();
});