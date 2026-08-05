@verbatim
<template id="te-tab-advanced">
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Console</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Console Command Prelude</label>
                <input type="text" class="te-input" data-path="advanced.console_command_prelude" placeholder="container@pterodactyl~ " value="{{CONSOLE_COMMAND_PRELUDE}}">
                <p class="te-help-text">The text shown before each command line in the server console (e.g. container@pterodactyl~ ).</p>
            </div>
            <div class="te-field">
                <label class="te-label">Console Prelude Color</label>
                <div class="te-console-color-picker-wrap">
                    <div class="te-console-color-swatch" data-color-target="advanced.console_prelude_color" style="background-color: {{CONSOLE_PRELUDE_COLOR_HEX}};"></div>
                    <input type="text" class="te-input" style="flex: 1;" data-path="advanced.console_prelude_color" value="{{CONSOLE_PRELUDE_COLOR}}" readonly>
                    <input type="color" class="te-console-color-hidden" data-path="advanced.console_prelude_color" value="{{CONSOLE_PRELUDE_COLOR_HEX}}">
                </div>
                <p class="te-help-text">The color of the console command prelude text.</p>
            </div>
        </div> 
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Backups</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Always Ignored Backup Paths</label>
                <textarea class="te-input te-textarea" data-path="advanced.backup_ignored_paths" rows="6" placeholder="node_modules&#10;cache&#10;logs/latest.log">{{BACKUP_IGNORED_PATHS}}</textarea>
                <p class="te-help-text">Enter one file or folder path per line. These paths are automatically appended to every manual and scheduled backup ignore list.</p>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Keyboard Shortcuts</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Enable Keybinds Feature</label>
                <div class="te-toggle-field">
                    <label class="te-toggle">
                        <input type="checkbox" data-path="advanced.keybinds_enabled" data-checked="{{KEYBINDS_ENABLED_CHECKED}}">
                        <span class="te-toggle-slider"></span>
                    </label>
                    <span class="te-toggle-label">Enable global and server keybinds, including a help button that lists all available shortcuts</span>
                </div>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Server Folders</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Maximum Folders Per User</label>
                <input type="number" class="te-input" data-path="advanced.max_server_folders" placeholder="10" value="{{MAX_SERVER_FOLDERS}}" min="1" max="999">
                <p class="te-help-text">Maximum number of server folders a user can create. Default is 10.</p>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Account Settings</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Max Avatar Upload File Size <span class="te-label-hint">(MB)</span></label>
                <input type="number" class="te-input" data-path="advanced.max_avatar_upload_file_size" placeholder="4" value="{{MAX_AVATAR_UPLOAD_FILE_SIZE}}" min="1" max="20">
                <p class="te-help-text">Maximum avatar file size users can upload from account settings. Default is 4MB.</p>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Billing Integration</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Enable Billing Card</label>
                <div class="te-toggle-field">
                    <label class="te-toggle">
                        <input type="checkbox" data-path="advanced.billing_integration.enabled" data-checked="{{BILLING_INTEGRATION_ENABLED_CHECKED}}">
                        <span class="te-toggle-slider"></span>
                    </label>
                    <span class="te-toggle-label">Show each server owner their billing plan and status in the sidebar</span>
                </div>
            </div>
            <div class="te-field">
                <label class="te-label">Billing Platform</label>
                <div class="te-select-wrap">
                    <select class="te-input te-select" data-path="advanced.billing_integration.platform">
                        {{BILLING_PLATFORM_OPTIONS}}
                    </select>
                    <i class="fa fa-chevron-down te-select-icon"></i>
                </div>
                <p class="te-help-text">Choose the billing system that should be queried for server subscription details.</p>
            </div>
            <div class="te-field">
                <label class="te-label">Billing URL</label>
                <input type="url" class="te-input" data-path="advanced.billing_integration.billing_url" placeholder="https://billing.example.com" value="{{BILLING_URL}}">
                <p class="te-help-text">The public URL of your WHMCS or Paymenter installation.</p>
            </div>
            <div class="te-field" data-billing-platform-field="paymenter">
                <label class="te-label">Paymenter API Key</label>
                <input type="password" class="te-input" data-path="advanced.billing_integration.api_key" placeholder="Paymenter bearer token" value="{{BILLING_API_KEY}}">
                <p class="te-help-text">Used when the Billing Platform is set to Paymenter.</p>
            </div>
            <div class="te-field" data-billing-platform-field="whmcs">
                <label class="te-label">WHMCS API Identifier</label>
                <input type="password" class="te-input" data-path="advanced.billing_integration.api_identifier" placeholder="WHMCS API identifier" value="{{BILLING_API_IDENTIFIER}}">
                <p class="te-help-text">Used when the Billing Platform is set to WHMCS.</p>
            </div>
            <div class="te-field" data-billing-platform-field="whmcs">
                <label class="te-label">WHMCS API Secret</label>
                <input type="password" class="te-input" data-path="advanced.billing_integration.api_secret" placeholder="WHMCS API secret" value="{{BILLING_API_SECRET}}">
                <p class="te-help-text">Keep this key restricted to the billing read actions required for service lookups.</p>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Captcha Protection</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Captcha Provider</label>
                <div class="te-select-wrap">
                    <select class="te-input te-select" data-path="advanced.captcha.provider">
                        {{CAPTCHA_PROVIDER_OPTIONS}}
                    </select>
                    <i class="fa fa-chevron-down te-select-icon"></i>
                </div>
                <p class="te-help-text">Choose which captcha service should protect login, registration, and password reset forms.</p>
            </div>
            <div class="te-field" data-captcha-provider-field="cloudflare_turnstile">
                <label class="te-label">Cloudflare Turnstile Site Key</label>
                <input type="text" class="te-input" data-path="advanced.captcha.providers.cloudflare_turnstile.site_key" placeholder="Enter your Turnstile site key" value="{{CAPTCHA_CLOUDFLARE_SITE_KEY}}">
                <p class="te-help-text">The public site key from your Cloudflare Turnstile widget.</p>
            </div>
            <div class="te-field" data-captcha-provider-field="cloudflare_turnstile">
                <label class="te-label">Cloudflare Turnstile Secret Key</label>
                <input type="password" class="te-input" data-path="advanced.captcha.providers.cloudflare_turnstile.secret_key" placeholder="Enter your Turnstile secret key" value="{{CAPTCHA_CLOUDFLARE_SECRET_KEY}}">
                <p class="te-help-text">The private key used to verify Turnstile responses on the server.</p>
            </div>
            <div class="te-field" data-captcha-provider-field="google_recaptcha">
                <label class="te-label">Google reCAPTCHA Site Key</label>
                <input type="text" class="te-input" data-path="advanced.captcha.providers.google_recaptcha.site_key" placeholder="Enter your reCAPTCHA site key" value="{{CAPTCHA_GOOGLE_SITE_KEY}}">
                <p class="te-help-text">Use a reCAPTCHA v2 checkbox site key from Google reCAPTCHA admin.</p>
            </div>
            <div class="te-field" data-captcha-provider-field="google_recaptcha">
                <label class="te-label">Google reCAPTCHA Secret Key</label>
                <input type="password" class="te-input" data-path="advanced.captcha.providers.google_recaptcha.secret_key" placeholder="Enter your reCAPTCHA secret key" value="{{CAPTCHA_GOOGLE_SECRET_KEY}}">
                <p class="te-help-text">The private key used to validate Google reCAPTCHA responses.</p>
            </div>
            <div class="te-field" data-captcha-provider-field="hcaptcha">
                <label class="te-label">hCaptcha Site Key</label>
                <input type="text" class="te-input" data-path="advanced.captcha.providers.hcaptcha.site_key" placeholder="Enter your hCaptcha site key" value="{{CAPTCHA_HCAPTCHA_SITE_KEY}}">
                <p class="te-help-text">The public site key from your hCaptcha dashboard.</p>
            </div>
            <div class="te-field" data-captcha-provider-field="hcaptcha">
                <label class="te-label">hCaptcha Secret Key</label>
                <input type="password" class="te-input" data-path="advanced.captcha.providers.hcaptcha.secret_key" placeholder="Enter your hCaptcha secret key" value="{{CAPTCHA_HCAPTCHA_SECRET_KEY}}">
                <p class="te-help-text">The private key used to validate hCaptcha responses.</p>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">User Registration</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Enable Registration</label>
                <div class="te-toggle-field">
                    <label class="te-toggle">
                        <input type="checkbox" data-path="components.registration_enabled" data-checked="{{REGISTRATION_ENABLED_CHECKED}}">
                        <span class="te-toggle-slider"></span>
                    </label>
                    <span class="te-toggle-label">Allow new users to create accounts on the login page</span>
                </div>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Server Dashboard</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Hide Dashboard Header</label>
                <div class="te-toggle-field">
                    <label class="te-toggle">
                        <input type="checkbox" data-path="components.hide_dashboard_header" data-checked="{{HIDE_DASHBOARD_HEADER_CHECKED}}">
                        <span class="te-toggle-slider"></span>
                    </label>
                    <span class="te-toggle-label">Hide the welcome banner/header on the server dashboard page</span>
                </div>
            </div>
            <div class="te-field">
                <label class="te-label">Allow Changing Startup Command</label>
                <div class="te-toggle-field">
                    <label class="te-toggle">
                        <input type="checkbox" data-path="components.allow_startup_command_edit" data-checked="{{ALLOW_STARTUP_COMMAND_EDIT_CHECKED}}">
                        <span class="te-toggle-slider"></span>
                    </label>
                    <span class="te-toggle-label">Allow server admins to edit the startup command from the Startup tab</span>
                </div>
                <div class="te-egg-selector" style="margin-top: 12px;">
                    <div class="te-egg-selector-header">
                        <input type="text" class="te-input te-egg-selector-search" placeholder="Search eggs...">
                        <span class="te-egg-selector-count" data-component-setting-id="allow_startup_command_edit_eggs">{{ALLOW_STARTUP_COMMAND_EDIT_EGGS_COUNT}}</span>
                    </div>
                    <div class="te-egg-selector-list">
                        {{ALLOW_STARTUP_COMMAND_EDIT_EGGS_OPTIONS}}
                    </div>
                </div>
                <p class="te-help-text">Choose which eggs can edit the startup command. Leave it on All to allow every egg.</p>
            </div>
            <div class="te-field">
                <label class="te-label">Allow Changing Startup Variables</label>
                <div class="te-toggle-field">
                    <label class="te-toggle">
                        <input type="checkbox" data-path="components.allow_startup_variables_edit" data-checked="{{ALLOW_STARTUP_VARIABLES_EDIT_CHECKED}}">
                        <span class="te-toggle-slider"></span>
                    </label>
                    <span class="te-toggle-label">Allow server admins to edit startup variables from the Startup tab</span>
                </div>
                <div class="te-egg-selector" style="margin-top: 12px;">
                    <div class="te-egg-selector-header">
                        <input type="text" class="te-input te-egg-selector-search" placeholder="Search eggs...">
                        <span class="te-egg-selector-count" data-component-setting-id="allow_startup_variables_edit_eggs">{{ALLOW_STARTUP_VARIABLES_EDIT_EGGS_COUNT}}</span>
                    </div>
                    <div class="te-egg-selector-list">
                        {{ALLOW_STARTUP_VARIABLES_EDIT_EGGS_OPTIONS}}
                    </div>
                </div>
                <p class="te-help-text">Choose which eggs can edit startup variables. Leave it on All to allow every egg.</p>
            </div>
            <div class="te-field">
                <label class="te-label">Allow Changing Docker Image</label>
                <div class="te-toggle-field">
                    <label class="te-toggle">
                        <input type="checkbox" data-path="components.allow_docker_image_edit" data-checked="{{ALLOW_DOCKER_IMAGE_EDIT_CHECKED}}">
                        <span class="te-toggle-slider"></span>
                    </label>
                    <span class="te-toggle-label">Allow server admins to change the Docker image from the Startup tab</span>
                </div>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">File Manager</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">File Editor Type</label>
                <div class="te-select-wrap">
                    <select class="te-input te-select" data-path="advanced.file_editor_type">
                        {{FILE_EDITOR_TYPE_OPTIONS}}
                    </select>
                    <i class="fa fa-chevron-down te-select-icon"></i>
                </div>
                <p class="te-help-text">Choose the code editor to use for editing files. Monaco Editor offers a better editing experience with IntelliSense and advanced features.</p>
            </div>
            <div class="te-field">
                <label class="te-label">Enable Trash System</label>
                <div class="te-toggle-field">
                    <label class="te-toggle">
                        <input type="checkbox" data-path="components.trash_enabled" data-checked="{{TRASH_ENABLED_CHECKED}}">
                        <span class="te-toggle-slider"></span>
                    </label>
                    <span class="te-toggle-label">When enabled, deleted files are moved to a .trash folder instead of being permanently deleted. Disable to permanently delete files immediately.</span>
                </div>
            </div>
            <div class="te-field">
                <label class="te-label">Trash Auto-Delete Timer <span class="te-label-hint">(hours)</span></label>
                <input type="number" class="te-input" data-path="components.trash_auto_delete_hours" placeholder="168" value="{{TRASH_AUTO_DELETE_HOURS}}" min="1" max="8760">
                <p class="te-help-text">Files in trash older than this timer are permanently deleted the next time trash is opened. Default is 168 hours (7 days).</p>
            </div>
            <div class="te-field">
                <label class="te-label">Search Mode</label>
                <div class="te-select-wrap">
                    <select class="te-input te-select" data-path="components.search_mode">
                        {{SEARCH_MODE_OPTIONS}}
                    </select>
                    <i class="fa fa-chevron-down te-select-icon"></i>
                </div>
                <p class="te-help-text">Choose whether file search scans the entire server or only the folder currently open in the file manager. Current folder mode is faster on large servers.</p>
            </div>
            <div class="te-field">
                <label class="te-label">Ignored Search Folders</label>
                <input type="text" class="te-input" data-path="components.search_ignored_folders" placeholder="node_modules, .git, vendor" value="{{SEARCH_IGNORED_FOLDERS}}">
                <p class="te-help-text">Comma-separated list of folder names to skip when using global file search. These folders and their contents will be excluded from search results.</p>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Advanced SFTP Settings</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">SFTP Host Overrides</label>
                <p class="te-help-text" style="margin-bottom: 16px;">Override the SFTP host on a per-node basis. This is useful for setups using Cloudflare Zero Trust or similar services where SFTP connections are blocked via the public domain. When enabled for a node, only the host portion of the SFTP URL is replaced, keeping the username and port unchanged.</p>
                <div id="sftp-overrides-container">
                    {{SFTP_HOST_OVERRIDES}}
                </div>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Translation System</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Enable Translations</label>
                <div class="te-toggle-field">
                    <label class="te-toggle">
                        <input type="checkbox" data-path="components.translations_enabled" data-checked="{{TRANSLATIONS_ENABLED_CHECKED}}">
                        <span class="te-toggle-slider"></span>
                    </label>
                    <span class="te-toggle-label">Allow users to change their language preference in account settings</span>
                </div>
            </div>
            <div class="te-field">
                <label class="te-label">Default Language</label>
                <select class="te-input" data-path="components.default_language">
                    {{DEFAULT_LANGUAGE_OPTIONS}}
                </select>
                <p class="te-help-text">The default language for new users and guests.</p>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Available Languages</span>
        </div>
        <div class="te-section-content">
            <p class="te-help-text" style="margin-bottom: 16px;">Select which languages are available for users. Languages are automatically detected from the <code>resources/lang</code> folder. To add a new language, create a folder with the language code (e.g., <code>fr</code>, <code>de</code>, <code>es</code>) and add translation files.</p>
            <div class="te-language-grid">
                {{LANGUAGE_CHECKBOXES}}
            </div>
        </div>
    </div>
</template>
@endverbatim
