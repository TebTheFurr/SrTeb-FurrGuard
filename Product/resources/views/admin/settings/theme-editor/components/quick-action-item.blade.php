@verbatim
<template id="te-quick-action-item">
    <div class="te-repeater-item">
        <div class="te-repeater-item-header">
            <span class="te-repeater-item-title">Quick action {{INDEX_DISPLAY}}</span>
            <button class="te-repeater-remove" data-repeater-remove="layout.dashboard_quick_actions" data-index="{{INDEX}}" title="Remove">{{ICON_CLOSE}}</button>
        </div>
        <div class="te-repeater-grid te-repeater-grid-2">
            <div class="te-field">
                <label class="te-label">Title</label>
                <input type="text" class="te-input" data-path="layout.dashboard_quick_actions.{{INDEX}}.title" value="{{TITLE}}" placeholder="Console">
            </div>
            <div class="te-field">
                <label class="te-label">Link</label>
                <input type="text" class="te-input" data-path="layout.dashboard_quick_actions.{{INDEX}}.link" value="{{LINK}}" placeholder="/console">
            </div>
        </div>
        <div class="te-field" style="margin-top: 8px;">
            <label class="te-label">Icon</label>
            <div class="te-icon-picker" data-path="layout.dashboard_quick_actions.{{INDEX}}.icon" data-value="{{ICON}}">
                <button type="button" class="te-icon-picker-trigger">
                    <i class="fa fa-{{ICON}}"></i>
                    <span>{{ICON_DISPLAY}}</span>
                    <i class="fa fa-chevron-down te-icon-picker-arrow"></i>
                </button>
                <div class="te-icon-picker-dropdown">
                    <input type="text" class="te-icon-picker-search" placeholder="Search icons...">
                    <div class="te-icon-picker-list"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<template id="te-repeater-empty">
    <div class="te-repeater-empty">{{MESSAGE}}</div>
</template>
@endverbatim
