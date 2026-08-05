@verbatim
<template id="te-tab-components">
    <div class="te-components-page">
        <div class="te-components-grid">
            <div class="te-component-section">
                <div class="te-component-section-header">
                    <span class="te-component-section-title">Server Card</span>
                    <span class="te-component-section-desc">Choose how server cards appear on the dashboard</span>
                </div>
                <div class="te-component-options">
                    <label class="te-component-option {{SERVER_CARD_DEFAULT_ACTIVE}}">
                        <input type="radio" name="server_card" data-path="components.server_card" value="default" {{SERVER_CARD_DEFAULT_CHECKED}}>
                        <div class="te-component-preview te-server-card-preview te-server-card-default">
                            <div class="te-sc-header">
                                <div class="te-sc-title"></div>
                                <div class="te-sc-status-badge">
                                    <div class="te-sc-status-dot"></div>
                                    <div class="te-sc-status-text"></div>
                                </div>
                            </div>
                            <div class="te-sc-stats-row">
                                <div class="te-sc-stat-item">
                                    <div class="te-sc-stat-icon"></div>
                                    <div class="te-sc-stat-val"></div>
                                </div>
                                <div class="te-sc-stat-item">
                                    <div class="te-sc-stat-icon"></div>
                                    <div class="te-sc-stat-val"></div>
                                </div>
                                <div class="te-sc-stat-item">
                                    <div class="te-sc-stat-icon"></div>
                                    <div class="te-sc-stat-val"></div>
                                </div>
                            </div>
                        </div>
                        <span class="te-component-name">Default</span>
                        <span class="te-component-desc">Classic layout with stats row</span>
                    </label>
                    <label class="te-component-option {{SERVER_CARD_COMPACT_ACTIVE}}">
                        <input type="radio" name="server_card" data-path="components.server_card" value="compact" {{SERVER_CARD_COMPACT_CHECKED}}>
                        <div class="te-component-preview te-server-card-preview te-server-card-compact">
                            <div class="te-sc-compact-top">
                                <div class="te-sc-icon-sm"></div>
                                <div class="te-sc-status-dot-sm"></div>
                            </div>
                            <div class="te-sc-compact-body">
                                <div class="te-sc-title"></div>
                                <div class="te-sc-subtitle"></div>
                            </div>
                            <div class="te-sc-progress-wrap">
                                <div class="te-sc-progress-bar">
                                    <div class="te-sc-progress-fill"></div>
                                </div>
                            </div>
                            <div class="te-sc-compact-stats">
                                <div class="te-sc-compact-stat"></div>
                                <div class="te-sc-compact-stat"></div>
                            </div>
                        </div>
                        <span class="te-component-name">Compact</span>
                        <span class="te-component-desc">Vertical card with progress bar</span>
                    </label>
                    <label class="te-component-option {{SERVER_CARD_MINIMAL_ACTIVE}}">
                        <input type="radio" name="server_card" data-path="components.server_card" value="minimal" {{SERVER_CARD_MINIMAL_CHECKED}}>
                        <div class="te-component-preview te-server-card-preview te-server-card-minimal">
                            <div class="te-sc-minimal-accent"></div>
                            <div class="te-sc-minimal-body">
                                <div class="te-sc-minimal-top">
                                    <div class="te-sc-title"></div>
                                    <div class="te-sc-status-badge">
                                        <div class="te-sc-status-dot"></div>
                                        <div class="te-sc-status-text"></div>
                                    </div>
                                </div>
                                <div class="te-sc-subtitle"></div>
                                <div class="te-sc-minimal-stats">
                                    <div class="te-sc-minimal-stat"></div>
                                    <div class="te-sc-minimal-stat"></div>
                                    <div class="te-sc-minimal-stat"></div>
                                </div>
                            </div>
                        </div>
                        <span class="te-component-name">Minimal</span>
                        <span class="te-component-desc">Horizontal row with accent bar</span>
                    </label>
                    <label class="te-component-option {{SERVER_CARD_DETAILED_ACTIVE}}">
                        <input type="radio" name="server_card" data-path="components.server_card" value="detailed" {{SERVER_CARD_DETAILED_CHECKED}}>
                        <div class="te-component-preview te-server-card-preview te-server-card-detailed">
                            <div class="te-sc-detailed-header">
                                <div class="te-sc-detailed-meta">
                                    <div class="te-sc-title"></div>
                                    <div class="te-sc-subtitle"></div>
                                </div>
                                <div class="te-sc-status-badge">
                                    <div class="te-sc-status-dot"></div>
                                    <div class="te-sc-status-text"></div>
                                </div>
                            </div>
                            <div class="te-sc-detailed-stats">
                                <div class="te-sc-detailed-stat">
                                    <div class="te-sc-stat-label"></div>
                                    <div class="te-sc-stat-value"></div>
                                </div>
                                <div class="te-sc-detailed-stat">
                                    <div class="te-sc-stat-label"></div>
                                    <div class="te-sc-stat-value"></div>
                                </div>
                                <div class="te-sc-detailed-stat">
                                    <div class="te-sc-stat-label"></div>
                                    <div class="te-sc-stat-value"></div>
                                </div>
                            </div>
                        </div>
                        <span class="te-component-name">Detailed</span>
                        <span class="te-component-desc">Stats grid with labels</span>
                    </label>
                </div>
            </div>

            <div class="te-component-section">
                <div class="te-component-section-header">
                    <span class="te-component-section-title">Power Dock</span>
                    <span class="te-component-section-desc">Position of server power controls</span>
                </div>
                <div class="te-component-options">
                    <label class="te-component-option {{POWER_DOCK_DOCK_ACTIVE}}">
                        <input type="radio" name="power_dock" data-path="components.power_dock" value="dock" {{POWER_DOCK_DOCK_CHECKED}}>
                        <div class="te-component-preview te-power-dock-preview te-power-dock-dock">
                            <div class="te-pd-sidebar">
                                <div class="te-pd-nav-item"></div>
                                <div class="te-pd-nav-item"></div>
                            </div>
                            <div class="te-pd-main">
                                <div class="te-pd-content"></div>
                                <div class="te-pd-dock">
                                    <div class="te-pd-btn"></div>
                                    <div class="te-pd-btn"></div>
                                    <div class="te-pd-btn te-pd-btn-accent"></div>
                                </div>
                            </div>
                        </div>
                        <span class="te-component-name">Bottom Dock</span>
                        <span class="te-component-desc">Fixed dock at bottom of content</span>
                    </label>
                    <label class="te-component-option {{POWER_DOCK_DOCK_LABELS_ACTIVE}}">
                        <input type="radio" name="power_dock" data-path="components.power_dock" value="dock_labels" {{POWER_DOCK_DOCK_LABELS_CHECKED}}>
                        <div class="te-component-preview te-power-dock-preview te-power-dock-dock-labels">
                            <div class="te-pd-sidebar">
                                <div class="te-pd-nav-item"></div>
                                <div class="te-pd-nav-item"></div>
                            </div>
                            <div class="te-pd-main">
                                <div class="te-pd-content"></div>
                                <div class="te-pd-dock te-pd-dock-with-labels">
                                    <div class="te-pd-btn-with-label">
                                        <div class="te-pd-btn"></div>
                                        <div class="te-pd-label"></div>
                                    </div>
                                    <div class="te-pd-btn-with-label">
                                        <div class="te-pd-btn"></div>
                                        <div class="te-pd-label"></div>
                                    </div>
                                    <div class="te-pd-btn-with-label">
                                        <div class="te-pd-btn te-pd-btn-accent"></div>
                                        <div class="te-pd-label"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <span class="te-component-name">Dock with Labels</span>
                        <span class="te-component-desc">Fixed dock with visible labels</span>
                    </label>
                    <label class="te-component-option {{POWER_DOCK_SIDEBAR_ACTIVE}}">
                        <input type="radio" name="power_dock" data-path="components.power_dock" value="sidebar" {{POWER_DOCK_SIDEBAR_CHECKED}}>
                        <div class="te-component-preview te-power-dock-preview te-power-dock-sidebar">
                            <div class="te-pd-sidebar">
                                <div class="te-pd-sidebar-controls">
                                    <div class="te-pd-btn-sm"></div>
                                    <div class="te-pd-btn-sm"></div>
                                    <div class="te-pd-btn-sm te-pd-btn-accent"></div>
                                </div>
                                <div class="te-pd-server-header">
                                    <div class="te-pd-server-title"></div>
                                    <div class="te-pd-server-status"></div>
                                </div>
                                <div class="te-pd-nav-item"></div>
                                <div class="te-pd-nav-item"></div>
                            </div>
                            <div class="te-pd-main">
                                <div class="te-pd-content"></div>
                            </div>
                        </div>
                        <span class="te-component-name">Top of Sidebar</span>
                        <span class="te-component-desc">Controls above server title</span>
                    </label>
                    <label class="te-component-option {{POWER_DOCK_TOPBAR_ACTIVE}}">
                        <input type="radio" name="power_dock" data-path="components.power_dock" value="topbar" {{POWER_DOCK_TOPBAR_CHECKED}}>
                        <div class="te-component-preview te-power-dock-preview te-power-dock-topbar">
                            <div class="te-pd-sidebar">
                                <div class="te-pd-nav-item"></div>
                                <div class="te-pd-nav-item"></div>
                            </div>
                            <div class="te-pd-main">
                                <div class="te-pd-topbar-row">
                                    <div class="te-pd-topbar-title"></div>
                                    <div class="te-pd-topbar-controls">
                                        <div class="te-pd-btn-sm"></div>
                                        <div class="te-pd-btn-sm"></div>
                                        <div class="te-pd-btn-sm te-pd-btn-accent"></div>
                                    </div>
                                </div>
                                <div class="te-pd-content"></div>
                            </div>
                        </div>
                        <span class="te-component-name">Row Above Content</span>
                        <span class="te-component-desc">Horizontal bar above main content</span>
                    </label>
                </div>
            </div>

            <div class="te-component-section">
                <div class="te-component-section-header">
                    <span class="te-component-section-title">Stat Cards</span>
                    <span class="te-component-section-desc">Style for CPU, Memory, Disk, and Address cards</span>
                </div>
                <div class="te-component-options te-component-options">
                    <label class="te-component-option {{STAT_CARD_DEFAULT_ACTIVE}}">
                        <input type="radio" name="stat_card" data-path="components.stat_card" value="default" {{STAT_CARD_DEFAULT_CHECKED}}>
                        <div class="te-component-preview te-stat-card-preview te-stat-card-default">
                            <div class="te-stc-icon"></div>
                            <div class="te-stc-body">
                                <div class="te-stc-label"></div>
                                <div class="te-stc-value"></div>
                            </div>
                        </div>
                        <span class="te-component-name">Default</span>
                        <span class="te-component-desc">Icon left, value right</span>
                    </label>
                    <label class="te-component-option {{STAT_CARD_CENTERED_ACTIVE}}">
                        <input type="radio" name="stat_card" data-path="components.stat_card" value="centered" {{STAT_CARD_CENTERED_CHECKED}}>
                        <div class="te-component-preview te-stat-card-preview te-stat-card-centered">
                            <div class="te-stc-icon-center"></div>
                            <div class="te-stc-value-center"></div>
                            <div class="te-stc-label-center"></div>
                        </div>
                        <span class="te-component-name">Centered</span>
                        <span class="te-component-desc">Stacked centered layout</span>
                    </label>
                    <label class="te-component-option {{STAT_CARD_MINIMAL_ACTIVE}}">
                        <input type="radio" name="stat_card" data-path="components.stat_card" value="minimal" {{STAT_CARD_MINIMAL_CHECKED}}>
                        <div class="te-component-preview te-stat-card-preview te-stat-card-minimal">
                            <div class="te-stc-minimal-top">
                                <div class="te-stc-label"></div>
                                <div class="te-stc-icon-sm"></div>
                            </div>
                            <div class="te-stc-value-lg"></div>
                        </div>
                        <span class="te-component-name">Minimal</span>
                        <span class="te-component-desc">Small icon, large value</span>
                    </label>
                    <label class="te-component-option {{STAT_CARD_GRADIENT_ACTIVE}}">
                        <input type="radio" name="stat_card" data-path="components.stat_card" value="gradient" {{STAT_CARD_GRADIENT_CHECKED}}>
                        <div class="te-component-preview te-stat-card-preview te-stat-card-reversed">
                            <div class="te-stc-body">
                                <div class="te-stc-label"></div>
                                <div class="te-stc-value"></div>
                            </div>
                            <div class="te-stc-icon"></div>
                        </div>
                        <span class="te-component-name">Reversed</span>
                        <span class="te-component-desc">Icon on right, text on left</span>
                    </label>
                    <label class="te-component-option {{STAT_CARD_COMPACT_ACTIVE}}">
                        <input type="radio" name="stat_card" data-path="components.stat_card" value="compact" {{STAT_CARD_COMPACT_CHECKED}}>
                        <div class="te-component-preview te-stat-card-preview te-stat-card-compact">
                            <div class="te-stc-accent-bar"></div>
                            <div class="te-stc-icon-compact"></div>
                            <div class="te-stc-inline-content">
                                <div class="te-stc-value-inline"></div>
                                <div class="te-stc-label-inline"></div>
                            </div>
                        </div>
                        <span class="te-component-name">Compact</span>
                        <span class="te-component-desc">Inline single-row layout</span>
                    </label>
                    <label class="te-component-option {{STAT_CARD_SPLIT_ACTIVE}}">
                        <input type="radio" name="stat_card" data-path="components.stat_card" value="split" {{STAT_CARD_SPLIT_CHECKED}}>
                        <div class="te-component-preview te-stat-card-preview te-stat-card-split">
                            <div class="te-stc-icon-section">
                                <div class="te-stc-icon-box"></div>
                            </div>
                            <div class="te-stc-content-section">
                                <div class="te-stc-value-split"></div>
                                <div class="te-stc-label-split"></div>
                            </div>
                        </div>
                        <span class="te-component-name">Split</span>
                        <span class="te-component-desc">Two-tone icon section</span>
                    </label>
                </div>
            </div>

            <div class="te-component-section te-component-section-wide">
                <div class="te-component-section-header">
                    <span class="te-component-section-title">Minecraft Player Count</span>
                    <span class="te-component-section-desc">Show live online and max player counts for selected Minecraft eggs</span>
                </div>
                <div class="te-player-count-settings">
                    <div class="te-addon-setting-field">
                        <div class="te-player-count-toggle">
                            <label class="te-toggle">
                                <input type="checkbox" data-path="components.player_count.enabled" data-checked="{{PLAYER_COUNT_ENABLED}}">
                                <span class="te-toggle-slider"></span>
                            </label>
                            <div>
                                <label class="te-label" style="margin-bottom: 0;">Enable Player Count</label>
                                <p class="te-help-text" style="margin-top: 0;">Poll Minecraft server status every 5 seconds for servers using selected eggs.</p>
                            </div>
                        </div>
                    </div>

                    <div class="te-addon-setting-field">
                        <label class="te-label">Placement</label>
                        <div class="te-component-options te-component-options-3">
                            <label class="te-component-option {{PLAYER_COUNT_SIDEBAR_ACTIVE}}">
                                <input type="radio" name="player_count_placement" data-path="components.player_count.placement" value="sidebar" {{PLAYER_COUNT_SIDEBAR_CHECKED}}>
                                <div class="te-component-preview te-player-count-preview te-player-count-sidebar">
                                    <div class="te-pc-sidebar-shell">
                                        <div class="te-pc-server-title"></div>
                                        <div class="te-pc-address"></div>
                                        <div class="te-pc-pill">
                                            <i class="fa fa-users"></i>
                                            <span>12 / 20</span>
                                        </div>
                                    </div>
                                </div>
                                <span class="te-component-name">Sidebar</span>
                                <span class="te-component-desc">Below the server address in the sidebar</span>
                            </label>
                            <label class="te-component-option {{PLAYER_COUNT_STAT_BLOCK_ACTIVE}}">
                                <input type="radio" name="player_count_placement" data-path="components.player_count.placement" value="stat_block" {{PLAYER_COUNT_STAT_BLOCK_CHECKED}}>
                                <div class="te-component-preview te-player-count-preview te-player-count-stat">
                                    <div class="te-pc-stat-card">
                                        <div class="te-pc-stat-icon"><i class="fa fa-users"></i></div>
                                        <div class="te-pc-stat-copy">
                                            <div class="te-pc-stat-label"></div>
                                            <div class="te-pc-stat-value"></div>
                                        </div>
                                    </div>
                                </div>
                                <span class="te-component-name">Stat Widget</span>
                                <span class="te-component-desc">With the CPU, memory, disk, and address cards</span>
                            </label>
                            <label class="te-component-option {{PLAYER_COUNT_SERVER_CARD_ACTIVE}}">
                                <input type="radio" name="player_count_placement" data-path="components.player_count.placement" value="server_card" {{PLAYER_COUNT_SERVER_CARD_CHECKED}}>
                                <div class="te-component-preview te-player-count-preview te-player-count-card">
                                    <div class="te-pc-dashboard-card">
                                        <div class="te-pc-card-top"></div>
                                        <div class="te-pc-card-stats">
                                            <div></div>
                                            <div></div>
                                            <div></div>
                                            <div class="te-pc-card-player"><i class="fa fa-users"></i></div>
                                        </div>
                                    </div>
                                </div>
                                <span class="te-component-name">Server Card</span>
                                <span class="te-component-desc">Inside each dashboard server card</span>
                            </label>
                        </div>
                    </div>

                    <div class="te-addon-setting-field">
                        <label class="te-label">Enabled Eggs</label>
                        <div class="te-egg-selector">
                            <div class="te-egg-selector-header">
                                <input type="text" class="te-input te-egg-selector-search" placeholder="Search eggs...">
                                <span class="te-egg-selector-count" data-component-setting-id="player_count.allowed_eggs">{{PLAYER_COUNT_EGGS_COUNT}}</span>
                            </div>
                            <div class="te-egg-selector-list">
                                {{PLAYER_COUNT_EGGS_OPTIONS}}
                            </div>
                        </div>
                        <p class="te-help-text">Select the Minecraft eggs that should show the player count. If no eggs are selected, it will not show anywhere.</p>
                    </div>
                </div>
            </div>

            <div class="te-component-section">
                <div class="te-component-section-header">
                    <span class="te-component-section-title">Sidebar Item Style</span>
                    <span class="te-component-section-desc">Choose how active and hovered sidebar links are highlighted</span>
                </div>
                <div class="te-component-options te-component-options-4">
                    <label class="te-component-option {{SIDEBAR_ITEM_DEFAULT_ACTIVE}}">
                        <input type="radio" name="sidebar_item_style" data-path="components.sidebar_item_style" value="default" {{SIDEBAR_ITEM_DEFAULT_CHECKED}}>
                        <div class="te-component-preview te-sidebar-item-preview te-sidebar-item-default">
                            <div class="te-sip-stage">
                                <div class="te-sip-demo">
                                    <div class="te-sip-item te-sip-item-active">
                                        <i class="fas fa-folder-open"></i>
                                        <span class="te-sip-label">Files</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <span class="te-component-name">Default</span>
                        <span class="te-component-desc">Accent bar with the current soft fill</span>
                    </label>
                    <label class="te-component-option {{SIDEBAR_ITEM_SOLID_ACTIVE}}">
                        <input type="radio" name="sidebar_item_style" data-path="components.sidebar_item_style" value="solid" {{SIDEBAR_ITEM_SOLID_CHECKED}}>
                        <div class="te-component-preview te-sidebar-item-preview te-sidebar-item-solid">
                            <div class="te-sip-stage">
                                <div class="te-sip-demo">
                                    <div class="te-sip-item te-sip-item-active">
                                        <i class="fas fa-folder-open"></i>
                                        <span class="te-sip-label">Files</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <span class="te-component-name">Solid Fill</span>
                        <span class="te-component-desc">Rounded primary block with no accent bar</span>
                    </label>
                    <label class="te-component-option {{SIDEBAR_ITEM_GRADIENT_ACTIVE}}">
                        <input type="radio" name="sidebar_item_style" data-path="components.sidebar_item_style" value="gradient" {{SIDEBAR_ITEM_GRADIENT_CHECKED}}>
                        <div class="te-component-preview te-sidebar-item-preview te-sidebar-item-gradient">
                            <div class="te-sip-stage">
                                <div class="te-sip-demo">
                                    <div class="te-sip-item te-sip-item-active">
                                        <i class="fas fa-folder-open"></i>
                                        <span class="te-sip-label">Files</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <span class="te-component-name">Gradient Accent</span>
                        <span class="te-component-desc">Keeps the accent bar with a right-to-left fade</span>
                    </label>
                    <label class="te-component-option {{SIDEBAR_ITEM_GRADIENT_NO_BORDER_ACTIVE}}">
                        <input type="radio" name="sidebar_item_style" data-path="components.sidebar_item_style" value="gradient_no_border" {{SIDEBAR_ITEM_GRADIENT_NO_BORDER_CHECKED}}>
                        <div class="te-component-preview te-sidebar-item-preview te-sidebar-item-gradient-no-border">
                            <div class="te-sip-stage">
                                <div class="te-sip-demo">
                                    <div class="te-sip-item te-sip-item-active">
                                        <i class="fas fa-folder-open"></i>
                                        <span class="te-sip-label">Files</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <span class="te-component-name">Gradient Clean</span>
                        <span class="te-component-desc">Soft right-to-left fade without the accent bar</span>
                    </label>
                </div>
            </div>

            <div class="te-component-section te-component-section-wide">
                <div class="te-component-section-header">
                    <span class="te-component-section-title">Login Page</span>
                    <span class="te-component-section-desc">Choose the layout for your login page</span>
                </div>
                <div class="te-component-options te-component-options-4">
                    <label class="te-component-option {{LOGIN_PAGE_CENTERED_ACTIVE}}">
                        <input type="radio" name="login_page" data-path="components.login_page" value="centered" {{LOGIN_PAGE_CENTERED_CHECKED}}>
                        <div class="te-component-preview te-login-preview te-login-centered">
                            <div class="te-login-card">
                                <div class="te-login-logo"></div>
                                <div class="te-login-input"></div>
                                <div class="te-login-input"></div>
                                <div class="te-login-btn"></div>
                            </div>
                        </div>
                        <span class="te-component-name">Centered Card</span>
                        <span class="te-component-desc">Classic centered login card</span>
                    </label>
                    <label class="te-component-option {{LOGIN_PAGE_MINIMAL_ACTIVE}}">
                        <input type="radio" name="login_page" data-path="components.login_page" value="minimal" {{LOGIN_PAGE_MINIMAL_CHECKED}}>
                        <div class="te-component-preview te-login-preview te-login-minimal">
                            <div class="te-login-minimal-content">
                                <div class="te-login-logo"></div>
                                <div class="te-login-title"></div>
                                <div class="te-login-input"></div>
                                <div class="te-login-input"></div>
                                <div class="te-login-btn"></div>
                            </div>
                        </div>
                        <span class="te-component-name">Minimal</span>
                        <span class="te-component-desc">No card, clean background</span>
                    </label>
                    <label class="te-component-option {{LOGIN_PAGE_SPLIT_LEFT_ACTIVE}}">
                        <input type="radio" name="login_page" data-path="components.login_page" value="split_left" {{LOGIN_PAGE_SPLIT_LEFT_CHECKED}}>
                        <div class="te-component-preview te-login-preview te-login-split-left">
                            <div class="te-login-left-panel">
                                <div class="te-login-logo"></div>
                                <div class="te-login-title"></div>
                                <div class="te-login-input"></div>
                                <div class="te-login-input"></div>
                                <div class="te-login-btn"></div>
                            </div>
                            <div class="te-login-right-panel"></div>
                        </div>
                        <span class="te-component-name">Split Left</span>
                        <span class="te-component-desc">Form left, image/colour right</span>
                    </label>
                    <label class="te-component-option {{LOGIN_PAGE_SPLIT_CARD_ACTIVE}}">
                        <input type="radio" name="login_page" data-path="components.login_page" value="split_card" {{LOGIN_PAGE_SPLIT_CARD_CHECKED}}>
                        <div class="te-component-preview te-login-preview te-login-split-card">
                            <div class="te-login-wide-card">
                                <div class="te-login-card-left">
                                    <div class="te-login-logo"></div>
                                    <div class="te-login-title"></div>
                                    <div class="te-login-input"></div>
                                    <div class="te-login-input"></div>
                                    <div class="te-login-btn"></div>
                                </div>
                                <div class="te-login-card-right"></div>
                            </div>
                        </div>
                        <span class="te-component-name">Split Card</span>
                        <span class="te-component-desc">Wide card with two halves</span>
                    </label>
                </div>
                <div class="te-login-panel-settings {{LOGIN_PANEL_SETTINGS_VISIBLE}}">
                    <div class="te-login-panel-divider"></div>
                    <div class="te-login-panel-header">
                        <span class="te-login-panel-title">Panel Background</span>
                        <span class="te-login-panel-subtitle">Customise the right panel appearance</span>
                    </div>
                    <div class="te-login-panel-type">
                        <label class="te-login-panel-type-option {{LOGIN_PANEL_TYPE_IMAGE_ACTIVE}}">
                            <input type="radio" name="login_panel_bg_type" data-path="components.login_panel_bg_type" value="image" {{LOGIN_PANEL_TYPE_IMAGE_CHECKED}}>
                            <i class="fa fa-image"></i>
                            <span>Image</span>
                        </label>
                        <label class="te-login-panel-type-option {{LOGIN_PANEL_TYPE_GRADIENT_ACTIVE}}">
                            <input type="radio" name="login_panel_bg_type" data-path="components.login_panel_bg_type" value="gradient" {{LOGIN_PANEL_TYPE_GRADIENT_CHECKED}}>
                            <i class="fa fa-paint-brush"></i>
                            <span>Gradient</span>
                        </label>
                    </div>
                    <div class="te-login-panel-fields">
                        <div class="te-login-panel-image-fields {{LOGIN_PANEL_IMAGE_FIELDS_VISIBLE}}">
                            <div class="te-login-bg-upload">
                                <div class="te-login-bg-upload-zone {{LOGIN_PANEL_HAS_IMAGE}}">
                                    <input type="file" accept="image/*" data-upload-path="components.login_panel_bg_image">
                                    <div class="te-login-bg-upload-content">
                                        <i class="fa fa-cloud-upload"></i>
                                        <span>Drop image or click to upload</span>
                                    </div>
                                </div>
                                <div class="te-login-bg-preview {{LOGIN_PANEL_PREVIEW_VISIBLE}}">
                                    <img src="{{LOGIN_PANEL_BG_IMAGE}}">
                                    <label class="te-login-bg-replace">
                                        <input type="file" accept="image/*" data-upload-path="components.login_panel_bg_image">
                                        <i class="fa fa-upload"></i>
                                        <span>Replace Image</span>
                                    </label>
                                </div>
                                <input type="hidden" data-path="components.login_panel_bg_image" value="{{LOGIN_PANEL_BG_IMAGE}}">
                            </div>
                        </div>
                        <div class="te-login-panel-gradient-fields {{LOGIN_PANEL_GRADIENT_FIELDS_VISIBLE}}">
                            <div class="te-gradient-preview" style="background: linear-gradient(135deg, {{LOGIN_PANEL_GRADIENT_START}}, {{LOGIN_PANEL_GRADIENT_END}})"></div>
                            <div class="te-gradient-pickers">
                                <div class="te-gradient-picker-group">
                                    <label class="te-gradient-label">Start</label>
                                    <div class="te-gradient-picker">
                                        <input type="color" class="te-gradient-color" data-path="components.login_panel_gradient_start" value="{{LOGIN_PANEL_GRADIENT_START_HEX}}">
                                        <input type="text" class="te-gradient-input" data-path="components.login_panel_gradient_start" value="{{LOGIN_PANEL_GRADIENT_START}}">
                                    </div>
                                </div>
                                <div class="te-gradient-picker-group">
                                    <label class="te-gradient-label">End</label>
                                    <div class="te-gradient-picker">
                                        <input type="color" class="te-gradient-color" data-path="components.login_panel_gradient_end" value="{{LOGIN_PANEL_GRADIENT_END_HEX}}">
                                        <input type="text" class="te-gradient-input" data-path="components.login_panel_gradient_end" value="{{LOGIN_PANEL_GRADIENT_END}}">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="te-component-section te-component-section-wide">
                <div class="te-component-section-header">
                    <span class="te-component-section-title">RAM Upgrade Alert</span>
                    <span class="te-component-section-desc">Configure the alert that appears when RAM usage is high</span>
                </div>
                <div style="padding: 20px; background: var(--editor-surface-elevated); border-radius: var(--editor-radius);">
                    <div class="te-addon-setting-field">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <label class="te-toggle">
                                <input type="checkbox" data-path="components.ram_upgrade_alert.enabled" data-checked="{{RAM_ALERT_ENABLED}}">
                                <span class="te-toggle-slider"></span>
                            </label>
                            <div>
                                <label class="te-label" style="margin-bottom: 2px;">Enable Alert</label>
                                <p class="te-help-text" style="margin: 0;">Show alert when RAM usage exceeds threshold</p>
                            </div>
                        </div>
                    </div>

                    <div class="te-addon-setting-field">
                        <label class="te-label">Threshold (%)</label>
                        <input type="number" class="te-input" data-path="components.ram_upgrade_alert.threshold" value="{{RAM_ALERT_THRESHOLD}}" min="50" max="100" step="5">
                        <p class="te-help-text">Show alert when RAM usage exceeds this percentage</p>
                    </div>

                    <div class="te-addon-setting-field">
                        <label class="te-label">Alert Title</label>
                        <input type="text" class="te-input" data-path="components.ram_upgrade_alert.title" value="{{RAM_ALERT_TITLE}}" placeholder="RAM Limit Approaching">
                        <p class="te-help-text">Main heading displayed in the alert</p>
                    </div>

                    <div class="te-addon-setting-field">
                        <label class="te-label">Alert Text</label>
                        <textarea class="te-input te-textarea" data-path="components.ram_upgrade_alert.text" rows="3" placeholder="Your server is using a high amount of RAM...">{{RAM_ALERT_TEXT}}</textarea>
                        <p class="te-help-text">Description text displayed in the alert</p>
                    </div>

                    <div class="te-addon-setting-field">
                        <label class="te-label">Upgrade Button Link</label>
                        <input type="text" class="te-input" data-path="components.ram_upgrade_alert.upgrade_button_link" value="{{RAM_ALERT_BUTTON_LINK}}" placeholder="/store">
                        <p class="te-help-text">URL where the upgrade button redirects</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
@endverbatim