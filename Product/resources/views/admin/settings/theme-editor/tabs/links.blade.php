@verbatim
<template id="te-tab-links">
    <div class="te-links-page">
        <div class="te-links-editor">
            <div class="te-links-editor-header">
                <div class="te-links-editor-title">Navigation Links</div>
                <div class="te-links-editor-subtitle">Configure sidebar and navbar links for server and home pages</div>
            </div>
            <div class="te-links-editor-content" id="linksEditorContent">
                <div class="te-links-mode-selector">
                    <button class="te-links-mode-btn {{SERVER_LINKS_ACTIVE}}" data-links-mode="server">
                        <i class="fa fa-terminal"></i>
                        Server Links
                    </button>
                    <button class="te-links-mode-btn {{DASHBOARD_LINKS_ACTIVE}}" data-links-mode="dashboard">
                        <i class="fa fa-server"></i>
                        Dashboard Links
                    </button>
                    <button class="te-links-mode-btn {{ACCOUNT_LINKS_ACTIVE}}" data-links-mode="account">
                        <i class="fa fa-user-circle"></i>
                        Account Links
                    </button>
                </div>
                <div class="te-nav-editor {{SERVER_LINKS_EDITOR_VISIBLE}}" id="navCategoriesContainer">
                    {{NAV_CATEGORIES}}
                    <button class="te-nav-add-category-btn" data-nav-action="add-category">
                        {{ICON_PLUS}} Add category
                    </button>
                    <div class="te-nav-editor-footer">
                        <button class="te-nav-reset-btn" data-nav-action="reset-defaults">{{ICON_REFRESH}} Reset to defaults</button>
                    </div>
                </div>
                <div class="te-custom-links-editor {{DASHBOARD_LINKS_EDITOR_VISIBLE}}">
                    <p class="te-custom-links-desc">Add custom navigation links that appear below "Servers" on the home page.</p>
                    <div class="te-custom-links-list">
                        {{DASHBOARD_CUSTOM_LINKS}}
                    </div>
                    <button class="te-custom-link-add-btn" data-custom-link-action="add" data-link-type="dashboard">
                        {{ICON_PLUS}} Add dashboard link
                    </button>
                </div>
                <div class="te-custom-links-editor {{ACCOUNT_LINKS_EDITOR_VISIBLE}}">
                    <p class="te-custom-links-desc">Add navigation links that appear in the account page sidebar.</p>
                    <div class="te-custom-links-list">
                        {{ACCOUNT_CUSTOM_LINKS}}
                    </div>
                    <button class="te-custom-link-add-btn" data-custom-link-action="add" data-link-type="account">
                        {{ICON_PLUS}} Add account link
                    </button>
                </div>
            </div>
        </div>
        <div class="te-links-preview">
            <div class="te-links-preview-header">
                <div class="te-links-preview-title">Live Preview</div>
                <div class="te-links-preview-controls {{EGG_SELECTOR_VISIBLE}}">
                    <div class="te-links-egg-selector te-select-wrap">
                        <label>Preview as egg:</label>
                        <select id="linksPreviewEgg">
                            {{EGG_OPTIONS}}
                        </select>
                        <i class="fa fa-chevron-down te-select-icon"></i>
                    </div>
                </div>
            </div>
            <div class="te-links-preview-container" id="linksPreviewContainer">
                {{PREVIEW_HTML}}
            </div>
        </div>
    </div>
</template>
@endverbatim
