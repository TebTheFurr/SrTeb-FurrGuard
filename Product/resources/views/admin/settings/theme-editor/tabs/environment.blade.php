@verbatim
<template id="te-tab-environment">
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Environment Variables</span>
            {{ADD_BUTTON}}
        </div>
        <div class="te-section-content">
            {{READONLY_WARNING}}
            <p class="te-help-text" style="margin-bottom: 16px;">Manage your application's environment variables. Be careful when modifying these values as incorrect settings can break your installation.</p>
            <div class="te-env-search-wrapper">
                <input type="text" class="te-input te-env-search" placeholder="Search variables..." data-env-search>
            </div>
            <div class="te-env-list" id="envVarsList">
                {{ENV_VARS_LIST}}
            </div>
        </div>
    </div>
</template>

<template id="te-env-readonly-warning">
    <div class="te-env-readonly-warning">
        <i class="fa fa-exclamation-triangle"></i>
        <span>The .env file is not writable. To enable editing, update file permissions on your server.</span>
    </div>
</template>

<template id="te-env-var-item">
    <div class="te-env-item" data-env-key="{{KEY}}">
        <div class="te-env-item-header">
            <span class="te-env-key">{{KEY}}</span>
            <div class="te-env-actions">
                {{EDIT_BUTTON}}
                {{DELETE_BUTTON}}
            </div>
        </div>
        <div class="te-env-item-value">
            <code class="te-env-value {{SENSITIVE_CLASS}}">{{VALUE}}</code>
        </div>
    </div>
</template>

<template id="te-env-edit-button">
    <button class="te-env-action-btn" data-env-edit="{{KEY}}" title="Edit">
        <i class="fa fa-pencil"></i>
    </button>
</template>

<template id="te-env-delete-button">
    <button class="te-env-action-btn te-env-action-btn-danger" data-env-delete="{{KEY}}" title="Delete">
        <i class="fa fa-trash"></i>
    </button>
</template>

<template id="te-env-protected-badge">
    <span class="te-env-protected-badge">Protected</span>
</template>

<template id="te-env-loading">
    <div class="te-env-loading">
        <div class="te-env-loading-spinner"></div>
        <span>Loading environment variables...</span>
    </div>
</template>

<template id="te-env-empty">
    <div class="te-env-empty">
        <i class="fa fa-file-code-o"></i>
        <span>No environment variables found</span>
    </div>
</template>

<template id="te-env-modal">
    <div class="te-env-modal-content">
        <div class="te-env-modal-header">
            <span class="te-env-modal-title">{{MODAL_TITLE}}</span>
        </div>
        <div class="te-env-modal-body">
            <div class="te-field">
                <label class="te-label">Variable Name</label>
                <input type="text" class="te-input te-env-key-input" id="envKeyInput" placeholder="MY_VARIABLE" value="{{KEY_VALUE}}" {{KEY_DISABLED}}>
                <p class="te-help-text">Use uppercase letters, numbers, and underscores only.</p>
            </div>
            <div class="te-field">
                <label class="te-label">Value</label>
                <textarea class="te-input te-env-value-input" id="envValueInput" rows="3" placeholder="Enter value...">{{VALUE_VALUE}}</textarea>
            </div>
        </div>
        <div class="te-env-modal-footer">
            <button class="te-btn te-btn-secondary" data-env-modal-cancel>Cancel</button>
            <button class="te-btn te-btn-primary" data-env-modal-save>{{SAVE_BUTTON_TEXT}}</button>
        </div>
    </div>
</template>
@endverbatim
