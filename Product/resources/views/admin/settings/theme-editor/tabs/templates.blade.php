@verbatim
<template id="te-tab-templates">
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Server Templates</span>
            <button type="button" class="te-btn te-btn-primary" data-action="add-server-template">
                <i class="fa fa-plus"></i>
                Add Template
            </button>
        </div>
        <div class="te-section-content">
            <div class="te-template-list" id="serverTemplateList">
                {{TEMPLATE_LIST}}
            </div>
        </div>
    </div>
</template>

<template id="te-server-template-card">
    <div class="te-addon-card te-template-card" data-template-id="{{TEMPLATE_ID}}">
        <div class="te-addon-header">
            <div class="te-addon-info">
                <span class="te-addon-name"><i class="fa fa-clone"></i> {{TEMPLATE_NAME}}</span>
            </div>
            <span class="te-template-id-tag">ID #{{TEMPLATE_ID}}</span>
        </div>
        <p class="te-addon-description">{{TEMPLATE_DESCRIPTION}}</p>
        <div class="te-template-specs">
            <div class="te-template-spec"><i class="fa fa-microchip"></i><span>{{TEMPLATE_CPU}}% CPU</span></div>
            <div class="te-template-spec"><i class="fa fa-tachometer"></i><span>{{TEMPLATE_MEMORY}} MiB RAM</span></div>
            <div class="te-template-spec"><i class="fa fa-hdd-o"></i><span>{{TEMPLATE_DISK}} MiB Disk</span></div>
            <div class="te-template-spec"><i class="fa fa-database"></i><span>{{TEMPLATE_DATABASES}} Databases</span></div>
            <div class="te-template-spec"><i class="fa fa-archive"></i><span>{{TEMPLATE_BACKUPS}} Backups</span></div>
            <div class="te-template-spec"><i class="fa fa-sitemap"></i><span>{{TEMPLATE_ALLOCATIONS}} Allocations</span></div>
        </div>
        <div class="te-addon-footer">
            <span class="te-addon-author">Swap {{TEMPLATE_SWAP}} MiB &middot; IO {{TEMPLATE_IO}}</span>
            <div class="te-addon-actions">
                <button type="button" class="te-addon-icon-btn" data-action="edit-server-template" data-template-id="{{TEMPLATE_ID}}" title="Edit template">
                    <i class="fa fa-cog"></i>
                </button>
                <button type="button" class="te-addon-icon-btn te-addon-delete-btn" data-action="delete-server-template" data-template-id="{{TEMPLATE_ID}}" title="Delete template">
                    <i class="fa fa-trash"></i>
                </button>
            </div>
        </div>
    </div>
</template>

<template id="te-server-template-empty">
    <div class="te-addons-empty">
        <i class="fa fa-clone"></i>
        <p>No server templates have been created yet.</p>
    </div>
</template>

<template id="te-server-template-modal">
    <div class="te-modal-overlay visible" id="serverTemplateModal">
        <div class="te-modal te-template-modal">
            <div class="te-modal-header">
                <span class="te-modal-title">{{MODAL_TITLE}}</span>
            </div>
            <div class="te-modal-body">
                <div class="te-field">
                    <label class="te-label">Template Name</label>
                    <input type="text" class="te-input" data-template-field="name" value="{{TEMPLATE_NAME}}" placeholder="e.g. Minecraft Starter">
                    <p class="te-help-text">A friendly name shown when creating servers from this template.</p>
                </div>
                <div class="te-field">
                    <label class="te-label">Description</label>
                    <textarea class="te-input te-textarea" data-template-field="description" rows="2" placeholder="Optional description">{{TEMPLATE_DESCRIPTION}}</textarea>
                </div>
                <div class="te-field-grid">
                    <div class="te-field">
                        <label class="te-label">Nest (optional)</label>
                        <div class="te-select-wrap">
                            <select class="te-input te-select" data-template-field="nest_id" data-template-nest>
                                <option value="">No nest (choose during server creation)</option>
                                {{NEST_OPTIONS}}
                            </select>
                            <i class="fa fa-chevron-down te-select-icon"></i>
                        </div>
                        <p class="te-help-text">If set, servers using this template will use this nest.</p>
                    </div>
                    <div class="te-field">
                        <label class="te-label">Egg (optional)</label>
                        <div class="te-select-wrap">
                            <select class="te-input te-select" data-template-field="egg_id" data-template-egg>
                                <option value="">No egg (choose during server creation)</option>
                                {{EGG_OPTIONS}}
                            </select>
                            <i class="fa fa-chevron-down te-select-icon"></i>
                        </div>
                        <p class="te-help-text">If set, servers using this template will use this egg.</p>
                    </div>
                </div>
                <div class="te-field-grid">
                    <div class="te-field">
                        <label class="te-label">CPU Limit (%)</label>
                        <input type="number" class="te-input" data-template-field="cpu" value="{{TEMPLATE_CPU}}" min="0">
                    </div>
                    <div class="te-field">
                        <label class="te-label">CPU Pinning (threads)</label>
                        <input type="text" class="te-input" data-template-field="threads" value="{{TEMPLATE_THREADS}}" placeholder="e.g. 0-1,3">
                    </div>
                </div>
                <div class="te-field-grid">
                    <div class="te-field">
                        <label class="te-label">Memory (MiB)</label>
                        <input type="number" class="te-input" data-template-field="memory" value="{{TEMPLATE_MEMORY}}" min="0">
                    </div>
                    <div class="te-field">
                        <label class="te-label">Swap (MiB)</label>
                        <input type="number" class="te-input" data-template-field="swap" value="{{TEMPLATE_SWAP}}" min="-1">
                    </div>
                </div>
                <div class="te-field-grid">
                    <div class="te-field">
                        <label class="te-label">Disk Space (MiB)</label>
                        <input type="number" class="te-input" data-template-field="disk" value="{{TEMPLATE_DISK}}" min="0">
                    </div>
                    <div class="te-field">
                        <label class="te-label">Block IO Weight</label>
                        <input type="number" class="te-input" data-template-field="io" value="{{TEMPLATE_IO}}" min="10" max="1000">
                    </div>
                </div>
                <div class="te-field-grid">
                    <div class="te-field">
                        <label class="te-label">Database Limit</label>
                        <input type="number" class="te-input" data-template-field="database_limit" value="{{TEMPLATE_DATABASES}}" min="-1">
                    </div>
                    <div class="te-field">
                        <label class="te-label">Backup Limit</label>
                        <input type="number" class="te-input" data-template-field="backup_limit" value="{{TEMPLATE_BACKUPS}}" min="-1">
                    </div>
                </div>
                <div class="te-field-grid">
                    <div class="te-field">
                        <label class="te-label">Allocation Limit</label>
                        <input type="number" class="te-input" data-template-field="allocation_limit" value="{{TEMPLATE_ALLOCATIONS}}" min="-1">
                    </div>
                    <div class="te-field">
                        <label class="te-label">OOM Killer</label>
                        <div class="te-toggle-field">
                            <label class="te-toggle">
                                <input type="checkbox" data-template-field="oom_disabled" data-checked="{{TEMPLATE_OOM_CHECKED}}">
                                <span class="te-toggle-slider"></span>
                            </label>
                            <span class="te-toggle-label">Disable the OOM killer for servers using this template</span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="te-modal-footer">
                <button type="button" class="te-btn te-btn-secondary" data-action="close-server-template-modal">Cancel</button>
                <button type="button" class="te-btn te-btn-primary" data-action="save-server-template">Save Template</button>
            </div>
        </div>
    </div>
</template>
@endverbatim
