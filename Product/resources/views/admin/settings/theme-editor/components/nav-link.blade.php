@verbatim
<template id="te-nav-link">
    <div class="te-nav-link-item te-nav-link-card" data-cat-index="{{CAT_INDEX}}" data-link-index="{{LINK_INDEX}}">
        <div class="te-nav-link-row">
            <span class="te-drag-handle te-nav-link-drag" data-drag-handle="nav-link" draggable="true" title="Drag to reorder"><i class="fa fa-bars"></i></span>
            <div class="te-nav-link-icon-preview">
                <i class="fa fa-{{ICON}}"></i>
            </div>
            <div class="te-nav-link-main">
                <input type="text" class="te-nav-link-label-input" data-path="layout.nav_links.categories.{{CAT_INDEX}}.links.{{LINK_INDEX}}.label" value="{{LABEL}}" placeholder="Link label">
            </div>
            <div class="te-nav-link-actions">
                <button class="te-nav-link-expand-btn" data-toggle-link="{{CAT_INDEX}}-{{LINK_INDEX}}" title="Settings">
                    <i class="fa fa-cog"></i>
                </button>
                <button class="te-nav-link-action-btn te-nav-link-delete-btn-inline" data-nav-action="remove-link" data-cat-index="{{CAT_INDEX}}" data-link-index="{{LINK_INDEX}}" title="Delete link">
                    <i class="fa fa-trash"></i>
                </button>
                <label class="te-toggle te-toggle-sm">
                    <input type="checkbox" data-path="layout.nav_links.categories.{{CAT_INDEX}}.links.{{LINK_INDEX}}.enabled" data-checked="{{ENABLED_CHECKED}}">
                    <span class="te-toggle-slider"></span>
                </label>
            </div>
        </div>
        <div class="te-nav-link-details" data-link-details="{{CAT_INDEX}}-{{LINK_INDEX}}">
            <div class="te-nav-link-details-grid">
                <div class="te-nav-link-field">
                    <label>Icon</label>
                    <div class="te-icon-picker" data-path="layout.nav_links.categories.{{CAT_INDEX}}.links.{{LINK_INDEX}}.icon" data-value="{{ICON}}">
                        <button type="button" class="te-icon-picker-trigger">
                            <i class="fa fa-{{ICON}}"></i>
                            <span>{{ICON}}</span>
                            <i class="fa fa-chevron-down te-icon-picker-arrow"></i>
                        </button>
                        <div class="te-icon-picker-dropdown">
                            <input type="text" class="te-icon-picker-search" placeholder="Search icons...">
                            <div class="te-icon-picker-list"></div>
                        </div>
                    </div>
                </div>
                <div class="te-nav-link-field">
                    <label>URL Path</label>
                    <input type="text" class="te-input te-input-sm" data-path="layout.nav_links.categories.{{CAT_INDEX}}.links.{{LINK_INDEX}}.link" value="{{LINK}}" placeholder="/console or https://...">
                </div>
                <div class="te-nav-link-field">
                    <label>Permission</label>
                    <div class="te-permission-picker" data-path="layout.nav_links.categories.{{CAT_INDEX}}.links.{{LINK_INDEX}}.permission" data-value="{{PERMISSION}}">
                        <button type="button" class="te-permission-picker-trigger">
                            <span>{{PERMISSION_LABEL}}</span>
                            <i class="fa fa-chevron-down te-permission-picker-arrow"></i>
                        </button>
                        <div class="te-permission-picker-dropdown">
                            <input type="text" class="te-permission-picker-search" placeholder="Search permissions...">
                            <div class="te-permission-picker-list"></div>
                        </div>
                    </div>
                </div>
                <div class="te-nav-link-field">
                    <label>Open in</label>
                    <div class="te-egg-toggle-group-sm">
                        <button type="button" class="te-egg-toggle-sm {{OPEN_SAME_TAB_ACTIVE}}" data-open-tab-action="same" data-cat-index="{{CAT_INDEX}}" data-link-index="{{LINK_INDEX}}">Same Tab</button>
                        <button type="button" class="te-egg-toggle-sm {{OPEN_NEW_TAB_ACTIVE}}" data-open-tab-action="new" data-cat-index="{{CAT_INDEX}}" data-link-index="{{LINK_INDEX}}">New Tab</button>
                    </div>
                </div>
            </div>
            <div class="te-nav-link-egg-section">
                <div class="te-nav-link-egg-header">
                    <span>Visibility</span>
                    <div class="te-egg-toggle-group-sm">
                        <button type="button" class="te-egg-toggle-sm {{EGG_MODE_ALL}}" data-egg-action="mode-all" data-cat-index="{{CAT_INDEX}}" data-link-index="{{LINK_INDEX}}">All</button>
                        <button type="button" class="te-egg-toggle-sm {{EGG_MODE_SOME}}" data-egg-action="mode-some" data-cat-index="{{CAT_INDEX}}" data-link-index="{{LINK_INDEX}}">By egg</button>
                    </div>
                </div>
                <div class="te-egg-list-compact {{EGG_LIST_VISIBLE}}" data-cat-index="{{CAT_INDEX}}" data-link-index="{{LINK_INDEX}}">
                    <input type="text" class="te-input te-input-sm te-egg-search" placeholder="Search eggs...">
                    <div class="te-egg-options-compact">{{EGG_OPTIONS}}</div>
                </div>
            </div>
        </div>
    </div>
</template>
@endverbatim

@verbatim
<template id="te-egg-filter-option">
    <label class="te-egg-option-compact">
        <input type="checkbox" data-egg-id="{{EGG_ID}}" data-cat-index="{{CAT_INDEX}}" data-link-index="{{LINK_INDEX}}" data-checked="{{EGG_CHECKED}}">
        <span class="te-egg-checkbox-sm"></span>
        <span class="te-egg-option-name-sm">{{EGG_NAME}}</span>
    </label>
</template>
@endverbatim
