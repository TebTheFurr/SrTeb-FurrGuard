@verbatim
<template id="te-tab-oauth">
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">OAuth Providers</span>
            <button type="button" class="te-btn te-btn-primary" data-action="add-oauth-provider">
                <i class="fa fa-plus"></i>
                Add Provider
            </button>
        </div>
        <div class="te-section-content">
            <p class="te-help-text" style="margin-bottom: 16px;">Choose a supported provider, add the client credentials, then copy the callback URL into that provider's OAuth app settings.</p>
            <div class="te-oauth-provider-list" id="oauthProviderList">
                {{OAUTH_PROVIDER_LIST}}
            </div>
        </div>
    </div>
</template>

<template id="te-oauth-provider-card">
    <div class="te-addon-card te-oauth-provider-card" data-provider-id="{{PROVIDER_ID}}">
        <div class="te-addon-header">
            <div class="te-addon-info">
                <span class="te-addon-name"><i class="fa fa-{{PROVIDER_ICON}}"></i> {{PROVIDER_NAME}}</span>
            </div>
            <div class="te-addon-status {{STATUS_CLASS}}">{{STATUS_TEXT}}</div>
        </div>
        <p class="te-addon-description">{{PROVIDER_TYPE}}</p>
        <div class="te-oauth-callback-row">
            <span>Callback URL</span>
            <code>{{CALLBACK_URL}}</code>
            <button type="button" class="te-addon-icon-btn" data-action="copy-oauth-callback" data-callback-url="{{CALLBACK_URL}}" title="Copy callback URL">
                <i class="fa fa-copy"></i>
            </button>
        </div>
        <div class="te-addon-footer">
            <span class="te-addon-author">{{CLIENT_STATUS}}</span>
            <div class="te-addon-actions">
                <button type="button" class="te-addon-icon-btn" data-action="move-oauth-provider-up" data-provider-id="{{PROVIDER_ID}}" title="Move up">
                    <i class="fa fa-chevron-up"></i>
                </button>
                <button type="button" class="te-addon-icon-btn" data-action="move-oauth-provider-down" data-provider-id="{{PROVIDER_ID}}" title="Move down">
                    <i class="fa fa-chevron-down"></i>
                </button>
                <button type="button" class="te-addon-icon-btn" data-action="edit-oauth-provider" data-provider-id="{{PROVIDER_ID}}" title="Edit provider">
                    <i class="fa fa-cog"></i>
                </button>
                <button type="button" class="te-addon-icon-btn te-addon-delete-btn" data-action="delete-oauth-provider" data-provider-id="{{PROVIDER_ID}}" title="Delete provider">
                    <i class="fa fa-trash"></i>
                </button>
            </div>
        </div>
    </div>
</template>

<template id="te-oauth-empty">
    <div class="te-addons-empty">
        <i class="fa fa-key"></i>
        <p>No OAuth providers have been created yet.</p>
    </div>
</template>

<template id="te-oauth-provider-modal">
    <div class="te-modal-overlay visible" id="oauthProviderModal">
        <div class="te-modal te-oauth-modal">
            <div class="te-modal-header">
                <span class="te-modal-title">{{MODAL_TITLE}}</span>
            </div>
            <div class="te-modal-body">
                <div class="te-field">
                    <label class="te-label">Provider</label>
                    <div class="te-select-wrap">
                        <select class="te-input te-select" data-oauth-field="provider_type" {{PROVIDER_TYPE_DISABLED}}>
                            {{PROVIDER_TYPE_OPTIONS}}
                        </select>
                        <i class="fa fa-chevron-down te-select-icon"></i>
                    </div>
                    <p class="te-help-text">{{PROVIDER_TYPE_HELP}}</p>
                </div>
                <div class="te-field-grid">
                    <div class="te-field">
                        <label class="te-label">Client ID</label>
                        <input type="text" class="te-input" data-oauth-field="client_id" value="{{CLIENT_ID}}" placeholder="{{CLIENT_ID_PLACEHOLDER}}">
                    </div>
                    <div class="te-field">
                        <label class="te-label">Client Secret</label>
                        <input type="password" class="te-input" data-oauth-field="client_secret" value="" placeholder="{{CLIENT_SECRET_PLACEHOLDER}}">
                    </div>
                </div>
                <div class="te-field">
                    <label class="te-label">Callback URL</label>
                    <div class="te-oauth-copy-field">
                        <input type="text" class="te-input" data-oauth-callback-preview value="{{CALLBACK_URL}}" readonly>
                        <button type="button" class="te-btn te-btn-secondary" data-action="copy-oauth-modal-callback">
                            <i class="fa fa-copy"></i>
                            Copy
                        </button>
                    </div>
                    <p class="te-help-text">Add this exact URL to the OAuth redirect or callback URL field in the provider's developer dashboard.</p>
                </div>
                <div class="te-field">
                    <label class="te-label">Enabled</label>
                    <div class="te-toggle-field">
                        <label class="te-toggle">
                            <input type="checkbox" data-oauth-field="enabled" data-checked="{{OAUTH_ENABLED_CHECKED}}">
                            <span class="te-toggle-slider"></span>
                        </label>
                        <span class="te-toggle-label">Show this provider on the login and register pages</span>
                    </div>
                </div>
                <div class="te-oauth-provider-note">
                    <i class="fa fa-info-circle"></i>
                    <span>Scopes, endpoints, icons, profile mapping, and button styling are handled automatically for the selected provider.</span>
                </div>
                <input type="hidden" data-oauth-field="redirect_uri" value="{{REDIRECT_URI}}">
            </div>
            <div class="te-modal-footer">
                <button type="button" class="te-btn te-btn-secondary" data-action="close-oauth-provider-modal">Cancel</button>
                <button type="button" class="te-btn te-btn-primary" data-action="save-oauth-provider">Save Provider</button>
            </div>
        </div>
    </div>
</template>
@endverbatim
