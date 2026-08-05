@verbatim
<template id="te-addon-setting-domain-list">
    <div class="te-addon-setting-field">
        <label class="te-label">{{SETTING_LABEL}}</label>
        <div class="te-domain-list" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}">
            <div class="te-domain-list-items">
                {{DOMAIN_ITEMS}}
            </div>
            <div class="te-domain-list-add">
                <input type="text" class="te-input te-domain-add-input" placeholder="example.com" data-addon-domain-input="{{ADDON_ID}}">
                <button type="button" class="te-btn te-btn-sm te-btn-primary" data-addon-domain-add="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}">
                    <i class="fa fa-plus"></i> Add Domain
                </button>
            </div>
        </div>
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-addon-domain-list-item">
    <div class="te-domain-list-item" data-domain="{{DOMAIN}}">
        <span class="te-domain-value">{{DOMAIN}}</span>
        <button type="button" class="te-domain-remove" data-addon-domain-remove="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}" data-domain="{{DOMAIN}}">
            <i class="fa fa-times"></i>
        </button>
    </div>
</template>

<template id="te-addon-setting-domain-config">
    <div class="te-addon-setting-field">
        <label class="te-label">{{SETTING_LABEL}}</label>
        <div class="te-domain-config" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}">
            <div class="te-domain-config-list">
                {{DOMAIN_CONFIG_ITEMS}}
            </div>
            <button type="button" class="te-btn te-btn-primary" data-action="add-domain-config" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}">
                <i class="fa fa-plus"></i> Add Domain
            </button>
        </div>
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-addon-domain-config-item">
    <div class="te-domain-config-item" data-domain-index="{{DOMAIN_INDEX}}">
        <div class="te-domain-config-main">
            <div class="te-domain-config-info">
                <span class="te-domain-config-name">{{DOMAIN_NAME}}{{DOMAIN_DEFAULT_MARKER}}</span>
                <span class="te-domain-config-meta">{{DOMAIN_META}}</span>
            </div>
            <div class="te-domain-config-actions">
                <div class="te-domain-config-order">
                    <button type="button" class="te-btn te-btn-sm te-btn-secondary" data-action="move-domain-config" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}" data-domain-index="{{DOMAIN_INDEX}}" data-direction="up" {{MOVE_UP_DISABLED}}>
                        <i class="fa fa-arrow-up w-4 h-4"></i>
                    </button>
                    <button type="button" class="te-btn te-btn-sm te-btn-secondary" data-action="move-domain-config" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}" data-domain-index="{{DOMAIN_INDEX}}" data-direction="down" {{MOVE_DOWN_DISABLED}}>
                        <i class="fa fa-arrow-down w-4 h-4"></i>
                    </button>
                </div>
                <button type="button" class="te-btn te-btn-sm te-btn-secondary" data-action="edit-domain-config" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}" data-domain-index="{{DOMAIN_INDEX}}">
                    <i class="fa fa-pencil w-4 h-4"></i> Edit
                </button>
                <button type="button" class="te-btn te-btn-sm te-btn-danger" data-action="remove-domain-config" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}" data-domain-index="{{DOMAIN_INDEX}}">
                    <i class="fa fa-trash w-4 h-4"></i>
                </button>
            </div>
        </div>
    </div>
</template>

