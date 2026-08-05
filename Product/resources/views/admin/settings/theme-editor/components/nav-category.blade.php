@verbatim
<template id="te-nav-category">
    <div class="te-nav-category te-nav-category-card" data-cat-index="{{CAT_INDEX}}">
        <div class="te-nav-category-header" data-toggle-category="{{CAT_INDEX}}">
            <div class="te-nav-category-left">
                <span class="te-drag-handle te-nav-category-drag" data-drag-handle="category" draggable="true" title="Drag to reorder" onclick="event.stopPropagation()"><i class="fa fa-bars"></i></span>
                <span class="te-nav-category-chevron"><i class="fa fa-chevron-right"></i></span>
                <input type="text" class="te-nav-category-title te-nav-category-label-input" data-path="layout.nav_links.categories.{{CAT_INDEX}}.label" value="{{LABEL}}" placeholder="Category name" onclick="event.stopPropagation()">
                <span class="te-nav-category-count">{{LINK_COUNT}} links</span>
            </div>
            <div class="te-nav-category-right">
                <label class="te-toggle te-toggle-sm" onclick="event.stopPropagation()">
                    <input type="checkbox" data-path="layout.nav_links.categories.{{CAT_INDEX}}.enabled" data-checked="{{ENABLED_CHECKED}}">
                    <span class="te-toggle-slider"></span>
                </label>
            </div>
        </div>
        <div class="te-nav-category-body">
            {{NAV_LINKS}}
            <button class="te-nav-add-link-btn" data-nav-action="add-link" data-cat-index="{{CAT_INDEX}}">
                {{ICON_PLUS}} Add link
            </button>
            <div class="te-nav-category-footer">
                <button class="te-nav-category-delete-btn" data-nav-action="delete-category" data-cat-index="{{CAT_INDEX}}" data-cat-label="{{LABEL}}">
                    <i class="fa fa-trash"></i> Delete category
                </button>
            </div>
        </div>
    </div>
</template>
@endverbatim
