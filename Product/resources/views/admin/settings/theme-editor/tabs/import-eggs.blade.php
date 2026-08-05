@verbatim
<template id="te-tab-import-eggs">
    <div class="te-mass-eggs-page">
        <div class="te-mass-eggs-header">
            <div class="te-mass-eggs-title-wrap">
                <h2 class="te-mass-eggs-title">Import eggs</h2>
                <p class="te-mass-eggs-subtitle">Install from the public catalogue or import local egg JSON files in bulk.</p>
            </div>
            <div class="te-mass-eggs-header-actions">
                <button class="te-btn te-btn-primary" data-mass-eggs-open-import>
                    <i class="fa fa-upload"></i>
                    Import eggs
                </button>
                <button class="te-btn te-btn-secondary" data-mass-eggs-refresh>
                    <i class="fa fa-refresh"></i>
                    Refresh
                </button>
            </div>
        </div>

        {{STATUS_BANNER}}

        <div class="te-mass-eggs-toolbar">
            <div class="te-mass-eggs-search">
                <i class="fa fa-search"></i>
                <input type="text" class="te-input" placeholder="Search eggs..." data-mass-egg-search value="{{SEARCH_VALUE}}">
            </div>
            <select class="te-input te-mass-eggs-category" data-mass-egg-category>
                {{CATEGORY_OPTIONS}}
            </select>
            <select class="te-input te-mass-eggs-nest" data-mass-egg-nest>
                {{NEST_OPTIONS}}
            </select>
        </div>

        <div class="te-mass-eggs-section">
            <div class="te-mass-eggs-section-header">
                <span class="te-mass-eggs-section-title">One-click install</span>
                <span class="te-mass-eggs-section-meta">{{RESULT_COUNT}}</span>
            </div>
            <div class="te-mass-eggs-grid">
                {{EGG_CARDS}}
            </div>
        </div>
    </div>
</template>

<template id="te-mass-eggs-import-modal">
    <div class="te-modal-overlay" data-modal="mass-eggs-import">
        <div class="te-modal te-mass-eggs-import-modal">
            <div class="te-modal-header">
                <span class="te-modal-title">Import eggs</span>
                <button class="te-modal-close" type="button" data-mass-eggs-close-import>
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="te-modal-body te-mass-eggs-import-modal-body">
                <p class="te-mass-eggs-import-modal-copy">Upload one or more egg JSON files and choose the nest they should be imported into.</p>
                <div class="te-mass-eggs-import-fields">
                    <input type="file" class="te-input" multiple accept=".json,application/json" data-mass-eggs-files>
                    <select class="te-input" data-mass-eggs-import-nest>
                        {{IMPORT_NEST_OPTIONS}}
                    </select>
                </div>
            </div>
            <div class="te-modal-footer">
                <button class="te-btn te-btn-secondary" type="button" data-mass-eggs-close-import>Cancel</button>
                <button class="te-btn te-btn-primary" type="button" data-mass-eggs-import-submit>
                    <i class="fa fa-upload"></i>
                    Import selected files
                </button>
            </div>
        </div>
    </div>
</template>

<template id="te-mass-eggs-error">
    <div class="te-mass-eggs-banner te-mass-eggs-banner-error">
        <i class="fa fa-exclamation-triangle"></i>
        <span>{{ERROR_TEXT}}</span>
    </div>
</template>

<template id="te-mass-eggs-loading">
</template>

<template id="te-mass-eggs-empty">
    <div class="te-mass-eggs-empty">
        <i class="fa fa-cube"></i>
        <p>No eggs found for this filter.</p>
    </div>
</template>
@endverbatim