<template id="te-domain-config-modal">
    <div class="te-modal-overlay" data-modal="domain-config">
        <div class="te-modal te-modal-lg te-modal-scrollable">
            <div class="te-modal-header">
                <h3 class="te-modal-title">{{MODAL_TITLE}}</h3>
                <button type="button" class="te-modal-close" data-action="close-modal">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="te-modal-body">
                <div class="te-form-group">
                    <label class="te-label">Domain Name</label>
                    <input type="text" class="te-input" data-field="domain" placeholder="example.com" value="{{DOMAIN_VALUE}}">
                    <p class="te-help-text">The domain name users will create subdomains under</p>
                </div>
                <div class="te-form-group">
                    <label class="te-label">CloudFlare Zone ID</label>
                    <input type="text" class="te-input" data-field="zone_id" placeholder="Zone ID from CloudFlare dashboard" value="{{ZONE_ID_VALUE}}">
                    <p class="te-help-text">Found on the right sidebar of this domain's overview page in CloudFlare</p>
                </div>
                <div class="te-form-group">
                    <label class="te-label">DNS IP Address (Public IP)</label>
                    <input type="text" class="te-input" data-field="dns_ip" placeholder="Leave empty to use allocation IP" value="{{DNS_IP_VALUE}}">
                    <p class="te-help-text">If your allocations use a local/private IP, enter your public IP here. This IP will be used for CloudFlare DNS records while the allocation IP is used for server binding.</p>
                </div>
                <div class="te-form-group">
                    <label class="te-label">Routing Mode</label>
                    <select class="te-input" data-field="routing_mode">
                        <option value="game" {{ROUTING_MODE_GAME_SELECTED}}>Game Server</option>
                        <option value="web" {{ROUTING_MODE_WEB_SELECTED}}>Website / Reverse Proxy</option>
                    </select>
                    <p class="te-help-text">Game Server mode creates SRV and/or A records for direct game connections. Website / Reverse Proxy mode creates proxied DNS, forces HTTPS, and routes through Reverse Proxy Manager.</p>
                </div>
                <div class="te-domain-game-fields" {{GAME_FIELDS_HIDDEN}}>
                <div class="te-form-divider">
                    <span>DNS Record Settings</span>
                </div>
                <div class="te-form-group">
                    <label class="te-label">Create SRV Record</label>
                    <div class="te-toggle-field">
                        <label class="te-toggle">
                            <input type="checkbox" data-field="srv_enabled" {{SRV_ENABLED_CHECKED}}>
                            <span class="te-toggle-slider"></span>
                        </label>
                        <span class="te-toggle-label">Enable SRV record creation for this domain</span>
                    </div>
                    <p class="te-help-text">SRV records allow players to connect without specifying a port (e.g. Minecraft)</p>
                </div>
                <div class="te-form-row te-srv-fields" {{SRV_FIELDS_HIDDEN}}>
                    <div class="te-form-group te-form-col">
                        <label class="te-label">SRV Service Mode</label>
                        <select class="te-input" data-field="srv_service_mode">
                            <option value="global" {{SRV_SERVICE_MODE_GLOBAL_SELECTED}}>Global Service</option>
                            <option value="per_egg" {{SRV_SERVICE_MODE_PER_EGG_SELECTED}}>Per Egg Service</option>
                        </select>
                        <p class="te-help-text">Use one service for all eggs, or map services to specific eggs.</p>
                    </div>
                    <div class="te-form-group te-form-col">
                        <label class="te-label">SRV Protocol</label>
                        <select class="te-input" data-field="srv_protocol">
                            <option value="_tcp" {{SRV_TCP_SELECTED}}>TCP</option>
                            <option value="_udp" {{SRV_UDP_SELECTED}}>UDP</option>
                        </select>
                    </div>
                </div>
                <div class="te-form-group te-srv-service-global-fields" {{SRV_SERVICE_GLOBAL_FIELDS_HIDDEN}}>
                    <label class="te-label">Global SRV Service</label>
                    <input type="text" class="te-input" data-field="srv_service" placeholder="_minecraft" value="{{SRV_SERVICE_VALUE}}">
                    <p class="te-help-text">Used for every egg when mode is set to Global Service.</p>
                </div>
                <div class="te-srv-service-per-egg-fields" {{SRV_SERVICE_PER_EGG_FIELDS_HIDDEN}}>
                    <div class="te-form-group">
                        <label class="te-label">Default SRV Service</label>
                        <input type="text" class="te-input" data-field="srv_service_default" placeholder="_minecraft" value="{{SRV_SERVICE_DEFAULT_VALUE}}">
                        <p class="te-help-text">Used for eggs that do not have a specific override.</p>
                    </div>
                    <div class="te-form-group">
                        <label class="te-label">Per Egg SRV Services</label>
                        <div class="te-egg-selector" data-srv-egg-service-map>
                            <div class="te-egg-selector-list" data-srv-egg-service-rows>
                                {{SRV_EGG_SERVICE_ROWS}}
                            </div>
                            <div class="te-srv-egg-service-actions">
                                <button type="button" class="te-btn te-btn-sm te-btn-secondary te-srv-egg-service-add-btn" data-action="add-srv-egg-service-row">
                                    <i class="fa fa-plus"></i> Add Egg Override
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="te-form-group">
                    <label class="te-label">Create A Record</label>
                    <div class="te-toggle-field">
                        <label class="te-toggle">
                            <input type="checkbox" data-field="a_record_enabled" {{A_RECORD_ENABLED_CHECKED}}>
                            <span class="te-toggle-slider"></span>
                        </label>
                        <span class="te-toggle-label">Create an A record pointing to the server IP</span>
                    </div>
                    <p class="te-help-text">Required if you're not using SRV records, or if you want the subdomain to resolve directly</p>
                </div>
                </div>
                <div class="te-domain-web-fields" {{WEB_FIELDS_HIDDEN}}>
                    <div class="te-form-divider">
                        <span>Website Routing</span>
                    </div>
                    <p class="te-help-text">Website / Reverse Proxy mode uses Reverse Proxy Manager for routing and SSL and creates a proxied A record in CloudFlare for the hostname.</p>
                </div>
            </div>
            <div class="te-modal-footer">
                <button type="button" class="te-btn te-btn-secondary" data-action="close-modal">Cancel</button>
                <button type="button" class="te-btn te-btn-primary" data-action="save-domain-config" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}" data-domain-index="{{DOMAIN_INDEX}}">
                    <i class="fa fa-save"></i> Save Domain
                </button>
            </div>
        </div>
    </div>
