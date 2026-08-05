@verbatim
<template id="te-tab-layout">
    <div class="te-components-link-card">
        <div class="te-components-link-card-title">Edit Component Variations</div>
        <div class="te-components-link-card-subtitle">Customise server cards, power dock, stat cards, and more</div>
        <button class="te-btn te-btn-primary te-tab-btn" data-tab="components">Configure</button>
    </div>

    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Panel Layout</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Layout Style</label>
                <div class="te-layout-grid">
                    <label class="te-layout-option {{LAYOUT_DEFAULT_ACTIVE}}">
                        <input type="radio" name="layout_type" data-path="layout.layout_type" value="default" {{LAYOUT_DEFAULT_CHECKED}}>
                        <div class="te-layout-preview te-layout-default">
                            <div class="te-layout-sidebar"></div>
                            <div class="te-layout-content"></div>
                        </div>
                        <span class="te-layout-name">Default</span>
                        <span class="te-layout-desc">Standard sidebar on the left</span>
                    </label>
                    <label class="te-layout-option {{LAYOUT_NAVBAR_ACTIVE}}">
                        <input type="radio" name="layout_type" data-path="layout.layout_type" value="navbar" {{LAYOUT_NAVBAR_CHECKED}}>
                        <div class="te-layout-preview te-layout-navbar">
                            <div class="te-layout-header"></div>
                            <div class="te-layout-content"></div>
                        </div>
                        <span class="te-layout-name">Navbar</span>
                        <span class="te-layout-desc">Horizontal navigation at the top</span>
                    </label>
                    <label class="te-layout-option {{LAYOUT_FLOATING_ACTIVE}}">
                        <input type="radio" name="layout_type" data-path="layout.layout_type" value="floating" {{LAYOUT_FLOATING_CHECKED}}>
                        <div class="te-layout-preview te-layout-floating">
                            <div class="te-layout-sidebar-float"></div>
                            <div class="te-layout-content"></div>
                        </div>
                        <span class="te-layout-name">Floating Sidebar</span>
                        <span class="te-layout-desc">Floating sidebar with rounded edges</span>
                    </label>
                    <label class="te-layout-option {{LAYOUT_BOTTOMBAR_ACTIVE}}">
                        <input type="radio" name="layout_type" data-path="layout.layout_type" value="bottombar" {{LAYOUT_BOTTOMBAR_CHECKED}}>
                        <div class="te-layout-preview te-layout-bottombar">
                            <div class="te-layout-content"></div>
                            <div class="te-layout-footer"></div>
                        </div>
                        <span class="te-layout-name">Bottom Bar</span>
                        <span class="te-layout-desc">Navigation pinned at the bottom</span>
                    </label>
                </div>
            </div>
        </div>
    </div>

    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Content Width</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Max Width</label>
                <p class="te-help-text">Controls the maximum width of the main content area. Default is 1200px.</p>
                <div class="te-slider-row">
                    <input type="range" min="800" max="1920" step="10" value="{{CONTENT_MAX_WIDTH}}" data-path="layout.content_max_width" class="te-slider">
                    <span class="te-slider-value">{{CONTENT_MAX_WIDTH}}px</span>
                </div>
            </div>
        </div>
    </div>

    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Server List Layout</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Card Style</label>
                <div class="te-layout-grid">
                    <label class="te-layout-option {{SERVER_LIST_ACTIVE}}">
                        <input type="radio" name="server_list_layout" data-path="layout.server_list_layout" value="list" {{SERVER_LIST_CHECKED}}>
                        <div class="te-layout-preview te-layout-list">
                            <div class="te-layout-card"></div>
                            <div class="te-layout-card"></div>
                        </div>
                        <span class="te-layout-name">Stacked (Default)</span>
                        <span class="te-layout-desc">Full-width cards</span>
                    </label>
                    <label class="te-layout-option {{SERVER_GRID2_ACTIVE}}">
                        <input type="radio" name="server_list_layout" data-path="layout.server_list_layout" value="grid2" {{SERVER_GRID2_CHECKED}}>
                        <div class="te-layout-preview te-layout-grid2">
                            <div class="te-layout-card"></div>
                            <div class="te-layout-card"></div>
                            <div class="te-layout-card"></div>
                            <div class="te-layout-card"></div>
                        </div>
                        <span class="te-layout-name">2 Column Grid</span>
                        <span class="te-layout-desc">Two cards per row</span>
                    </label>
                    <label class="te-layout-option {{SERVER_GRID3_ACTIVE}}">
                        <input type="radio" name="server_list_layout" data-path="layout.server_list_layout" value="grid3" {{SERVER_GRID3_CHECKED}}>
                        <div class="te-layout-preview te-layout-grid3">
                            <div class="te-layout-card"></div>
                            <div class="te-layout-card"></div>
                            <div class="te-layout-card"></div>
                            <div class="te-layout-card"></div>
                            <div class="te-layout-card"></div>
                            <div class="te-layout-card"></div>
                        </div>
                        <span class="te-layout-name">3 Column Grid</span>
                        <span class="te-layout-desc">Three cards per row</span>
                    </label>
                </div>
            </div>
        </div>
    </div>

    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Auth Pages Background</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Background Image</label>
                <p class="te-help-text">Applies to login, registration, password reset, and two-factor pages.</p>
                <div class="te-login-bg-upload">
                    <div class="te-login-bg-upload-zone {{AUTH_BG_HAS_IMAGE}}">
                        <input type="file" accept="image/*" data-upload-path="layout.auth_background_image">
                        <div class="te-login-bg-upload-content">
                            <i class="fa fa-cloud-upload"></i>
                            <span>Drop image or click to upload</span>
                        </div>
                    </div>
                    <div class="te-login-bg-preview {{AUTH_BG_IMAGE_PREVIEW_VISIBLE}}">
                        <img src="{{AUTH_BG_IMAGE_URL}}">
                        <label class="te-login-bg-replace">
                            <input type="file" accept="image/*" data-upload-path="layout.auth_background_image">
                            <i class="fa fa-upload"></i>
                            <span>Replace Image</span>
                        </label>
                    </div>
                    <input type="hidden" data-path="layout.auth_background_image" value="{{AUTH_BG_IMAGE_URL}}">
                </div>
            </div>
            <div class="te-field">
                <label class="te-label">Overlay Darkness</label>
                <p class="te-help-text">Controls how dark the overlay appears over the auth background image.</p>
                <div class="te-slider-row">
                    <input type="range" min="0" max="100" step="5" value="{{AUTH_BG_OVERLAY_OPACITY}}" data-path="layout.auth_background_overlay" data-suffix="%" class="te-slider">
                    <span class="te-slider-value">{{AUTH_BG_OVERLAY_OPACITY}}%</span>
                </div>
            </div>
        </div>
    </div>

    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Home Page Background</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Background Image</label>
                <p class="te-help-text">Applies to the logged-in home page where servers and folders are listed.</p>
                <div class="te-login-bg-upload">
                    <div class="te-login-bg-upload-zone {{DASHBOARD_BG_HAS_IMAGE}}">
                        <input type="file" accept="image/*" data-upload-path="layout.dashboard_background_image">
                        <div class="te-login-bg-upload-content">
                            <i class="fa fa-cloud-upload"></i>
                            <span>Drop image or click to upload</span>
                        </div>
                    </div>
                    <div class="te-login-bg-preview {{DASHBOARD_BG_IMAGE_PREVIEW_VISIBLE}}">
                        <img src="{{DASHBOARD_BG_IMAGE_URL}}">
                        <label class="te-login-bg-replace">
                            <input type="file" accept="image/*" data-upload-path="layout.dashboard_background_image">
                            <i class="fa fa-upload"></i>
                            <span>Replace Image</span>
                        </label>
                    </div>
                    <input type="hidden" data-path="layout.dashboard_background_image" value="{{DASHBOARD_BG_IMAGE_URL}}">
                </div>
            </div>
            <div class="te-field">
                <label class="te-label">Overlay Darkness</label>
                <p class="te-help-text">Controls how dark the overlay appears over the home page background image.</p>
                <div class="te-slider-row">
                    <input type="range" min="0" max="100" step="5" value="{{DASHBOARD_BG_OVERLAY_OPACITY}}" data-path="layout.dashboard_background_overlay" data-suffix="%" class="te-slider">
                    <span class="te-slider-value">{{DASHBOARD_BG_OVERLAY_OPACITY}}%</span>
                </div>
            </div>
        </div>
    </div>

    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Server Page Background</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Background Style</label>
                <div class="te-layout-grid te-layout-grid-2">
                    <label class="te-layout-option {{SERVER_BG_NONE_ACTIVE}}">
                        <input type="radio" name="server_background_type" data-path="layout.server_background_type" value="none" {{SERVER_BG_NONE_CHECKED}}>
                        <div class="te-layout-preview te-server-bg-preview te-server-bg-none">
                        </div>
                        <span class="te-layout-name">Solid Background</span>
                        <span class="te-layout-desc">Uses theme background colour</span>
                    </label>
                    <label class="te-layout-option {{SERVER_BG_IMAGE_ACTIVE}}">
                        <input type="radio" name="server_background_type" data-path="layout.server_background_type" value="image" {{SERVER_BG_IMAGE_CHECKED}}>
                        <div class="te-layout-preview te-server-bg-preview te-server-bg-image">
                            <div class="te-sbg-image-layer"></div>
                        </div>
                        <span class="te-layout-name">Background Image</span>
                        <span class="te-layout-desc">Custom image with overlay</span>
                    </label>
                </div>
            </div>
            <div class="te-server-bg-settings {{SERVER_BG_SETTINGS_VISIBLE}}">
                <div class="te-field" style="margin-top: 16px;">
                    <label class="te-label">Image Source</label>
                    <div class="te-layout-grid te-layout-grid-2">
                        <label class="te-layout-option te-layout-option-sm {{SERVER_BG_SRC_CUSTOM_ACTIVE}}">
                            <input type="radio" name="server_background_source" data-path="layout.server_background_source" value="custom" {{SERVER_BG_SRC_CUSTOM_CHECKED}}>
                            <div class="te-layout-preview te-sbg-src-preview te-sbg-src-custom">
                                <i class="fa fa-image"></i>
                            </div>
                            <span class="te-layout-name">Custom Image</span>
                            <span class="te-layout-desc">Upload your own image</span>
                        </label>
                        <label class="te-layout-option te-layout-option-sm {{SERVER_BG_SRC_EGG_ACTIVE}}">
                            <input type="radio" name="server_background_source" data-path="layout.server_background_source" value="egg" {{SERVER_BG_SRC_EGG_CHECKED}}>
                            <div class="te-layout-preview te-sbg-src-preview te-sbg-src-egg">
                                <i class="fa fa-th-large"></i>
                            </div>
                            <span class="te-layout-name">Egg Image</span>
                            <span class="te-layout-desc">Use server's egg image</span>
                        </label>
                    </div>
                </div>
                <div class="te-server-bg-custom-fields {{SERVER_BG_CUSTOM_VISIBLE}}">
                    <div class="te-field" style="margin-top: 16px;">
                        <label class="te-label">Background Image</label>
                        <div class="te-login-bg-upload">
                            <div class="te-login-bg-upload-zone {{SERVER_BG_HAS_IMAGE}}">
                                <input type="file" accept="image/*" data-upload-path="layout.server_background_image">
                                <div class="te-login-bg-upload-content">
                                    <i class="fa fa-cloud-upload"></i>
                                    <span>Drop image or click to upload</span>
                                </div>
                            </div>
                            <div class="te-login-bg-preview {{SERVER_BG_IMAGE_PREVIEW_VISIBLE}}">
                                <img src="{{SERVER_BG_IMAGE_URL}}">
                                <label class="te-login-bg-replace">
                                    <input type="file" accept="image/*" data-upload-path="layout.server_background_image">
                                    <i class="fa fa-upload"></i>
                                    <span>Replace Image</span>
                                </label>
                            </div>
                            <input type="hidden" data-path="layout.server_background_image" value="{{SERVER_BG_IMAGE_URL}}">
                        </div>
                    </div>
                </div>
                <div class="te-field" style="margin-top: 16px;">
                    <label class="te-label">Overlay Opacity</label>
                    <p class="te-help-text">Controls how dark the overlay appears over the background image. Higher values make text more readable.</p>
                    <div class="te-slider-row">
                        <input type="range" min="0" max="100" step="5" value="{{SERVER_BG_OVERLAY_OPACITY}}" data-path="layout.server_background_overlay" data-suffix="%" class="te-slider">
                        <span class="te-slider-value">{{SERVER_BG_OVERLAY_OPACITY}}%</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Navigation</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Show Dashboard Link</label>
                <div class="te-toggle-field">
                    <label class="te-toggle">
                        <input type="checkbox" data-path="layout.show_dashboard" data-checked="{{SHOW_DASHBOARD_CHECKED}}">
                        <span class="te-toggle-slider"></span>
                    </label>
                    <span class="te-toggle-label">Show the Dashboard link in the sidebar. When hidden, the main server page will be replaced with the Console page.</span>
                </div>
            </div>
        </div>
    </div>

    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Dashboard quick actions</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Items</label>
                <p class="te-help-text">Up to 4 items. Use icon keys like <strong>terminal</strong>, <strong>files</strong>, <strong>backups</strong>, <strong>settings</strong>. Links can be relative (e.g. <strong>/files</strong>) or absolute URLs. You can use <strong>{serverId}</strong> in links.</p>
                <div class="te-repeater" id="quickActionsContainer">
                    {{QUICK_ACTIONS}}
                    <div class="te-repeater-actions">
                        <button class="te-btn te-btn-secondary te-btn-sm" data-repeater-add="layout.dashboard_quick_actions" {{ADD_QUICK_ACTION_DISABLED}}>{{ICON_PLUS}} Add quick action</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

</template>
@endverbatim
