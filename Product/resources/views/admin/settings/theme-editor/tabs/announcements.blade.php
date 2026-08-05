@verbatim
<template id="te-tab-announcements">
    <div class="te-announcements-manager">
        <div class="te-announcements-header">
            <div>
                <h2 class="te-announcements-title">Announcements</h2>
                <p class="te-announcements-subtitle">Create and manage announcements for your servers</p>
            </div>
            <button type="button" class="te-btn te-btn-primary" id="te-create-announcement-btn">
                <i class="fa fa-plus"></i>
                Create Announcement
            </button>
        </div>

        <div class="te-announcements-list" id="te-announcements-list">
            <div class="te-announcements-loading">
                <i class="fa fa-spinner fa-spin"></i>
                <span>Loading announcements...</span>
            </div>
        </div>
    </div>
</template>

<template id="te-announcement-modal">
    <div class="te-modal-overlay visible" id="announcementModal">
        <div class="te-modal te-announcement-modal">
            <div class="te-modal-header">
                <span class="te-modal-title" id="te-announcement-modal-title">Create Announcement</span>
            </div>
            <div class="te-modal-body">
                <form id="te-announcement-form">
                    <input type="hidden" id="te-announcement-id" name="id">
                    
                    <div class="te-field">
                        <label class="te-label">Nodes</label>
                        <div class="te-egg-selector" data-announcement-node-selector>
                            <div class="te-egg-selector-header">
                                <input type="text" class="te-input te-egg-selector-search" placeholder="Search nodes...">
                                <span class="te-egg-selector-count" data-announcement-node-count>All nodes</span>
                            </div>
                            <div class="te-egg-selector-list" data-announcement-node-list></div>
                        </div>
                        <p class="te-help-text">Select specific nodes to target certain locations, or choose All to show on every node.</p>
                    </div>
                    
                    <div class="te-field">
                        <label class="te-label">Variation</label>
                        <div class="te-layout-grid te-announcement-variant-grid">
                            <label class="te-layout-option">
                                <input type="radio" name="variation" value="split" checked>
                                <div class="te-layout-preview te-announcement-preview te-announcement-preview-split">
                                    <div class="te-announcement-preview-pill"></div>
                                    <div class="te-announcement-preview-body">
                                        <div class="te-announcement-preview-line"></div>
                                        <div class="te-announcement-preview-line short"></div>
                                    </div>
                                </div>
                                <span class="te-layout-name">Border</span>
                                <span class="te-layout-desc">Left accent with soft fill</span>
                            </label>
                            <label class="te-layout-option">
                                <input type="radio" name="variation" value="solid">
                                <div class="te-layout-preview te-announcement-preview te-announcement-preview-solid">
                                    <div class="te-announcement-preview-pill"></div>
                                    <div class="te-announcement-preview-body">
                                        <div class="te-announcement-preview-line"></div>
                                        <div class="te-announcement-preview-line short"></div>
                                    </div>
                                </div>
                                <span class="te-layout-name">Solid Bar</span>
                                <span class="te-layout-desc">Bold, high-contrast banner</span>
                            </label>
                            <label class="te-layout-option">
                                <input type="radio" name="variation" value="outline">
                                <div class="te-layout-preview te-announcement-preview te-announcement-preview-outline">
                                    <div class="te-announcement-preview-pill"></div>
                                    <div class="te-announcement-preview-body">
                                        <div class="te-announcement-preview-line"></div>
                                        <div class="te-announcement-preview-line short"></div>
                                    </div>
                                </div>
                                <span class="te-layout-name">Outline</span>
                                <span class="te-layout-desc">Light border with clear focus</span>
                            </label>
                        </div>
                    </div>

                    <div class="te-field">
                        <label class="te-label">Placement</label>
                        <div class="te-layout-grid te-announcement-location-grid">
                            <label class="te-layout-option">
                                <input type="radio" name="placement" value="above-content" checked>
                                <div class="te-layout-preview te-announcement-location-preview te-announcement-location-above">
                                    <div class="te-announcement-location-card"></div>
                                    <div class="te-announcement-location-spacer"></div>
                                    <div class="te-announcement-location-body"></div>
                                </div>
                                <span class="te-layout-name">Above Content</span>
                                <span class="te-layout-desc">Sits above server content</span>
                            </label>
                            <label class="te-layout-option">
                                <input type="radio" name="placement" value="topbar">
                                <div class="te-layout-preview te-announcement-location-preview te-announcement-location-topbar">
                                    <div class="te-announcement-location-fixed"></div>
                                    <div class="te-announcement-location-body"></div>
                                </div>
                                <span class="te-layout-name">Top Bar</span>
                                <span class="te-layout-desc">Fixed to the top of the page</span>
                            </label>
                        </div>
                    </div>

                    <div class="te-field">
                        <label class="te-label">Type</label>
                        <div class="te-layout-grid te-announcement-type-grid">
                            <label class="te-layout-option" title="Info">
                                <input type="radio" name="type" value="info" checked>
                                <div class="te-announcement-type-preview te-announcement-type-info"></div>
                                <span class="te-announcement-type-label">Info</span>
                            </label>
                            <label class="te-layout-option" title="Success">
                                <input type="radio" name="type" value="success">
                                <div class="te-announcement-type-preview te-announcement-type-success"></div>
                                <span class="te-announcement-type-label">Success</span>
                            </label>
                            <label class="te-layout-option" title="Warning">
                                <input type="radio" name="type" value="warning">
                                <div class="te-announcement-type-preview te-announcement-type-warning"></div>
                                <span class="te-announcement-type-label">Warning</span>
                            </label>
                            <label class="te-layout-option" title="Error">
                                <input type="radio" name="type" value="error">
                                <div class="te-announcement-type-preview te-announcement-type-error"></div>
                                <span class="te-announcement-type-label">Error</span>
                            </label>
                        </div>
                    </div>

                    <div class="te-field">
                        <label class="te-label">Icon</label>
                        <div class="te-icon-picker" data-name="icon">
                            <button type="button" class="te-icon-picker-trigger">
                                <i class="fa fa-bullhorn"></i>
                                <span>bullhorn</span>
                                <i class="fa fa-chevron-down te-icon-picker-arrow"></i>
                            </button>
                            <div class="te-icon-picker-dropdown">
                                <input type="text" class="te-icon-picker-search" placeholder="Search icons...">
                                <div class="te-icon-picker-list"></div>
                            </div>
                        </div>
                        <input type="hidden" name="icon" value="bullhorn">
                    </div>

                    <div class="te-field">
                        <label class="te-label">Title</label>
                        <input type="text" class="te-input" name="title" placeholder="New updates are live">
                    </div>

                    <div class="te-field">
                        <label class="te-label">Text</label>
                        <textarea class="te-input te-textarea" name="text" rows="3" placeholder="Share important updates or notices to server owners."></textarea>
                    </div>

                    <div class="te-field-grid">
                        <div class="te-field">
                            <label class="te-label">Button Label</label>
                            <input type="text" class="te-input" name="button_label" placeholder="Read more">
                        </div>
                        <div class="te-field">
                            <label class="te-label">Button Link</label>
                            <input type="text" class="te-input" name="button_link" placeholder="/announcements">
                        </div>
                    </div>

                    <div class="te-field">
                        <label class="te-label">Eggs</label>
                        <div class="te-egg-selector" data-announcement-egg-selector>
                            <div class="te-egg-selector-header">
                                <input type="text" class="te-input te-egg-selector-search" placeholder="Search eggs...">
                                <span class="te-egg-selector-count" data-announcement-egg-count>All eggs</span>
                            </div>
                            <div class="te-egg-selector-list" data-announcement-egg-list></div>
                        </div>
                        <p class="te-help-text">Select specific eggs to target certain server types, or choose All to show on every egg.</p>
                    </div>

                    <div class="te-field">
                        <label class="te-label">Expiry</label>
                        <div class="te-toggle-field">
                            <label class="te-toggle">
                                <input type="checkbox" name="is_permanent" checked id="te-is-permanent">
                                <span class="te-toggle-slider"></span>
                            </label>
                            <span class="te-toggle-label">Permanent (never expires)</span>
                        </div>
                        <div class="te-expiry-datetime" id="te-expiry-datetime" style="display: none; margin-top: 12px;">
                            <input type="datetime-local" class="te-input" name="expires_at" id="te-expires-at">
                        </div>
                    </div>
                </form>
            </div>
            <div class="te-modal-footer">
                <button type="button" class="te-btn te-btn-secondary" data-action="close-announcement-modal">Cancel</button>
                <button type="button" class="te-btn te-btn-primary" id="te-save-announcement-btn">
                    <span id="te-save-announcement-text">Create</span>
                </button>
            </div>
        </div>
    </div>
</template>
@endverbatim