</template>

<template id="te-domain-srv-egg-service-row">
    <div class="te-form-row te-srv-egg-service-row" data-srv-egg-service-row>
        <div class="te-form-col">
            <label class="te-label">Egg</label>
            <select class="te-input" data-field="srv_egg_id">
                {{SRV_EGG_OPTIONS}}
            </select>
        </div>
        <div class="te-form-col">
            <label class="te-label">Service</label>
            <input type="text" class="te-input" data-field="srv_egg_service" placeholder="_minecraft" value="{{SRV_EGG_SERVICE_VALUE}}">
        </div>
        <div class="te-form-col">
            <label class="te-label">Protocol</label>
            <select class="te-input" data-field="srv_egg_protocol">
                <option value="_tcp" {{SRV_EGG_TCP_SELECTED}}>TCP</option>
                <option value="_udp" {{SRV_EGG_UDP_SELECTED}}>UDP</option>
            </select>
        </div>
        <div class="te-srv-egg-service-remove-wrap">
            <button type="button" class="te-btn te-btn-sm te-btn-danger" data-action="remove-srv-egg-service-row">
                <i class="fa fa-trash"></i>
            </button>
        </div>
    </div>
</template>

<template id="te-addon-settings-panel">
    <div class="te-addon-settings-panel">
        <div class="te-addon-settings-header">
            <button class="te-addon-settings-back" data-action="back-to-addons">
                <i class="fa fa-arrow-left"></i>
            </button>
            <div class="te-addon-settings-title-wrap">
                <h2 class="te-addon-settings-title">{{ADDON_NAME}} Settings</h2>
                <p class="te-addon-settings-subtitle">Configure options for this addon</p>
            </div>
            <div class="te-addon-settings-actions">
                <button class="te-btn te-btn-danger te-btn-icon-only" data-action="reset" title="Reset"><i class="fa fa-undo"></i></button>
                {{CONFIG_ACTIONS_MENU}}
                <button class="te-btn te-btn-primary" data-action="save"><i class="fa fa-save"></i> Save Changes</button>
            </div>
        </div>
        <div class="te-addon-settings-content">
            {{SETTINGS_FIELDS}}
        </div>
    </div>
</template>

<template id="te-addon-setting-offer-config">
    <div class="te-addon-setting-field">
        <label class="te-label">{{SETTING_LABEL}}</label>
        <div class="te-offer-config" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}">
            <div class="te-offer-config-list" id="te-offer-list">
                {{OFFER_ITEMS}}
            </div>
            <div style="display: flex; gap: 8px;">
                <button type="button" class="te-btn te-btn-primary" data-action="add-offer" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}">
                    <i class="fa fa-plus"></i> New Offer
                </button>
                <button type="button" class="te-btn te-btn-secondary" data-action="issue-offer">
                    <i class="fa fa-paper-plane"></i> Issue to User
                </button>
            </div>
        </div>
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-offer-config-item">
    <div class="te-domain-config-item" data-offer-id="{{OFFER_ID}}">
        <div class="te-domain-config-main">
            <div class="te-domain-config-info">
                <span class="te-domain-config-name">{{OFFER_NAME}}</span>
                <span class="te-domain-config-meta">{{OFFER_META}}</span>
            </div>
            <div class="te-domain-config-actions">
                <button type="button" class="te-btn te-btn-sm te-btn-secondary" data-action="edit-offer" data-offer-id="{{OFFER_ID}}">
                    <i class="fa fa-pencil w-4 h-4"></i> Edit
                </button>
                <button type="button" class="te-btn te-btn-sm te-btn-danger" data-action="remove-offer" data-offer-id="{{OFFER_ID}}">
                    <i class="fa fa-trash w-4 h-4"></i>
                </button>
            </div>
        </div>
    </div>
</template>

