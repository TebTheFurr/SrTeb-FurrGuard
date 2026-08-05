@verbatim
<template id="te-tab-seo">
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Search Engine Indexing</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <div class="te-toggle-field">
                    <label class="te-toggle">
                        <input type="checkbox" data-path="seo.indexing_enabled" data-checked="{{INDEXING_ENABLED_CHECKED}}">
                        <span class="te-toggle-slider"></span>
                    </label>
                    <span class="te-toggle-label">Allow search engines like Google to index your site. When disabled, a noindex tag will be added.</span>
                </div>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Meta Tags</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Meta Title</label>
                <input type="text" class="te-input" data-path="seo.meta_title" value="{{META_TITLE}}" placeholder="Leave empty to use site name">
            </div>
            <div class="te-field">
                <label class="te-label">Meta Description</label>
                <textarea class="te-input te-textarea" data-path="seo.meta_description" rows="3">{{META_DESCRIPTION}}</textarea>
            </div>
            <div class="te-field">
                <label class="te-label">Meta Keywords</label>
                <input type="text" class="te-input" data-path="seo.meta_keywords" value="{{META_KEYWORDS}}" placeholder="game, server, hosting">
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Favicon</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Favicon</label>
                <div data-component="file-upload" data-path="seo.favicon" data-value="{{FAVICON}}"></div>
                <p class="te-help-text">Recommended: 32x32px or 64x64px PNG. Used for browser tabs and bookmarks.</p>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Social Sharing</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">OG Image</label>
                <div data-component="file-upload" data-path="seo.meta_image" data-value="{{META_IMAGE}}"></div>
                <p class="te-help-text">Recommended: 1200x630px</p>
            </div>
        </div>
    </div>
</template>
@endverbatim
