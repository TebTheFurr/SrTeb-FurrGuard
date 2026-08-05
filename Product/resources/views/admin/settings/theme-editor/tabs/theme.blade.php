@verbatim
<template id="te-tab-theme">
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Colour Presets</span>
        </div>
        <div class="te-section-content">
            <p class="te-help-text" style="margin-bottom:12px">Quick-start with a pre-built colour palette (applies to both dark and light modes)</p>
            <div class="te-color-presets">{{COLOR_PRESETS}}</div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Dark Mode Colours</span>
        </div>
        <div class="te-section-content">
            <p class="te-help-text" style="margin-bottom:12px">Use HSL format, e.g. hsl(229, 100%, 64%)</p>
            <div class="te-color-grid" id="colorCardsContainer">{{COLOR_CARDS}}</div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Light Mode Colours</span>
        </div>
        <div class="te-section-content">
            <p class="te-help-text" style="margin-bottom:12px">Colours used when users switch to light mode</p>
            <div class="te-color-grid" id="lightColorCardsContainer">{{LIGHT_COLOR_CARDS}}</div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Appearance</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Border Radius <span class="te-label-hint">(px)</span></label>
                <div class="te-slider-row">
                    <input type="range" class="te-slider" data-path="theme.border_radius" min="0" max="24" value="{{BORDER_RADIUS}}">
                    <span class="te-slider-value">{{BORDER_RADIUS}}px</span>
                    <div class="te-radius-preview" id="radiusPreview" style="border-radius:{{BORDER_RADIUS}}px"></div>
                </div>
            </div>
            <div class="te-field">
                <label class="te-label">Font Family</label>
                <div class="te-select-wrap">
                    <select class="te-input te-select" data-path="theme.font_family">{{FONT_OPTIONS}}</select>
                    <i class="fa fa-chevron-down te-select-icon"></i>
                </div>
            </div>
        </div>
    </div>
</template>
@endverbatim