<template id="te-offer-modal">
    <div class="te-modal-overlay" data-modal="offer-config">
        <div class="te-modal te-modal-lg" style="max-width: 720px; max-height: 90vh;">
            <div class="te-modal-header">
                <h3 class="te-modal-title">{{MODAL_TITLE}}</h3>
                <button type="button" class="te-modal-close" data-action="close-offer-modal">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="te-modal-body" style="overflow-y: auto; max-height: calc(90vh - 130px);">
                <div class="te-form-group">
                    <label class="te-label">Offer Name</label>
                    <input type="text" class="te-input" data-field="name" placeholder="e.g. Free Starter Server" value="{{OFFER_NAME}}">
                </div>
                <div class="te-form-group">
                    <label class="te-label">Description</label>
                    <textarea class="te-input te-textarea" data-field="description" rows="2" placeholder="Optional description">{{OFFER_DESCRIPTION}}</textarea>
                </div>
                <div class="te-form-row">
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Server Name Template</label>
                        <input type="text" class="te-input" data-field="server_name_template" placeholder="{username} Server" value="{{SERVER_NAME_TEMPLATE}}">
                        <p class="te-help-text">{username} gets replaced with the user's name</p>
                    </div>
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Server Description</label>
                        <input type="text" class="te-input" data-field="server_description" placeholder="Optional" value="{{SERVER_DESCRIPTION}}">
                    </div>
                </div>

                <div class="te-form-divider"><span>Egg & Deployment</span></div>
                <div class="te-form-row">
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Nest</label>
                        <select class="te-input" data-field="nest_id" id="te-offer-nest-select">
                            <option value="">Select a nest...</option>
                            {{NEST_OPTIONS}}
                        </select>
                    </div>
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Egg</label>
                        <select class="te-input" data-field="egg_id" id="te-offer-egg-select">
                            <option value="">Select an egg...</option>
                            {{EGG_OPTIONS}}
                        </select>
                    </div>
                </div>
                <div class="te-form-group">
                    <label class="te-label">Locations</label>
                    <div class="te-offer-location-list" id="te-offer-locations">
                        {{LOCATION_OPTIONS}}
                    </div>
                    <p class="te-help-text">Select at least one deployment location</p>
                </div>
                <div class="te-form-group">
                    <label class="te-label">Docker Image</label>
                    <input type="text" class="te-input" data-field="image" placeholder="Leave empty for egg default" value="{{IMAGE_VALUE}}">
                </div>
                <div class="te-form-group">
                    <label class="te-label">Startup Command</label>
                    <input type="text" class="te-input" data-field="startup" placeholder="Leave empty for egg default" value="{{STARTUP_VALUE}}">
                </div>

                <div class="te-form-divider"><span>Environment Variables</span></div>
                <div id="te-offer-env-container" class="te-offer-env-container">
                    <p class="te-help-text">Select an egg to load its environment variables</p>
                </div>

                <div class="te-form-divider"><span>Resource Limits</span></div>
                <div class="te-form-row">
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Memory (MB)</label>
                        <input type="number" class="te-input" data-field="memory" value="{{MEMORY_VALUE}}" min="0">
                    </div>
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Swap (MB)</label>
                        <input type="number" class="te-input" data-field="swap" value="{{SWAP_VALUE}}">
                    </div>
                </div>
                <div class="te-form-row">
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Disk (MB)</label>
                        <input type="number" class="te-input" data-field="disk" value="{{DISK_VALUE}}" min="0">
                    </div>
                    <div class="te-form-group te-form-col">
                        <label class="te-label">CPU (%)</label>
                        <input type="number" class="te-input" data-field="cpu" value="{{CPU_VALUE}}" min="0">
                    </div>
                </div>
                <div class="te-form-row">
                    <div class="te-form-group te-form-col">
                        <label class="te-label">IO Weight</label>
                        <input type="number" class="te-input" data-field="io" value="{{IO_VALUE}}" min="10" max="1000">
                    </div>
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Threads</label>
                        <input type="text" class="te-input" data-field="threads" placeholder="Leave empty for no limit" value="{{THREADS_VALUE}}">
                    </div>
                </div>

                <div class="te-form-divider"><span>Feature Limits</span></div>
                <div class="te-form-row">
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Databases</label>
                        <input type="number" class="te-input" data-field="database_limit" value="{{DATABASE_LIMIT}}" min="0">
                    </div>
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Allocations</label>
                        <input type="number" class="te-input" data-field="allocation_limit" value="{{ALLOCATION_LIMIT}}" min="0">
                    </div>
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Backups</label>
                        <input type="number" class="te-input" data-field="backup_limit" value="{{BACKUP_LIMIT}}" min="0">
                    </div>
                </div>

                <div class="te-form-divider"><span>Toggles</span></div>
                <div class="te-form-group">
                    <div class="te-toggle-field">
                        <label class="te-toggle">
                            <input type="checkbox" data-field="dedicated_ip">
                            <span class="te-toggle-slider"></span>
                        </label>
                        <span class="te-toggle-label">Dedicated IP</span>
                    </div>
                </div>
                <div class="te-form-group">
                    <div class="te-toggle-field">
                        <label class="te-toggle">
                            <input type="checkbox" data-field="oom_disabled">
                            <span class="te-toggle-slider"></span>
                        </label>
                        <span class="te-toggle-label">Disable OOM Killer</span>
                    </div>
                </div>
                <div class="te-form-group">
                    <div class="te-toggle-field">
                        <label class="te-toggle">
                            <input type="checkbox" data-field="start_on_completion">
                            <span class="te-toggle-slider"></span>
                        </label>
                        <span class="te-toggle-label">Start on Completion</span>
                    </div>
                </div>
                <div class="te-form-group">
                    <div class="te-toggle-field">
                        <label class="te-toggle">
                            <input type="checkbox" data-field="enabled">
                            <span class="te-toggle-slider"></span>
                        </label>
                        <span class="te-toggle-label">Enabled</span>
                    </div>
                </div>

                <div class="te-form-divider"><span>Availability</span></div>
                <div class="te-form-group">
                    <label class="te-label">Offer Availability</label>
                    <select class="te-input" data-field="availability_type">
                        <option value="register">Only on Register</option>
                        <option value="all_users">All Users</option>
                    </select>
                    <p class="te-help-text">Choose whether this offer is only given during signup or can also be claimed by existing users.</p>
                </div>

                <div class="te-form-divider"><span>Targeting</span></div>
                <div class="te-form-group">
                    <label class="te-label">Audience</label>
                    <select class="te-input" data-field="target_type" id="te-offer-target-type">
                        <option value="all">Everyone</option>
                        <option value="specific">Specific Users</option>
                    </select>
                </div>
                <div class="te-form-group te-offer-target-users" id="te-offer-target-users-wrap">
                    <label class="te-label">Target Users</label>
                    <input type="text" class="te-input" id="te-offer-user-search" placeholder="Search by username or email...">
                    <div id="te-offer-user-results" class="te-offer-user-results" style="display: none;"></div>
                    <div id="te-offer-selected-users" class="te-offer-selected-users">{{SELECTED_USERS_HTML}}</div>
                </div>

                <div class="te-form-divider"><span>Expiry</span></div>
                <div class="te-form-row">
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Claim Expiry (days)</label>
                        <input type="number" class="te-input" data-field="claim_expiry_days" placeholder="Never expires" value="{{CLAIM_EXPIRY_DAYS}}" min="1">
                        <p class="te-help-text">Days before unclaimed offer expires</p>
                    </div>
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Server Expiry (days)</label>
                        <input type="number" class="te-input" data-field="server_expiry_days" placeholder="Never expires" value="{{SERVER_EXPIRY_DAYS}}" min="1">
                        <p class="te-help-text">Days before claimed server is deleted</p>
                    </div>
                </div>
            </div>
            <div class="te-modal-footer">
                <button type="button" class="te-btn te-btn-secondary" data-action="close-offer-modal">Cancel</button>
                <button type="button" class="te-btn te-btn-primary" data-action="save-offer" data-offer-id="{{OFFER_ID}}">
                    <i class="fa fa-save"></i> {{SAVE_BUTTON_TEXT}}
                </button>
            </div>
        </div>
    </div>
