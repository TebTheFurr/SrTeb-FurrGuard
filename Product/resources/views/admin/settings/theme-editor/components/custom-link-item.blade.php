@verbatim
<template id="te-custom-link-item">
    <div class="te-custom-link-item" data-link-index="{{LINK_INDEX}}">
        <div class="te-custom-link-row">
            <span class="te-drag-handle te-custom-link-drag" data-drag-handle="custom-link" draggable="true" title="Drag to reorder"><i class="fa fa-bars"></i></span>
            <div class="te-custom-link-icon-preview">
                <i class="fa fa-{{ICON}}"></i>
            </div>
            <div class="te-custom-link-main">
                <input type="text" class="te-custom-link-label-input" data-path="layout.{{PATH_PREFIX}}.{{LINK_INDEX}}.label" value="{{LABEL}}" placeholder="Link label">
            </div>
            <div class="te-custom-link-actions">
                <button class="te-custom-link-expand-btn" data-toggle-custom-link="{{LINK_INDEX}}" title="Settings">
                    <i class="fa fa-ellipsis-v"></i>
                </button>
            </div>
        </div>
        <div class="te-custom-link-details" data-custom-link-details="{{LINK_INDEX}}">
            <div class="te-custom-link-details-grid">
                <div class="te-custom-link-field">
                    <label class="te-label te-label-sm">Icon</label>
                    <div class="te-icon-picker" data-path="layout.{{PATH_PREFIX}}.{{LINK_INDEX}}.icon" data-value="{{ICON}}">
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
                <div class="te-custom-link-field">
                    <label class="te-label te-label-sm">URL</label>
                    <input type="text" class="te-input te-input-sm" data-path="layout.{{PATH_PREFIX}}.{{LINK_INDEX}}.url" value="{{URL}}" placeholder="https://example.com or /path">
                </div>
                <div class="te-custom-link-field">
                    <label class="te-label te-label-sm">Open in</label>
                    <div class="te-egg-toggle-group-sm">
                        <button type="button" class="te-egg-toggle-sm {{OPEN_SAME_TAB_ACTIVE}}" data-custom-open-tab-action="same" data-link-index="{{LINK_INDEX}}" data-path-prefix="{{PATH_PREFIX}}">Same Tab</button>
                        <button type="button" class="te-egg-toggle-sm {{OPEN_NEW_TAB_ACTIVE}}" data-custom-open-tab-action="new" data-link-index="{{LINK_INDEX}}" data-path-prefix="{{PATH_PREFIX}}">New Tab</button>
                    </div>
                </div>
            </div>
            <div class="te-custom-link-footer">
                <button class="te-custom-link-delete-btn" data-custom-link-action="remove" data-link-index="{{LINK_INDEX}}">
                    {{ICON_CLOSE}} Remove link
                </button>
            </div>
        </div>
    </div>
</template>
@endverbatim
