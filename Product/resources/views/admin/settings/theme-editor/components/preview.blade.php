@verbatim
<template id="te-preview">
    <div class="te-preview-container">
        <div class="te-preview-header">
            <div class="te-device-presets">
                <button class="te-device-btn {{DESKTOP_ACTIVE}}" data-device="responsive">{{ICON_DESKTOP}} Desktop</button>
                <button class="te-device-btn {{TABLET_ACTIVE}}" data-device="tablet">{{ICON_TABLET}} Tablet</button>
                <button class="te-device-btn {{MOBILE_ACTIVE}}" data-device="mobile">{{ICON_MOBILE}} Mobile</button>
            </div>
            <button class="te-btn te-btn-secondary te-btn-sm" data-action="refresh-preview">{{ICON_REFRESH}} Refresh</button>
        </div>
        <div class="te-preview-viewport">
            <div class="te-preview-url-bar">
                <span class="te-preview-url" id="previewUrl">/</span>
                <a class="te-preview-url-link" id="previewUrlLink" href="/" target="_blank">{{ICON_EXTERNAL_LINK}}</a>
            </div>
            <div class="te-resize-overlay" id="resizeOverlay"></div>
            <div class="te-preview-frame-container" id="previewContainer" style="width:{{PREVIEW_WIDTH}}">
                <div class="te-resize-handle te-resize-handle-left" data-resize="left"></div>
                <div class="te-preview-frame">
                    <iframe class="te-preview-iframe" id="previewFrame" src="/"></iframe>
                </div>
                <div class="te-resize-handle te-resize-handle-right" data-resize="right"></div>
            </div>
            <div class="te-viewport-size" id="viewportSize">{{VIEWPORT_SIZE}}</div>
        </div>
    </div>
</template>
@endverbatim