</template>

<template id="te-offer-env-field">
    <div class="te-form-group te-offer-env-field">
        <label class="te-label">{{VAR_NAME}} <span style="color: var(--te-muted); font-weight: 400; font-size: 11px;">{{VAR_ENV_KEY}}</span></label>
        <input type="text" class="te-input" data-env-key="{{VAR_ENV_KEY}}" placeholder="{{VAR_DEFAULT}}" value="{{VAR_VALUE}}">
        <p class="te-help-text">{{VAR_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-offer-location-checkbox">
    <label class="te-offer-location-item">
        <input type="checkbox" data-location-id="{{LOCATION_ID}}">
        <span>{{LOCATION_NAME}}</span>
    </label>
</template>

<template id="te-offer-selected-user">
    <span class="te-offer-user-tag" data-user-id="{{USER_ID}}">
        {{USER_NAME}} <button type="button" class="te-offer-user-remove" data-remove-user="{{USER_ID}}">&times;</button>
    </span>
</template>

<template id="te-issue-offer-modal">
    <div class="te-modal-overlay" data-modal="issue-offer">
        <div class="te-modal te-modal-lg" style="max-width: 520px;">
            <div class="te-modal-header">
                <h3 class="te-modal-title">Issue Offer to User</h3>
                <button type="button" class="te-modal-close" data-action="close-issue-modal">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="te-modal-body">
                <div class="te-form-group">
                    <label class="te-label">Offer Template</label>
                    <select class="te-input" data-field="issue_offer_id" id="te-issue-offer-select">
                        <option value="">Select an offer...</option>
                        {{OFFER_SELECT_OPTIONS}}
                    </select>
                </div>
                <div class="te-form-group">
                    <label class="te-label">Users</label>
                    <input type="text" class="te-input" id="te-issue-user-search" placeholder="Search by username or email...">
                    <div id="te-issue-user-results" class="te-offer-user-results" style="display: none;"></div>
                    <div id="te-issue-selected-users" class="te-offer-selected-users"></div>
                    <p class="te-help-text">Search and select one or more users to issue this offer to</p>
                </div>
                <div class="te-form-divider"><span>Expiry Overrides</span></div>
                <p class="te-help-text" style="margin-bottom: 12px;">Leave empty to use the offer's default expiry settings</p>
                <div class="te-form-row">
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Claim Expiry (days)</label>
                        <input type="number" class="te-input" data-field="issue_claim_expiry_days" placeholder="Use offer default" min="1">
                    </div>
                    <div class="te-form-group te-form-col">
                        <label class="te-label">Server Expiry (days)</label>
                        <input type="number" class="te-input" data-field="issue_server_expiry_days" placeholder="Use offer default" min="1">
                    </div>
                </div>
            </div>
            <div class="te-modal-footer">
                <button type="button" class="te-btn te-btn-secondary" data-action="close-issue-modal">Cancel</button>
                <button type="button" class="te-btn te-btn-primary" data-action="submit-issue-offer">
                    <i class="fa fa-paper-plane"></i> Issue Offer
                </button>
            </div>
        </div>
    </div>
</template>

<template id="te-addon-setting-claims-list">
    <div class="te-addon-setting-field">
        <div class="te-claims-header" data-action="toggle-claims">
            <div class="te-claims-header-left">
                <label class="te-label" style="margin: 0; cursor: pointer;">{{SETTING_LABEL}}</label>
                <span class="te-claims-count">{{CLAIMS_COUNT}}</span>
            </div>
            <i class="fa fa-chevron-down te-claims-chevron {{CLAIMS_EXPANDED_CLASS}}"></i>
        </div>
        <div class="te-claims-panel {{CLAIMS_HIDDEN_CLASS}}" id="te-claims-panel">
            <div class="te-claims-toolbar">
                <input type="text" class="te-input te-claims-search" id="te-claims-search" placeholder="Search by user, offer, or status...">
                <select class="te-input te-claims-filter" id="te-claims-filter">
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="claimed">Claimed</option>
                    <option value="expired">Expired</option>
                    <option value="server_expired">Server Expired</option>
                </select>
            </div>
            <div class="te-claims-table-wrap" id="te-claims-table-wrap">
                <div class="te-claims-grid te-claims-grid-head">
                    <div class="te-claims-th">User</div>
                    <div class="te-claims-th">Offer</div>
                    <div class="te-claims-th">Status</div>
                    <div class="te-claims-th">Server</div>
                    <div class="te-claims-th">Claim Expiry</div>
                    <div class="te-claims-th">Server Expiry</div>
                    <div class="te-claims-th">Issued</div>
                </div>
                <div id="te-claims-tbody">
                    {{CLAIMS_ROWS}}
                </div>
            </div>
            <div class="te-claims-empty" id="te-claims-empty" style="display: none;">No claims match your search</div>
        </div>
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-claims-row">
    <div class="te-claims-grid te-claims-row" data-search="{{SEARCH_TEXT}}" data-status="{{STATUS}}">
        <div class="te-claims-cell">
            <span class="te-claims-user">{{USERNAME}}</span>
            <span class="te-claims-email">{{EMAIL}}</span>
        </div>
        <div class="te-claims-cell">{{OFFER_NAME}}</div>
        <div class="te-claims-cell"><span class="te-claims-status te-claims-status-{{STATUS}}">{{STATUS_LABEL}}</span></div>
        <div class="te-claims-cell te-claims-cell-server">{{SERVER_NAME}}</div>
        <div class="te-claims-cell te-claims-cell-muted">{{CLAIM_EXPIRY}}</div>
        <div class="te-claims-cell te-claims-cell-muted">{{SERVER_EXPIRY}}</div>
        <div class="te-claims-cell te-claims-cell-muted">{{CREATED_AT}}</div>
    </div>
</template>

<template id="te-addon-setting-text">
    <div class="te-addon-setting-field">
        <label class="te-label">{{SETTING_LABEL}}</label>
        <input type="text" class="te-input" data-path="addons.{{ADDON_ID}}.settings.{{SETTING_ID}}" value="{{SETTING_VALUE}}" placeholder="{{SETTING_PLACEHOLDER}}">
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-addon-setting-password">
    <div class="te-addon-setting-field">
        <label class="te-label">{{SETTING_LABEL}}</label>
        <input type="password" class="te-input" data-path="addons.{{ADDON_ID}}.settings.{{SETTING_ID}}" value="{{SETTING_VALUE}}" placeholder="{{SETTING_PLACEHOLDER}}">
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-addon-setting-number">
    <div class="te-addon-setting-field">
        <label class="te-label">{{SETTING_LABEL}}</label>
        <input type="number" class="te-input" data-path="addons.{{ADDON_ID}}.settings.{{SETTING_ID}}" value="{{SETTING_VALUE}}">
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-addon-setting-textarea">
    <div class="te-addon-setting-field">
        <label class="te-label">{{SETTING_LABEL}}</label>
        <textarea class="te-input te-textarea" data-path="addons.{{ADDON_ID}}.settings.{{SETTING_ID}}" rows="4">{{SETTING_VALUE}}</textarea>
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-addon-setting-toggle">
    <div class="te-addon-setting-field">
        <label class="te-label">{{SETTING_LABEL}}</label>
        <div class="te-toggle-field">
            <label class="te-toggle">
                <input type="checkbox" data-path="addons.{{ADDON_ID}}.settings.{{SETTING_ID}}" data-checked="{{SETTING_VALUE}}">
                <span class="te-toggle-slider"></span>
            </label>
        </div>
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-addon-setting-select">
    <div class="te-addon-setting-field">
        <label class="te-label">{{SETTING_LABEL}}</label>
        <select class="te-input" data-path="addons.{{ADDON_ID}}.settings.{{SETTING_ID}}">
            {{SELECT_OPTIONS}}
        </select>
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-addon-setting-platform-toggles">
    <div class="te-addon-setting-field">
        <label class="te-label">{{SETTING_LABEL}}</label>
        <div class="te-platform-toggles">
            {{PLATFORM_TOGGLES}}
        </div>
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-addon-platform-toggle-item">
    <div class="te-platform-toggle-item {{PLATFORM_DISABLED}}">
        <label class="te-toggle">
            <input type="checkbox" data-path="addons.{{ADDON_ID}}.settings.platforms.{{PLATFORM_ID}}" data-checked="{{PLATFORM_CHECKED}}" {{PLATFORM_DISABLED_ATTR}}>
            <span class="te-toggle-slider"></span>
        </label>
        <span class="te-platform-label">{{PLATFORM_LABEL}}</span>
    </div>
</template>

<template id="te-addon-setting-egg-selector">
    <div class="te-addon-setting-field">
        <label class="te-label">{{SETTING_LABEL}}</label>
        <div class="te-egg-selector">
            <div class="te-egg-selector-header">
                <input type="text" class="te-input te-egg-selector-search" placeholder="Search eggs...">
                <span class="te-egg-selector-count" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}">{{SELECTED_COUNT}} selected</span>
            </div>
            <div class="te-egg-selector-list">
                {{EGG_OPTIONS}}
            </div>
        </div>
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-addon-setting-action">
    <div class="te-addon-setting-field">
        <label class="te-label">{{SETTING_LABEL}}</label>
        <div class="te-addon-action-row">
            <button type="button" class="te-btn te-btn-{{BUTTON_STYLE}}" data-addon-action="{{ACTION_ID}}" data-confirm="{{CONFIRM_TEXT}}">
                <i class="fa fa-{{BUTTON_ICON}}"></i> {{BUTTON_LABEL}}
            </button>
        </div>
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>
<template id="te-addon-setting-egg-config">
    <div class="te-addon-setting-field">
        <label class="te-label">{{SETTING_LABEL}}</label>
        <div class="te-egg-config-container" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}">
            <div class="te-egg-config-list">
                {{EGG_CONFIG_ITEMS}}
            </div>
        </div>
        <p class="te-help-text">{{SETTING_DESCRIPTION}}</p>
    </div>
</template>

<template id="te-addon-egg-config-item">
    <div class="te-domain-config-item" data-egg-config-id="{{EGG_ID}}">
        <div class="te-domain-config-main">
            <div class="te-domain-config-info">
                <span class="te-domain-config-name">{{EGG_NAME}}</span>
                <span class="te-domain-config-meta">{{EGG_META}}</span>
            </div>
            <div class="te-domain-config-actions">
                <button type="button" class="te-btn te-btn-sm te-btn-secondary" data-action="edit-egg-config" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}" data-egg-id="{{EGG_ID}}">
                    <i class="fa fa-pencil w-4 h-4"></i> Edit
                </button>
                <button type="button" class="te-btn te-btn-sm te-btn-danger" data-action="reset-egg-config" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}" data-egg-id="{{EGG_ID}}">
                    <i class="fa fa-undo w-4 h-4"></i>
                </button>
            </div>
        </div>
    </div>
</template>

<template id="te-egg-config-modal">
    <div class="te-modal-overlay" data-modal="egg-config">
        <div class="te-modal te-modal-lg">
            <div class="te-modal-header">
                <h3 class="te-modal-title">Configure {{EGG_NAME}}</h3>
                <button type="button" class="te-modal-close" data-action="close-egg-config-modal">
                    <i class="fa fa-times"></i>
                </button>
            </div>
            <div class="te-modal-body">
                <div class="te-form-divider">
                    <span>SRV Record Settings</span>
                </div>
                <p class="te-help-text" style="margin-bottom: 12px;">Configure SRV record details for this egg. Users will see an SRV record generator based on these settings.</p>
                <div class="te-form-row">
                    <div class="te-form-group te-form-col">
                        <label class="te-label">SRV Service</label>
                        <input type="text" class="te-input" data-field="srv_service" placeholder="_minecraft" value="{{SRV_SERVICE_VALUE}}">
                        <p class="te-help-text">e.g. _minecraft, _ts3, _hytale</p>
                    </div>
                    <div class="te-form-group te-form-col">
                        <label class="te-label">SRV Protocol</label>
                        <select class="te-input" data-field="srv_protocol">
                            <option value="" {{SRV_NONE_SELECTED}}>No SRV</option>
                            <option value="_tcp" {{SRV_TCP_SELECTED}}>TCP</option>
                            <option value="_udp" {{SRV_UDP_SELECTED}}>UDP</option>
                        </select>
                    </div>
                </div>
                <div class="te-form-group">
                    <label class="te-label">Connection Display Mode</label>
                    <select class="te-input" data-field="connection_display_mode">
                        <option value="srv" {{CONNECTION_DISPLAY_SRV_SELECTED}}>SRV Record (Subdomain Only)</option>
                        <option value="ip_port" {{CONNECTION_DISPLAY_IP_PORT_SELECTED}}>IP Connection (Subdomain:Port)</option>
                    </select>
                    <p class="te-help-text">Controls how the connection address is shown to players. "SRV Record" shows just the subdomain (for Minecraft, Hytale). "IP Connection" shows subdomain:port (for Steam games, most dedicated servers).</p>
                </div>
                <div class="te-form-divider" style="margin-top: 16px;">
                    <span>Allowed Target Eggs</span>
                </div>
                <p class="te-help-text" style="margin-bottom: 12px;">Select which eggs this egg can switch to. Leave all unchecked to allow switching to any available egg.</p>
                <div class="te-egg-config-targets">
                    <div class="te-egg-selector">
                        <div class="te-egg-selector-header">
                            <input type="text" class="te-input te-egg-config-target-search" placeholder="Search eggs...">
                            <span class="te-egg-selector-count" data-target-count>{{TARGET_COUNT}} selected</span>
                        </div>
                        <div class="te-egg-selector-list" data-field="allowed_targets">
                            {{TARGET_EGG_OPTIONS}}
                        </div>
                    </div>
                </div>
            </div>
            <div class="te-modal-footer">
                <button type="button" class="te-btn te-btn-secondary" data-action="close-egg-config-modal">Cancel</button>
                <button type="button" class="te-btn te-btn-primary" data-action="save-egg-config" data-addon-id="{{ADDON_ID}}" data-setting-id="{{SETTING_ID}}" data-egg-id="{{EGG_ID}}">
                    <i class="fa fa-save"></i> Save Configuration
                </button>
            </div>
        </div>
    </div>
</template>
@endverbatim
