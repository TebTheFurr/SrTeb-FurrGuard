var config = {};
var defaults = {};
var eggs = [];
var nests = [];
var locations = [];
var nodes = [];
var tabs = [];
var fonts = [];
var languages = {};
var addons = [];
var routes = {};
var csrfToken = '';
var activeTab = 'general';
var unsavedChanges = false;
var previewWidth = null;
var previewUrlToRestore = null;
var envVariables = {};
var envLoaded = false;
var envWritable = true;
var envIsDemo = false;
var activeAddonSettings = null;
var signupOffers = [];
var signupOffersLoaded = false;
var signupOfferClaims = [];
var signupOfferClaimsLoaded = false;
var signupOfferClaimsExpanded = false;
var offerSaveInFlight = false;
var offerModalSelectedUsers = [];
var issueModalSelectedUsers = [];
var offerEggVariablesCache = {};
var massEggsLoaded = false;
var massEggsLoading = false;
var massEggsError = '';
var massEggCategories = [];
var massEggCatalogue = [];
var massEggSearch = '';
var massEggCategory = '';
var massEggTargetNest = '';
var massEggImportNest = '';
var configMenuOpen = false;
var linksMode = 'server';

function toBool(val, defaultVal) {
    if (typeof val === 'boolean') return val;
    return defaultVal !== undefined ? defaultVal : false;
}

function normaliseSignupOfferData(offer) {
    var data = Object.assign({}, offer || {});
    data.id = data.id !== undefined && data.id !== null ? parseInt(data.id) : data.id;
    data.nest_id = data.nest_id !== '' && data.nest_id !== null && data.nest_id !== undefined ? parseInt(data.nest_id) : '';
    data.egg_id = data.egg_id !== '' && data.egg_id !== null && data.egg_id !== undefined ? parseInt(data.egg_id) : '';
    data.location_ids = Array.isArray(data.location_ids)
        ? data.location_ids.map(function (id) { return parseInt(id); }).filter(function (id) { return !isNaN(id); })
        : [];
    data.target_users = Array.isArray(data.target_users)
        ? data.target_users.map(function (id) { return parseInt(id); }).filter(function (id) { return !isNaN(id); })
        : [];
    data.dedicated_ip = toBool(data.dedicated_ip, false);
    data.oom_disabled = toBool(data.oom_disabled, true);
    data.start_on_completion = toBool(data.start_on_completion, true);
    data.enabled = toBool(data.enabled, true);
    data.availability_type = data.availability_type === 'all_users' ? 'all_users' : 'register';
    data.target_type = data.target_type === 'specific' ? 'specific' : 'all';
    return data;
}
var envModalMode = 'add';
var envEditingKey = null;

function html(parts) {
    return Array.isArray(parts) ? parts.join('') : parts;
}

function buildOptions(items, selectedValue) {
    return items.map(function(item) {
        var value = typeof item === 'object' ? item.value : item;
        var label = typeof item === 'object' ? item.label : item;
        var selected = value === selectedValue ? ' selected' : '';
        return '<option value="' + esc(value) + '"' + selected + '>' + esc(label) + '</option>';
    }).join('');
}

function renderEggSelector(settingId, selectedEggs, options) {
    options = options || {};
    var selected = Array.isArray(selectedEggs)
        ? selectedEggs.map(function (eggId) { return parseInt(eggId, 10); }).filter(function (eggId) { return !isNaN(eggId); })
        : [];
    
    if (!eggs || eggs.length === 0) {
        return '<div class="te-egg-selector-empty">No eggs available</div>';
    }

    var items = [];
    
    if (!options.hideAllOption) {
        var allSelected = selected.length === 0;
        items.push(
            '<label class="te-egg-selector-item' + (allSelected ? ' selected' : '') + '">' +
            '<input type="checkbox" data-component-egg-select-all="' + settingId + '"' + (allSelected ? ' checked' : '') + '>' +
            '<span class="te-egg-selector-name">All</span>' +
            '<span class="te-egg-selector-nest">Every egg</span>' +
            '</label>'
        );
    }

    eggs.forEach(function (egg) {
        var isSelected = selected.indexOf(egg.id) !== -1;
        var dataAttr = options.useDataChecked ? ' data-checked="' + (isSelected ? 'true' : 'false') + '"' : '';
        var checkboxAttr = options.customCheckboxAttr || 'data-component-egg-select';
        
        items.push(
            '<label class="te-egg-selector-item' + (isSelected ? ' selected' : '') + '"' + dataAttr + '>' +
            '<input type="checkbox" ' + checkboxAttr + '="' + settingId + '" data-egg-id="' + egg.id + '"' + (isSelected ? ' checked' : '') + '>' +
            '<span class="te-egg-selector-name">' + esc(egg.name) + '</span>' +
            '<span class="te-egg-selector-nest">' + esc(egg.nest_name) + '</span>' +
            '</label>'
        );
    });

    return items.join('');
}

function getEggSelectorCount(selectedEggs, emptyLabel) {
    emptyLabel = emptyLabel || 'All eggs';
    return selectedEggs.length === 0 ? emptyLabel : selectedEggs.length + ' selected';
}

function renderNodeSelector(settingId, selectedNodes, options) {
    options = options || {};
    var selected = Array.isArray(selectedNodes)
        ? selectedNodes.map(function (nodeId) { return parseInt(nodeId, 10); }).filter(function (nodeId) { return !isNaN(nodeId); })
        : [];

    if (!nodes || nodes.length === 0) {
        return '<div class="te-egg-selector-empty">No nodes available</div>';
    }

    var items = [];

    if (!options.hideAllOption) {
        var allSelected = selected.length === 0;
        var allCheckboxAttr = options.customSelectAllAttr || 'data-component-node-select-all';
        items.push(
            '<label class="te-egg-selector-item' + (allSelected ? ' selected' : '') + '">' +
            '<input type="checkbox" ' + allCheckboxAttr + '="' + settingId + '"' + (allSelected ? ' checked' : '') + '>' +
            '<span class="te-egg-selector-name">All</span>' +
            '<span class="te-egg-selector-nest">Every node</span>' +
            '</label>'
        );
    }

    nodes.forEach(function (node) {
        var isSelected = selected.indexOf(node.id) !== -1;
        var checkboxAttr = options.customCheckboxAttr || 'data-component-node-select';

        items.push(
            '<label class="te-egg-selector-item' + (isSelected ? ' selected' : '') + '">' +
            '<input type="checkbox" ' + checkboxAttr + '="' + settingId + '" data-node-id="' + node.id + '"' + (isSelected ? ' checked' : '') + '>' +
            '<span class="te-egg-selector-name">' + esc(node.name) + '</span>' +
            '<span class="te-egg-selector-nest">' + esc(node.fqdn || '') + '</span>' +
            '</label>'
        );
    });

    return items.join('');
}

function getNodeSelectorCount(selectedNodes, emptyLabel) {
    emptyLabel = emptyLabel || 'All nodes';
    return selectedNodes.length === 0 ? emptyLabel : selectedNodes.length + ' selected';
}

function radioStates(prefix, currentValue, values) {
    var states = {};
    values.forEach(function(val) {
        var key = prefix + '_' + val.toUpperCase().replace(/-/g, '_').replace(/[0-9]/g, function(m) { return m; });
        states[key + '_ACTIVE'] = currentValue === val ? 'active' : '';
        states[key + '_CHECKED'] = currentValue === val ? 'checked' : '';
    });
    return states;
}

function renderTemplate(templateId, replacements) {
    return replaceAll(getTemplate(templateId), replacements);
}

function boolToDataAttr(value) {
    return value ? 'true' : 'false';
}

var colorPresets = [
    {
        id: 'default',
        name: 'Default',
        colors: {
            primary: 'hsl(229, 100%, 64%)',
            secondary: 'hsl(229, 96%, 59%)',
            neutral: 'hsl(240, 5%, 18%)',
            base: 'hsl(0, 0%, 100%)',
            muted: 'hsl(240, 5%, 64%)',
            inverted: 'hsl(0, 0%, 100%)',
            background: 'hsl(240, 3%, 6%)',
            background_secondary: 'hsl(240, 5%, 10%)'
        },
        light_colors: {
            primary: 'hsl(229, 100%, 58%)',
            secondary: 'hsl(229, 96%, 54%)',
            neutral: 'hsl(220, 13%, 82%)',
            base: 'hsl(220, 15%, 12%)',
            muted: 'hsl(220, 9%, 42%)',
            inverted: 'hsl(220, 15%, 12%)',
            background: 'hsl(220, 14%, 96%)',
            background_secondary: 'hsl(220, 13%, 91%)'
        }
    },
    {
        id: 'midnight',
        name: 'Midnight',
        colors: {
            primary: 'hsl(262, 83%, 58%)',
            secondary: 'hsl(240, 10%, 4%)',
            neutral: 'hsl(240, 6%, 18%)',
            base: 'hsl(0, 0%, 98%)',
            muted: 'hsl(240, 5%, 60%)',
            inverted: 'hsl(0, 0%, 100%)',
            background: 'hsl(240, 10%, 4%)',
            background_secondary: 'hsl(240, 8%, 8%)'
        },
        light_colors: {
            primary: 'hsl(262, 83%, 52%)',
            secondary: 'hsl(262, 70%, 54%)',
            neutral: 'hsl(260, 10%, 85%)',
            base: 'hsl(260, 15%, 15%)',
            muted: 'hsl(260, 8%, 45%)',
            inverted: 'hsl(260, 15%, 15%)',
            background: 'hsl(260, 12%, 97%)',
            background_secondary: 'hsl(260, 10%, 92%)'
        }
    },
    {
        id: 'ocean',
        name: 'Ocean',
        colors: {
            primary: 'hsl(199, 89%, 48%)',
            secondary: 'hsl(210, 40%, 6%)',
            neutral: 'hsl(210, 25%, 18%)',
            base: 'hsl(210, 40%, 98%)',
            muted: 'hsl(210, 20%, 62%)',
            inverted: 'hsl(0, 0%, 100%)',
            background: 'hsl(210, 40%, 6%)',
            background_secondary: 'hsl(210, 35%, 10%)'
        },
        light_colors: {
            primary: 'hsl(199, 89%, 42%)',
            secondary: 'hsl(199, 80%, 45%)',
            neutral: 'hsl(210, 20%, 85%)',
            base: 'hsl(210, 30%, 15%)',
            muted: 'hsl(210, 15%, 45%)',
            inverted: 'hsl(210, 30%, 15%)',
            background: 'hsl(210, 30%, 97%)',
            background_secondary: 'hsl(210, 25%, 93%)'
        }
    },
    {
        id: 'forest',
        name: 'Forest',
        colors: {
            primary: 'hsl(152, 69%, 40%)',
            secondary: 'hsl(160, 20%, 5%)',
            neutral: 'hsl(160, 12%, 18%)',
            base: 'hsl(150, 20%, 96%)',
            muted: 'hsl(160, 12%, 58%)',
            inverted: 'hsl(0, 0%, 100%)',
            background: 'hsl(160, 20%, 5%)',
            background_secondary: 'hsl(160, 15%, 9%)'
        },
        light_colors: {
            primary: 'hsl(152, 69%, 35%)',
            secondary: 'hsl(152, 60%, 38%)',
            neutral: 'hsl(150, 12%, 85%)',
            base: 'hsl(150, 20%, 15%)',
            muted: 'hsl(150, 10%, 45%)',
            inverted: 'hsl(150, 20%, 15%)',
            background: 'hsl(150, 18%, 97%)',
            background_secondary: 'hsl(150, 15%, 93%)'
        }
    },
    {
        id: 'rose',
        name: 'Rose',
        colors: {
            primary: 'hsl(346, 77%, 55%)',
            secondary: 'hsl(350, 15%, 6%)',
            neutral: 'hsl(350, 10%, 18%)',
            base: 'hsl(350, 30%, 98%)',
            muted: 'hsl(350, 12%, 60%)',
            inverted: 'hsl(0, 0%, 100%)',
            background: 'hsl(350, 15%, 6%)',
            background_secondary: 'hsl(350, 12%, 10%)'
        },
        light_colors: {
            primary: 'hsl(346, 77%, 48%)',
            secondary: 'hsl(346, 65%, 52%)',
            neutral: 'hsl(350, 15%, 85%)',
            base: 'hsl(350, 20%, 15%)',
            muted: 'hsl(350, 10%, 45%)',
            inverted: 'hsl(350, 20%, 15%)',
            background: 'hsl(350, 20%, 97%)',
            background_secondary: 'hsl(350, 18%, 93%)'
        }
    },
    {
        id: 'amber',
        name: 'Amber',
        colors: {
            primary: 'hsl(38, 92%, 50%)',
            secondary: 'hsl(30, 20%, 5%)',
            neutral: 'hsl(30, 12%, 18%)',
            base: 'hsl(40, 30%, 97%)',
            muted: 'hsl(30, 14%, 58%)',
            inverted: 'hsl(0, 0%, 100%)',
            background: 'hsl(30, 20%, 5%)',
            background_secondary: 'hsl(30, 15%, 9%)'
        },
        light_colors: {
            primary: 'hsl(38, 92%, 45%)',
            secondary: 'hsl(38, 80%, 48%)',
            neutral: 'hsl(35, 15%, 85%)',
            base: 'hsl(30, 25%, 15%)',
            muted: 'hsl(30, 12%, 45%)',
            inverted: 'hsl(30, 25%, 15%)',
            background: 'hsl(40, 25%, 97%)',
            background_secondary: 'hsl(38, 22%, 93%)'
        }
    },
    {
        id: 'slate',
        name: 'Slate',
        colors: {
            primary: 'hsl(215, 25%, 50%)',
            secondary: 'hsl(220, 15%, 6%)',
            neutral: 'hsl(220, 12%, 18%)',
            base: 'hsl(220, 15%, 95%)',
            muted: 'hsl(220, 12%, 58%)',
            inverted: 'hsl(0, 0%, 100%)',
            background: 'hsl(220, 15%, 6%)',
            background_secondary: 'hsl(220, 13%, 10%)'
        },
        light_colors: {
            primary: 'hsl(215, 25%, 45%)',
            secondary: 'hsl(215, 22%, 48%)',
            neutral: 'hsl(220, 12%, 85%)',
            base: 'hsl(220, 15%, 15%)',
            muted: 'hsl(220, 10%, 45%)',
            inverted: 'hsl(220, 15%, 15%)',
            background: 'hsl(220, 14%, 97%)',
            background_secondary: 'hsl(220, 12%, 93%)'
        }
    },
    {
        id: 'crimson',
        name: 'Crimson',
        colors: {
            primary: 'hsl(0, 72%, 51%)',
            secondary: 'hsl(0, 15%, 5%)',
            neutral: 'hsl(0, 8%, 18%)',
            base: 'hsl(0, 20%, 98%)',
            muted: 'hsl(0, 8%, 60%)',
            inverted: 'hsl(0, 0%, 100%)',
            background: 'hsl(0, 15%, 5%)',
            background_secondary: 'hsl(0, 12%, 9%)'
        },
        light_colors: {
            primary: 'hsl(0, 72%, 45%)',
            secondary: 'hsl(0, 60%, 48%)',
            neutral: 'hsl(0, 10%, 85%)',
            base: 'hsl(0, 15%, 15%)',
            muted: 'hsl(0, 8%, 45%)',
            inverted: 'hsl(0, 15%, 15%)',
            background: 'hsl(0, 15%, 97%)',
            background_secondary: 'hsl(0, 12%, 93%)'
        }
    },
    {
        id: 'nord',
        name: 'Nord',
        colors: {
            primary: 'hsl(213, 32%, 52%)',
            secondary: 'hsl(220, 16%, 16%)',
            neutral: 'hsl(220, 17%, 26%)',
            base: 'hsl(219, 28%, 92%)',
            muted: 'hsl(219, 18%, 62%)',
            inverted: 'hsl(0, 0%, 100%)',
            background: 'hsl(220, 16%, 16%)',
            background_secondary: 'hsl(222, 16%, 20%)'
        },
        light_colors: {
            primary: 'hsl(213, 32%, 46%)',
            secondary: 'hsl(213, 28%, 50%)',
            neutral: 'hsl(219, 20%, 85%)',
            base: 'hsl(220, 16%, 18%)',
            muted: 'hsl(219, 14%, 45%)',
            inverted: 'hsl(220, 16%, 18%)',
            background: 'hsl(219, 28%, 97%)',
            background_secondary: 'hsl(219, 25%, 93%)'
        }
    },
    {
        id: 'dracula',
        name: 'Dracula',
        colors: {
            primary: 'hsl(265, 89%, 78%)',
            secondary: 'hsl(231, 15%, 18%)',
            neutral: 'hsl(232, 14%, 28%)',
            base: 'hsl(60, 30%, 96%)',
            muted: 'hsl(225, 20%, 62%)',
            inverted: 'hsl(0, 0%, 100%)',
            background: 'hsl(231, 15%, 18%)',
            background_secondary: 'hsl(232, 14%, 22%)'
        },
        light_colors: {
            primary: 'hsl(265, 89%, 60%)',
            secondary: 'hsl(265, 75%, 62%)',
            neutral: 'hsl(230, 15%, 85%)',
            base: 'hsl(231, 15%, 18%)',
            muted: 'hsl(225, 15%, 45%)',
            inverted: 'hsl(231, 15%, 18%)',
            background: 'hsl(60, 20%, 97%)',
            background_secondary: 'hsl(60, 18%, 93%)'
        }
    },
    {
        id: 'monokai',
        name: 'Monokai',
        colors: {
            primary: 'hsl(54, 70%, 55%)',
            secondary: 'hsl(70, 8%, 8%)',
            neutral: 'hsl(70, 6%, 20%)',
            base: 'hsl(60, 30%, 96%)',
            muted: 'hsl(60, 12%, 58%)',
            inverted: 'hsl(0, 0%, 100%)',
            background: 'hsl(70, 8%, 8%)',
            background_secondary: 'hsl(70, 7%, 12%)'
        },
        light_colors: {
            primary: 'hsl(54, 70%, 42%)',
            secondary: 'hsl(54, 60%, 45%)',
            neutral: 'hsl(60, 10%, 85%)',
            base: 'hsl(70, 8%, 15%)',
            muted: 'hsl(60, 8%, 45%)',
            inverted: 'hsl(70, 8%, 15%)',
            background: 'hsl(60, 25%, 97%)',
            background_secondary: 'hsl(60, 20%, 93%)'
        }
    }
];

function init(data) {
    config = data.config || {};
    defaults = data.defaults || {};
    eggs = data.eggs || [];
    nests = data.nests || [];
    locations = data.locations || [];
    nodes = data.nodes || [];
    tabs = data.tabs || [];
    fonts = data.fonts || [];
    languages = data.languages || {};
    addons = data.addons || [];
    routes = data.routes || {};
    routes.freeServers = routes.freeServers || '';
    routes.freeServersIssue = routes.freeServersIssue || '';
    routes.freeServersClaims = routes.freeServersClaims || '';
    routes.freeServersEggVariables = routes.freeServersEggVariables || '';
    routes.freeServersSearchUsers = routes.freeServersSearchUsers || '';
    routes.themeExport = routes.themeExport || '';
    routes.themeImport = routes.themeImport || '';
    routes.announcements = routes.announcements || '/admin/settings/announcements';
    csrfToken = data.csrfToken || '';

    document.body.classList.add('theme-editor-page');

    if (tabs.length > 0 && !tabs.find(function (t) { return t.id === activeTab; })) {
        activeTab = tabs[0].id;
    }

    var urlParams = new URLSearchParams(window.location.search);
    var urlTab = urlParams.get('tab');
    if (urlTab && tabs.find(t => t.id === urlTab)) {
        activeTab = urlTab;
    }

    var urlAddon = urlParams.get('addon');
    if (urlAddon && tabs.find(t => t.id === 'addons') && addons.find(a => a.id === urlAddon)) {
        activeTab = 'addons';
        activeAddonSettings = urlAddon;
        if (activeAddonSettings === 'free_servers' && !signupOffersLoaded) {
            loadSignupOffers(function () {
                render();
            });
        }
    }

    render();
    setupEvents();
    setupModal();
    setupIconPickers();
    setupPermissionPickers();

    window.onbeforeunload = function () {
        if (unsavedChanges) return true;
    };
}

function getTemplate(id) {
    var template = document.getElementById(id);
    return template ? template.innerHTML : '';
}

function replaceAll(str, replacements) {
    for (var key in replacements) {
        if (replacements.hasOwnProperty(key)) {
            var regex = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
            // Use a replacer function so "$" sequences inside user-authored
            // values (footer HTML/CSS, etc.) are inserted literally instead of
            // being interpreted as $&/$1/$$ replacement patterns.
            str = str.replace(regex, (function (value) {
                return function () { return value; };
            })(replacements[key]));
        }
    }
    return str;
}

function render() {
    var editor = document.getElementById('themeEditor');
    var sidebar = document.getElementById('te-sidebar-template').innerHTML;

    if (isFullPageTab()) {
        editor.innerHTML = sidebar + renderFullPagePanel();
    } else {
        editor.innerHTML = sidebar + renderOptionsPanel() + renderPreview();
    }

    var sidebarTop = editor.querySelector('.te-sidebar-top');
    if (sidebarTop) {
        var advancedBtn = sidebarTop.querySelector('.te-tab-btn[data-tab="advanced"]');
        if (advancedBtn) {
            advancedBtn.remove();
            sidebarTop.appendChild(advancedBtn);
        }
    }

    processDataChecked(editor);

    if (activeTab === 'advanced') {
        updateBillingPlatformFields(getConfigValue('advanced.billing_integration.platform', 'whmcs'));
    }

    document.querySelectorAll('.te-tab-btn[data-tab]').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.tab === activeTab);
    });

    setupUrlTracking();
    setupEvents();

    if (activeAddonSettings === 'free_servers') {
        setupClaimsSearch();
    }

    if (activeTab === 'announcements') {
        initAnnouncementsTab();
    }

    if (activeTab === 'oauth') {
        initOAuthTab();
    }

    if (activeTab === 'templates') {
        initServerTemplatesTab();
    }
    
    if (activeTab === 'layout' || activeTab === 'links') {
        setTimeout(initDragAndDrop, 0);
    }
}

function renderFullPagePanel() {
    if (activeAddonSettings !== null) {
        return renderAddonSettingsPanel();
    }

    if (activeTab === 'import-eggs') {
        return renderMassEggImporterTab();
    }

    if (activeTab === 'links') {
        return renderLinksFullPagePanel();
    }

    var tab = tabs.find(t => t.id === activeTab) || {};
    var template = getTemplate('te-fullpage-panel');

    return replaceAll(template, {
        'TAB_LABEL': esc(tab.label || 'Settings'),
        'TAB_DESCRIPTION': esc(tab.description || ''),
        'CONFIG_ACTIONS_MENU': renderConfigActionsMenu(),
        'TAB_CONTENT': renderTabContent()
    });
}

function renderLinksFullPagePanel() {
    var html = '<div class="te-fullpage-panel" style="display:flex;flex-direction:column;">';
    html += '<div class="te-fullpage-header">';
    html += '<div>';
    html += '<div class="te-panel-title">Links</div>';
    html += '<div class="te-panel-subtitle">Navigation links editor</div>';
    html += '</div>';
    html += '<div class="te-fullpage-actions">';
    html += '<button class="te-btn te-btn-danger te-btn-icon-only" data-action="reset" title="Reset"><i class="fa fa-undo"></i></button>';
    html += renderConfigActionsMenu();
    html += '<button class="te-btn te-btn-primary" data-action="save"><i class="fa fa-save"></i> Save Changes</button>';
    html += '</div>';
    html += '</div>';
    html += '<div id="panelContent" style="flex:1;overflow:hidden;">' + renderTabContent() + '</div>';
    html += '</div>';
    return html;
}

function renderOptionsPanel() {
    var tab = tabs.find(t => t.id === activeTab) || {};
    var template = getTemplate('te-options-panel');

    return replaceAll(template, {
        'TAB_LABEL': esc(tab.label || 'Settings'),
        'TAB_DESCRIPTION': esc(tab.description || ''),
        'CONFIG_ACTIONS_MENU': renderConfigActionsMenu(),
        'TAB_CONTENT': renderTabContent()
    });
}

function renderConfigActionsMenu() {
    var openClass = configMenuOpen ? ' open' : '';
    return '<div class="te-config-menu' + openClass + '">' +
        '<button class="te-btn te-btn-secondary te-config-menu-trigger" type="button" data-action="toggle-config-menu">' +
        '<span class="te-config-menu-trigger-icons"><i class="fa fa-download"></i><i class="fa fa-upload"></i></span>' +
        '</button>' +
        '<div class="te-config-menu-popover">' +
        '<button class="te-config-menu-item" type="button" data-action="export-config">' +
        '<i class="fa fa-download"></i> Export config' +
        '</button>' +
        '<button class="te-config-menu-item" type="button" data-action="open-import-config">' +
        '<i class="fa fa-upload"></i> Import config' +
        '</button>' +
        '<input type="file" class="te-config-import-input" data-config-import-input accept=".json,application/json" hidden aria-hidden="true" tabindex="-1">' +
        '</div>' +
        '</div>';
}

function getActiveAccessPayload() {
    var payload = { active_tab: activeTab };
    if (activeAddonSettings) {
        payload.active_addon = activeAddonSettings;
    }
    return payload;
}

function appendActiveAccessPayloadToForm(form) {
    var payload = getActiveAccessPayload();
    for (var key in payload) {
        if (payload.hasOwnProperty(key) && payload[key]) {
            form.append(key, payload[key]);
        }
    }
}

function appendActiveAccessPayloadToUrl(url) {
    var payload = getActiveAccessPayload();
    for (var key in payload) {
        if (payload.hasOwnProperty(key) && payload[key]) {
            url.searchParams.set(key, payload[key]);
        }
    }
    return url;
}

function setConfigMenuState(open) {
    configMenuOpen = open;
    var editor = document.getElementById('themeEditor');
    if (!editor) return;
    editor.querySelectorAll('.te-config-menu').forEach(function (menu) {
        menu.classList.remove('open-up');
        menu.classList.remove('open-left');
        menu.classList.toggle('open', open);
        if (!open) {
            return;
        }

        var popover = menu.querySelector('.te-config-menu-popover');
        if (!popover) {
            return;
        }

        var viewportPadding = 8;
        var rect = popover.getBoundingClientRect();
        if (rect.bottom > (window.innerHeight - viewportPadding)) {
            menu.classList.add('open-up');
            rect = popover.getBoundingClientRect();
        }

        if (rect.top < viewportPadding) {
            menu.classList.remove('open-up');
            rect = popover.getBoundingClientRect();
        }

        if (rect.right > (window.innerWidth - viewportPadding)) {
            menu.classList.add('open-left');
            rect = popover.getBoundingClientRect();
        }

        if (rect.left < viewportPadding) {
            menu.classList.remove('open-left');
        }
    });
}

function renderTabContent() {
    if (activeTab === 'general') return renderGeneralTab();
    if (activeTab === 'theme') return renderThemeTab();
    if (activeTab === 'layout') return renderLayoutTab();
    if (activeTab === 'links') return renderLinksTab();
    if (activeTab === 'components') return renderComponentsTab();
    if (activeTab === 'announcements') return renderAnnouncementsTab();
    if (activeTab === 'oauth') return renderOAuthTab();
    if (activeTab === 'templates') return renderTemplatesTab();
    if (activeTab === 'seo') return renderSeoTab();
    if (activeTab === 'eggs') return renderEggsTab();
    if (activeTab === 'advanced') return renderAdvancedTab();
    if (activeTab === 'addons') return renderAddonsTab();
    if (activeTab === 'import-eggs') return renderMassEggImporterTab();
    if (activeTab === 'environment') return renderEnvironmentTab();
    return renderEmptyTab();
}

function isFullPageTab() {
    return activeTab === 'components' || activeTab === 'links' || activeTab === 'import-eggs' || activeTab === 'templates' || activeTab === 'announcements' || activeTab === 'oauth' || activeAddonSettings !== null;
}

function renderGeneralTab() {
    var general = config.general || {};

    var html = renderTemplate('te-tab-general', {
        'SITE_NAME': esc(general.site_name || ''),
        'LOGO_URL_DARK': esc(general.logo_url_dark || general.logo_url || ''),
        'LOGO_URL_LIGHT': esc(general.logo_url_light || general.logo_url || ''),
        'COPYRIGHT_TEXT': esc(general.copyright_text || (defaults.general && defaults.general.copyright_text) || ''),
        'FOOTER_CUSTOM_CSS': esc(general.footer_custom_css || (defaults.general && defaults.general.footer_custom_css) || ''),
        'DISCORD_INVITE_LINK': esc(general.discord_invite_link || ''),
        'SHOW_DISCORD_CHECKED': boolToDataAttr(toBool(general.show_discord_navbar, false)),
        'PRIVACY_BLUR_SERVER_IP_CHECKED': boolToDataAttr(toBool(general.privacy_blur_server_ip, false))
    });

    return processComponents(html);
}

var announcementsData = [];
var announcementsLoaded = false;

function renderAnnouncementsTab() {
    return getTemplate('te-tab-announcements');
}

function initAnnouncementsTab() {
    if (announcementsLoaded) {
        renderAnnouncementsList();
        return;
    }

    loadAnnouncements();
}

function loadAnnouncements() {
    if (!routes.announcements) {
        var listContainer = document.getElementById('te-announcements-list');
        if (listContainer) {
            listContainer.innerHTML = '<div class="te-announcements-error">Announcement routes not configured</div>';
        }
        return;
    }

    fetch(routes.announcements, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'X-CSRF-TOKEN': csrfToken
        }
    })
    .then(function (res) {
        if (!res.ok) throw new Error('Failed to load announcements');
        return res.json();
    })
    .then(function (data) {
        announcementsData = data || [];
        announcementsLoaded = true;
        renderAnnouncementsList();
    })
    .catch(function (err) {
        announcementsLoaded = true;
        var listContainer = document.getElementById('te-announcements-list');
        if (listContainer) {
            listContainer.innerHTML = '<div class="te-announcements-error">Failed to load announcements</div>';
        }
    });
}

function renderAnnouncementsList() {
    var listContainer = document.getElementById('te-announcements-list');
    if (!listContainer) return;

    if (announcementsData.length === 0) {
        listContainer.innerHTML =
            '<div class="te-announcements-empty">' +
            '<i class="fa fa-bullhorn"></i>' +
            '<p class="te-announcements-empty-title">No announcements yet</p>' +
            '<p class="te-announcements-empty-text">Click "Create Announcement" to get started.</p>' +
            '</div>';
        return;
    }

    var html = announcementsData.map(function (announcement) {
        var badges = [];
        badges.push('<span class="te-announcement-badge">' + esc((announcement.type || 'info').toUpperCase()) + '</span>');

        if (!announcement.enabled) {
            badges.push('<span class="te-announcement-badge badge-disabled">Disabled</span>');
        }

        if (announcement.is_permanent || !announcement.expires_at) {
            badges.push('<span class="te-announcement-badge badge-permanent">Permanent</span>');
        } else {
            var expiryDate = new Date(announcement.expires_at);
            var expiryLabel = isNaN(expiryDate.getTime())
                ? 'Expires'
                : 'Expires ' + expiryDate.toLocaleDateString();
            badges.push('<span class="te-announcement-badge badge-expires">' + esc(expiryLabel) + '</span>');
        }

        var placementLabel = announcement.placement === 'topbar' ? 'Top Bar' : 'Above Content';
        var variationLabel = announcement.variation === 'solid'
            ? 'Solid Bar'
            : (announcement.variation === 'outline' ? 'Outline' : 'Border');

        var nodeCount = Array.isArray(announcement.node_ids) ? announcement.node_ids.length : (announcement.node_id ? 1 : 0);
        var eggCount = Array.isArray(announcement.egg_ids) ? announcement.egg_ids.length : 0;
        var targetingLabel = (nodeCount === 0 ? 'All nodes' : nodeCount + ' node' + (nodeCount === 1 ? '' : 's')) +
            ' · ' +
            (eggCount === 0 ? 'All eggs' : eggCount + ' egg' + (eggCount === 1 ? '' : 's'));

        return '<div class="te-announcement-card" data-announcement-id="' + announcement.id + '">' +
            '<div class="te-announcement-card-content">' +
            '<div class="te-announcement-card-header">' +
            '<h3 class="te-announcement-card-title">' + esc(announcement.title || 'Untitled') + '</h3>' +
            '<div class="te-announcement-card-badges">' + badges.join('') + '</div>' +
            '</div>' +
            '<p class="te-announcement-card-text">' + esc(announcement.text || 'No description') + '</p>' +
            '<div class="te-announcement-card-meta">' +
            '<span class="te-announcement-card-meta-item"><i class="fa fa-' + esc(announcement.icon || 'bullhorn') + '"></i>' + esc(variationLabel) + '</span>' +
            '<span class="te-announcement-card-meta-item"><i class="fa fa-map-marker"></i>' + esc(placementLabel) + '</span>' +
            '<span class="te-announcement-card-meta-item"><i class="fa fa-crosshairs"></i>' + esc(targetingLabel) + '</span>' +
            '</div>' +
            '</div>' +
            '<div class="te-announcement-card-actions">' +
            '<div class="te-announcement-card-toggle">' +
            '<label class="te-toggle">' +
            '<input type="checkbox" data-action="toggle-announcement" data-announcement-id="' + announcement.id + '"' + (announcement.enabled ? ' checked' : '') + '>' +
            '<span class="te-toggle-slider"></span>' +
            '</label>' +
            '<span class="te-announcement-card-toggle-label">' + (announcement.enabled ? 'Active' : 'Inactive') + '</span>' +
            '</div>' +
            '<button type="button" class="te-btn te-btn-sm te-btn-secondary" data-action="edit-announcement" data-announcement-id="' + announcement.id + '">Edit</button>' +
            '<button type="button" class="te-btn te-btn-sm te-btn-danger" data-action="delete-announcement" data-announcement-id="' + announcement.id + '">Delete</button>' +
            '</div>' +
            '</div>';
    }).join('');

    listContainer.innerHTML = html;
}

function toggleAnnouncementEnabled(announcementId, enabled) {
    fetch(routes.announcements + '/' + announcementId, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': csrfToken
        },
        body: JSON.stringify({ enabled: enabled })
    })
    .then(function (res) {
        if (!res.ok) throw new Error('Failed to update announcement');
        return res.json();
    })
    .then(function (data) {
        var index = announcementsData.findIndex(function (a) { return a.id === announcementId; });
        if (index !== -1) {
            announcementsData[index] = data;
        }
        renderAnnouncementsList();
        toast(enabled ? 'Announcement enabled' : 'Announcement disabled', 'success');
    })
    .catch(function () {
        renderAnnouncementsList();
        toast('Failed to update announcement', 'error');
    });
}

function openAnnouncementModal(announcementData) {
    var modalTemplate = getTemplate('te-announcement-modal');
    var modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalTemplate;
    document.body.appendChild(modalContainer.firstElementChild);

    var modal = document.getElementById('announcementModal');
    var form = document.getElementById('te-announcement-form');
    var titleEl = document.getElementById('te-announcement-modal-title');
    var saveBtn = document.getElementById('te-save-announcement-btn');
    var saveText = document.getElementById('te-save-announcement-text');

    if (announcementData) {
        titleEl.textContent = 'Edit Announcement';
        saveText.textContent = 'Save Changes';
        form.querySelector('#te-announcement-id').value = announcementData.id || '';
        form.querySelector('[name="variation"][value="' + (announcementData.variation || 'split') + '"]').checked = true;
        form.querySelector('[name="placement"][value="' + (announcementData.placement || 'above-content') + '"]').checked = true;
        form.querySelector('[name="type"][value="' + (announcementData.type || 'info') + '"]').checked = true;
        form.querySelector('[name="icon"]').value = announcementData.icon || 'bullhorn';
        form.querySelector('[name="title"]').value = announcementData.title || '';
        form.querySelector('[name="text"]').value = announcementData.text || '';
        form.querySelector('[name="button_label"]').value = announcementData.button_label || '';
        form.querySelector('[name="button_link"]').value = announcementData.button_link || '';
        
        var isPermanent = !announcementData.expires_at;
        form.querySelector('#te-is-permanent').checked = isPermanent;
        if (!isPermanent && announcementData.expires_at) {
            var expiryInput = form.querySelector('#te-expires-at');
            var date = new Date(announcementData.expires_at);
            expiryInput.value = date.toISOString().slice(0, 16);
        }
        
        var selectedNodes = [];
        if (announcementData.node_ids && Array.isArray(announcementData.node_ids)) {
            selectedNodes = announcementData.node_ids;
        } else if (announcementData.node_id) {
            selectedNodes = [announcementData.node_id];
        }
        renderAnnouncementNodeSelector(selectedNodes);

        if (announcementData.egg_ids && Array.isArray(announcementData.egg_ids)) {
            renderAnnouncementEggSelector(announcementData.egg_ids);
        } else {
            renderAnnouncementEggSelector([]);
        }
    } else {
        renderAnnouncementNodeSelector([]);
        renderAnnouncementEggSelector([]);
    }

    var permanentToggle = form.querySelector('#te-is-permanent');
    var expiryDatetime = form.querySelector('#te-expiry-datetime');
    permanentToggle.addEventListener('change', function () {
        expiryDatetime.style.display = this.checked ? 'none' : 'block';
    });
    if (!permanentToggle.checked) {
        expiryDatetime.style.display = 'block';
    }

    var iconPicker = modal.querySelector('.te-icon-picker');
    if (iconPicker) {
        iconPicker.dataset.value = form.querySelector('[name="icon"]').value || 'bullhorn';
        setupIconPicker(iconPicker, function (icon) {
            form.querySelector('[name="icon"]').value = icon;
        });
    }

    saveBtn.onclick = function () {
        saveAnnouncement(announcementData ? announcementData.id : null);
    };

    var closeBtn = modal.querySelector('[data-action="close-announcement-modal"]');
    if (closeBtn) {
        closeBtn.onclick = function () {
            closeAnnouncementModal();
        };
    }

    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            closeAnnouncementModal();
        }
    });
}

function renderAnnouncementNodeSelector(selectedNodes) {
    var listEl = document.querySelector('[data-announcement-node-list]');
    var countEl = document.querySelector('[data-announcement-node-count]');

    if (!listEl || !countEl) return;

    listEl.innerHTML = renderNodeSelector('announcement-nodes', selectedNodes, {
        hideAllOption: false,
        customCheckboxAttr: 'data-announcement-node-select',
        customSelectAllAttr: 'data-announcement-node-select-all'
    });
    countEl.textContent = getNodeSelectorCount(selectedNodes, 'All nodes');

    var searchInput = document.querySelector('[data-announcement-node-selector] .te-egg-selector-search');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            var query = this.value.toLowerCase();
            var items = listEl.querySelectorAll('.te-egg-selector-item');
            items.forEach(function (item) {
                var name = item.querySelector('.te-egg-selector-name').textContent.toLowerCase();
                var fqdn = item.querySelector('.te-egg-selector-nest').textContent.toLowerCase();
                item.style.display = name.indexOf(query) !== -1 || fqdn.indexOf(query) !== -1 ? '' : 'none';
            });
        });
    }

    listEl.addEventListener('change', function (e) {
        var checkbox = e.target;
        if (!checkbox.matches('[data-announcement-node-select]') && !checkbox.matches('[data-announcement-node-select-all]')) return;

        var allCheckbox = listEl.querySelector('[data-announcement-node-select-all]');
        var nodeCheckboxes = listEl.querySelectorAll('[data-announcement-node-select]');

        if (checkbox.matches('[data-announcement-node-select-all]')) {
            nodeCheckboxes.forEach(function (cb) {
                cb.checked = checkbox.checked;
                cb.closest('.te-egg-selector-item').classList.toggle('selected', checkbox.checked);
            });
        } else {
            var anySelected = Array.from(nodeCheckboxes).some(function (cb) { return cb.checked; });
            if (allCheckbox) {
                allCheckbox.checked = !anySelected;
                allCheckbox.closest('.te-egg-selector-item').classList.toggle('selected', !anySelected);
            }
            checkbox.closest('.te-egg-selector-item').classList.toggle('selected', checkbox.checked);
        }

        var selected = Array.from(nodeCheckboxes).filter(function (cb) { return cb.checked; }).map(function (cb) { return parseInt(cb.dataset.nodeId); });
        countEl.textContent = getNodeSelectorCount(allCheckbox && allCheckbox.checked ? [] : selected, 'All nodes');
    });
}

function renderAnnouncementEggSelector(selectedEggs) {
    var listEl = document.querySelector('[data-announcement-egg-list]');
    var countEl = document.querySelector('[data-announcement-egg-count]');
    
    if (!listEl || !countEl) return;

    listEl.innerHTML = renderEggSelector('announcement-eggs', selectedEggs, { hideAllOption: false, customCheckboxAttr: 'data-announcement-egg-select' });
    countEl.textContent = getEggSelectorCount(selectedEggs, 'All eggs');

    var searchInput = document.querySelector('[data-announcement-egg-selector] .te-egg-selector-search');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            var query = this.value.toLowerCase();
            var items = listEl.querySelectorAll('.te-egg-selector-item');
            items.forEach(function (item) {
                var name = item.querySelector('.te-egg-selector-name').textContent.toLowerCase();
                var nest = item.querySelector('.te-egg-selector-nest').textContent.toLowerCase();
                item.style.display = name.indexOf(query) !== -1 || nest.indexOf(query) !== -1 ? '' : 'none';
            });
        });
    }

    listEl.addEventListener('change', function (e) {
        var checkbox = e.target;
        if (!checkbox.matches('[data-announcement-egg-select]') && !checkbox.matches('[data-announcement-egg-select-all]')) return;

        var allCheckbox = listEl.querySelector('[data-announcement-egg-select-all]');
        var eggCheckboxes = listEl.querySelectorAll('[data-announcement-egg-select]');

        if (checkbox.matches('[data-announcement-egg-select-all]')) {
            eggCheckboxes.forEach(function (cb) {
                cb.checked = checkbox.checked;
                cb.closest('.te-egg-selector-item').classList.toggle('selected', checkbox.checked);
            });
        } else {
            var anySelected = Array.from(eggCheckboxes).some(function (cb) { return cb.checked; });
            if (allCheckbox) {
                allCheckbox.checked = !anySelected;
                allCheckbox.closest('.te-egg-selector-item').classList.toggle('selected', !anySelected);
            }
            checkbox.closest('.te-egg-selector-item').classList.toggle('selected', checkbox.checked);
        }

        var selected = Array.from(eggCheckboxes).filter(function (cb) { return cb.checked; }).map(function (cb) { return parseInt(cb.dataset.eggId); });
        countEl.textContent = getEggSelectorCount(allCheckbox && allCheckbox.checked ? [] : selected, 'All eggs');
    });
}

function saveAnnouncement(announcementId) {
    var form = document.getElementById('te-announcement-form');
    var formData = new FormData(form);
    
    var nodeCheckboxes = document.querySelectorAll('[data-announcement-node-select]:checked');
    var allNodeCheckbox = document.querySelector('[data-announcement-node-select-all]:checked');
    var selectedNodes = [];

    if (!allNodeCheckbox && nodeCheckboxes.length > 0) {
        nodeCheckboxes.forEach(function (cb) {
            selectedNodes.push(parseInt(cb.dataset.nodeId));
        });
    }

    var eggCheckboxes = document.querySelectorAll('[data-announcement-egg-select]:checked');
    var allCheckbox = document.querySelector('[data-announcement-egg-select-all]:checked');
    var selectedEggs = [];
    
    if (!allCheckbox && eggCheckboxes.length > 0) {
        eggCheckboxes.forEach(function (cb) {
            selectedEggs.push(parseInt(cb.dataset.eggId));
        });
    }

    var payload = {
        enabled: true,
        variation: formData.get('variation'),
        placement: formData.get('placement'),
        type: formData.get('type'),
        icon: formData.get('icon'),
        title: formData.get('title'),
        text: formData.get('text'),
        button_label: formData.get('button_label'),
        button_link: formData.get('button_link'),
        node_ids: selectedNodes.length > 0 ? selectedNodes : null,
        egg_ids: selectedEggs.length > 0 ? selectedEggs : null,
        is_permanent: formData.get('is_permanent') === 'on',
        expires_at: formData.get('is_permanent') === 'on' ? null : formData.get('expires_at')
    };

    var url = routes.announcements;
    var method = 'POST';
    
    if (announcementId) {
        url = routes.announcements + '/' + announcementId;
        method = 'PATCH';
    }

    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': csrfToken
        },
        body: JSON.stringify(payload)
    })
    .then(function (res) {
        if (!res.ok) throw new Error('Failed to save announcement');
        return res.json();
    })
    .then(function (data) {
        toast(announcementId ? 'Announcement updated' : 'Announcement created', 'success');
        closeAnnouncementModal();
        loadAnnouncements();
    })
    .catch(function (err) {
        toast('Failed to save announcement', 'error');
    });
}

function deleteAnnouncement(announcementId) {
    if (!confirm('Are you sure you want to delete this announcement?')) {
        return;
    }

    fetch(routes.announcements + '/' + announcementId, {
        method: 'DELETE',
        headers: {
            'Accept': 'application/json',
            'X-CSRF-TOKEN': csrfToken
        }
    })
    .then(function (res) {
        if (!res.ok) throw new Error('Failed to delete announcement');
        return res.json();
    })
    .then(function () {
        toast('Announcement deleted', 'success');
        loadAnnouncements();
    })
    .catch(function (err) {
        toast('Failed to delete announcement', 'error');
    });
}

function closeAnnouncementModal() {
    var modal = document.getElementById('announcementModal');
    if (modal) {
        modal.remove();
    }
}

var oauthProvidersData = [];
var oauthPresets = {};
var oauthProvidersLoaded = false;

function renderOAuthTab() {
    return renderTemplate('te-tab-oauth', {
        'OAUTH_PROVIDER_LIST': '<div class="te-oauth-loading"><i class="fa fa-spinner fa-spin"></i><span>Loading OAuth providers...</span></div>'
    });
}

function initOAuthTab() {
    if (oauthProvidersLoaded) {
        renderOAuthProvidersList();
        return;
    }

    loadOAuthProviders();
}

function loadOAuthProviders() {
    if (!routes.oauthProviders) {
        var listContainer = document.getElementById('oauthProviderList');
        if (listContainer) {
            listContainer.innerHTML = '<div class="te-announcements-error">OAuth provider routes not configured</div>';
        }
        return;
    }

    fetch(routes.oauthProviders, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'X-CSRF-TOKEN': csrfToken
        }
    })
    .then(function (res) {
        if (!res.ok) throw new Error('Failed to load OAuth providers');
        return res.json();
    })
    .then(function (data) {
        oauthProvidersData = Array.isArray(data.data) ? data.data : [];
        oauthPresets = data.presets || {};
        oauthProvidersLoaded = true;
        renderOAuthProvidersList();
    })
    .catch(function () {
        oauthProvidersLoaded = true;
        var listContainer = document.getElementById('oauthProviderList');
        if (listContainer) {
            listContainer.innerHTML = '<div class="te-announcements-error">Failed to load OAuth providers</div>';
        }
    });
}

function getOAuthCallbackUrl(providerKey) {
    return window.location.origin + '/auth/oauth/' + encodeURIComponent(providerKey) + '/callback';
}

function renderOAuthProvidersList() {
    var listContainer = document.getElementById('oauthProviderList');
    if (!listContainer) return;

    if (oauthProvidersData.length === 0) {
        listContainer.innerHTML = getTemplate('te-oauth-empty');
        return;
    }

    listContainer.innerHTML = oauthProvidersData.map(renderOAuthProviderCard).join('');
}

function renderOAuthProviderCard(provider) {
    var preset = oauthPresets[provider.provider_type] || {};
    var statusClass = provider.enabled ? 'te-addon-status-enabled' : 'te-addon-status-disabled';
    var statusText = provider.enabled ? 'Enabled' : 'Disabled';
    var clientStatus = provider.has_client_secret ? 'Client credentials configured' : 'Client secret required';
    var callbackUrl = provider.redirect_uri || getOAuthCallbackUrl(provider.provider_key);

    return replaceAll(getTemplate('te-oauth-provider-card'), {
        'PROVIDER_ID': provider.id,
        'PROVIDER_ICON': esc(preset.icon || provider.icon || 'key'),
        'PROVIDER_NAME': esc(provider.name || preset.name || provider.provider_type),
        'PROVIDER_TYPE': esc(preset.name || provider.provider_type),
        'STATUS_CLASS': statusClass,
        'STATUS_TEXT': statusText,
        'CALLBACK_URL': esc(callbackUrl),
        'CLIENT_STATUS': esc(clientStatus)
    });
}

function openOAuthProviderModal(provider) {
    closeOAuthProviderModal();

    var isEdit = !!provider;
    var providerType = provider ? provider.provider_type : '';
    var preset = providerType ? (oauthPresets[providerType] || {}) : {};
    var usedTypes = oauthProvidersData.map(function (item) { return item.provider_type; });
    var availableTypes = Object.keys(oauthPresets).filter(function (type) {
        if (isEdit && type === providerType) return true;
        return usedTypes.indexOf(type) === -1;
    });

    if (!isEdit && availableTypes.length === 0) {
        toast('All supported OAuth providers are already configured', 'error');
        return;
    }

    if (!isEdit && !providerType) {
        providerType = availableTypes[0];
        preset = oauthPresets[providerType] || {};
    }

    var providerTypeOptions = availableTypes.map(function (type) {
        var typePreset = oauthPresets[type] || {};
        return '<option value="' + esc(type) + '"' + (type === providerType ? ' selected' : '') + '>' + esc(typePreset.name || type) + '</option>';
    }).join('');

    var callbackUrl = provider
        ? (provider.redirect_uri || getOAuthCallbackUrl(provider.provider_key))
        : getOAuthCallbackUrl((preset.provider_key || providerType));

    var modalHtml = replaceAll(getTemplate('te-oauth-provider-modal'), {
        'MODAL_TITLE': isEdit ? 'Edit OAuth Provider' : 'Add OAuth Provider',
        'PROVIDER_TYPE_OPTIONS': providerTypeOptions,
        'PROVIDER_TYPE_DISABLED': isEdit ? 'disabled' : '',
        'PROVIDER_TYPE_HELP': isEdit ? 'Provider type cannot be changed after creation.' : 'Choose the OAuth provider to configure.',
        'CLIENT_ID': esc(provider ? provider.client_id || '' : ''),
        'CLIENT_ID_PLACEHOLDER': 'Enter client ID',
        'CLIENT_SECRET_PLACEHOLDER': provider && provider.has_client_secret ? 'Leave blank to keep current secret' : 'Enter client secret',
        'CALLBACK_URL': esc(callbackUrl),
        'OAUTH_ENABLED_CHECKED': boolToDataAttr(provider ? toBool(provider.enabled, true) : true),
        'REDIRECT_URI': esc(callbackUrl)
    });

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    var modal = document.getElementById('oauthProviderModal');
    if (!modal) return;

    modal.dataset.providerId = isEdit ? String(provider.id) : '';
    processDataChecked(modal);

    var typeSelect = modal.querySelector('[data-oauth-field="provider_type"]');
    if (typeSelect && !isEdit) {
        typeSelect.addEventListener('change', function () {
            var selectedPreset = oauthPresets[typeSelect.value] || {};
            var url = getOAuthCallbackUrl(selectedPreset.provider_key || typeSelect.value);
            var callbackPreview = modal.querySelector('[data-oauth-callback-preview]');
            var redirectInput = modal.querySelector('[data-oauth-field="redirect_uri"]');
            if (callbackPreview) callbackPreview.value = url;
            if (redirectInput) redirectInput.value = url;
        });
    }

    var saveBtn = modal.querySelector('[data-action="save-oauth-provider"]');
    if (saveBtn) {
        saveBtn.addEventListener('click', function () {
            saveOAuthProvider();
        });
    }

    var closeBtn = modal.querySelector('[data-action="close-oauth-provider-modal"]');
    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            closeOAuthProviderModal();
        });
    }

    var copyCallbackBtn = modal.querySelector('[data-action="copy-oauth-modal-callback"]');
    if (copyCallbackBtn) {
        copyCallbackBtn.addEventListener('click', function () {
            var callbackPreview = modal.querySelector('[data-oauth-callback-preview]');
            copyOAuthCallbackUrl(callbackPreview ? callbackPreview.value : '');
        });
    }

    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            closeOAuthProviderModal();
        }
    });
}

function closeOAuthProviderModal() {
    var modal = document.getElementById('oauthProviderModal');
    if (modal) {
        modal.remove();
    }
}

function saveOAuthProvider() {
    var modal = document.getElementById('oauthProviderModal');
    if (!modal || !routes.oauthProviders) return;

    var providerId = modal.dataset.providerId ? parseInt(modal.dataset.providerId, 10) : null;
    var typeSelect = modal.querySelector('[data-oauth-field="provider_type"]');
    var clientIdInput = modal.querySelector('[data-oauth-field="client_id"]');
    var clientSecretInput = modal.querySelector('[data-oauth-field="client_secret"]');
    var redirectInput = modal.querySelector('[data-oauth-field="redirect_uri"]');
    var enabledInput = modal.querySelector('[data-oauth-field="enabled"]');

    var payload = {
        provider_type: typeSelect ? typeSelect.value : '',
        client_id: clientIdInput ? clientIdInput.value.trim() : '',
        redirect_uri: redirectInput ? redirectInput.value.trim() : '',
        enabled: enabledInput ? enabledInput.checked : true
    };

    if (clientSecretInput && clientSecretInput.value.trim()) {
        payload.client_secret = clientSecretInput.value.trim();
    }

    if (!providerId && !payload.client_secret) {
        toast('Client secret is required', 'error');
        return;
    }

    if (!payload.provider_type || !payload.client_id) {
        toast('Provider and client ID are required', 'error');
        return;
    }

    var url = routes.oauthProviders;
    var method = 'POST';
    if (providerId) {
        url = routes.oauthProviders + '/' + providerId;
        method = 'PATCH';
    }

    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': csrfToken
        },
        body: JSON.stringify(payload)
    })
    .then(function (res) {
        if (!res.ok) throw new Error('Failed to save OAuth provider');
        return res.json();
    })
    .then(function (data) {
        closeOAuthProviderModal();
        if (providerId) {
            var index = oauthProvidersData.findIndex(function (item) { return item.id === providerId; });
            if (index !== -1) {
                oauthProvidersData[index] = data.data;
            }
        } else {
            oauthProvidersData.push(data.data);
        }
        renderOAuthProvidersList();
        toast('OAuth provider saved', 'success');
    })
    .catch(function () {
        toast('Failed to save OAuth provider', 'error');
    });
}

function deleteOAuthProvider(providerId) {
    if (!routes.oauthProviders) return;

    showConfirm('Delete OAuth Provider', 'Are you sure you want to delete this OAuth provider?', function () {
        fetch(routes.oauthProviders + '/' + providerId, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'X-CSRF-TOKEN': csrfToken
            }
        })
        .then(function (res) {
            if (!res.ok) throw new Error('Failed to delete OAuth provider');
            oauthProvidersData = oauthProvidersData.filter(function (item) { return item.id !== providerId; });
            renderOAuthProvidersList();
            toast('OAuth provider deleted', 'success');
        })
        .catch(function () {
            toast('Failed to delete OAuth provider', 'error');
        });
    });
}

function moveOAuthProvider(providerId, direction) {
    var index = oauthProvidersData.findIndex(function (item) { return item.id === providerId; });
    if (index === -1) return;

    var targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= oauthProvidersData.length) return;

    var temp = oauthProvidersData[index];
    oauthProvidersData[index] = oauthProvidersData[targetIndex];
    oauthProvidersData[targetIndex] = temp;

    renderOAuthProvidersList();

    if (!routes.oauthProviderReorder) return;

    fetch(routes.oauthProviderReorder, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': csrfToken
        },
        body: JSON.stringify({
            providers: oauthProvidersData.map(function (item, order) {
                return { id: item.id, order: order };
            })
        })
    })
    .then(function (res) {
        if (!res.ok) throw new Error('Failed to reorder OAuth providers');
        return res.json();
    })
    .then(function (data) {
        oauthProvidersData = Array.isArray(data.data) ? data.data : oauthProvidersData;
        renderOAuthProvidersList();
    })
    .catch(function () {
        loadOAuthProviders();
        toast('Failed to reorder OAuth providers', 'error');
    });
}

function copyOAuthCallbackUrl(url) {
    if (!url) return;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
            toast('Callback URL copied', 'success');
        }).catch(function () {
            toast('Failed to copy callback URL', 'error');
        });
        return;
    }

    var input = document.createElement('textarea');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    try {
        document.execCommand('copy');
        toast('Callback URL copied', 'success');
    } catch (err) {
        toast('Failed to copy callback URL', 'error');
    }
    document.body.removeChild(input);
}

var serverTemplatesData = [];
var serverTemplatesLoaded = false;

function renderTemplatesTab() {
    return renderTemplate('te-tab-templates', {
        'TEMPLATE_LIST': '<div class="te-template-loading"><i class="fa fa-spinner fa-spin"></i><span>Loading server templates...</span></div>'
    });
}

function initServerTemplatesTab() {
    if (serverTemplatesLoaded) {
        renderServerTemplatesList();
        return;
    }

    loadServerTemplates();
}

function loadServerTemplates() {
    if (!routes.serverTemplates) {
        var listContainer = document.getElementById('serverTemplateList');
        if (listContainer) {
            listContainer.innerHTML = '<div class="te-announcements-error">Server template routes not configured</div>';
        }
        return;
    }

    fetch(routes.serverTemplates, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'X-CSRF-TOKEN': csrfToken
        }
    })
    .then(function (res) {
        if (!res.ok) throw new Error('Failed to load server templates');
        return res.json();
    })
    .then(function (data) {
        serverTemplatesData = Array.isArray(data.data) ? data.data : [];
        serverTemplatesLoaded = true;
        renderServerTemplatesList();
    })
    .catch(function () {
        serverTemplatesLoaded = true;
        var listContainer = document.getElementById('serverTemplateList');
        if (listContainer) {
            listContainer.innerHTML = '<div class="te-announcements-error">Failed to load server templates</div>';
        }
    });
}

function renderServerTemplatesList() {
    var listContainer = document.getElementById('serverTemplateList');
    if (!listContainer) return;

    if (serverTemplatesData.length === 0) {
        listContainer.innerHTML = getTemplate('te-server-template-empty');
        return;
    }

    listContainer.innerHTML = serverTemplatesData.map(renderServerTemplateCard).join('');
}

function renderServerTemplateCard(template) {
    return replaceAll(getTemplate('te-server-template-card'), {
        'TEMPLATE_ID': template.id,
        'TEMPLATE_NAME': esc(template.name || 'Untitled'),
        'TEMPLATE_DESCRIPTION': esc(template.description || 'No description provided.'),
        'TEMPLATE_CPU': template.cpu !== undefined ? template.cpu : 0,
        'TEMPLATE_MEMORY': template.memory !== undefined ? template.memory : 0,
        'TEMPLATE_DISK': template.disk !== undefined ? template.disk : 0,
        'TEMPLATE_DATABASES': template.database_limit !== undefined ? template.database_limit : 0,
        'TEMPLATE_BACKUPS': template.backup_limit !== undefined ? template.backup_limit : 0,
        'TEMPLATE_ALLOCATIONS': template.allocation_limit !== undefined ? template.allocation_limit : 0,
        'TEMPLATE_SWAP': template.swap !== undefined ? template.swap : 0,
        'TEMPLATE_IO': template.io !== undefined ? template.io : 500
    });
}

function getServerTemplateEggOptionsHtml(nestId, selectedEggId) {
    var html = '';
    if (!nestId) return html;

    var selectedNest = nests.find(function (nest) { return parseInt(nest.id, 10) === parseInt(nestId, 10); });
    if (!selectedNest || !selectedNest.eggs) return html;

    selectedNest.eggs.forEach(function (egg) {
        html += '<option value="' + egg.id + '"' + (parseInt(egg.id, 10) === parseInt(selectedEggId, 10) ? ' selected' : '') + '>' + esc(egg.name) + '</option>';
    });

    return html;
}

function openServerTemplateModal(template) {
    closeServerTemplateModal();

    var isEdit = !!template;
    var data = template || {
        name: '',
        description: '',
        nest_id: '',
        egg_id: '',
        cpu: 0,
        threads: '',
        memory: 1024,
        swap: 0,
        disk: 5120,
        io: 500,
        oom_disabled: true,
        database_limit: 0,
        allocation_limit: 0,
        backup_limit: 0
    };

    var nestOptionsHtml = '';
    nests.forEach(function (nest) {
        nestOptionsHtml += '<option value="' + nest.id + '"' + (parseInt(nest.id, 10) === parseInt(data.nest_id, 10) ? ' selected' : '') + '>' + esc(nest.name) + '</option>';
    });

    var modalHtml = replaceAll(getTemplate('te-server-template-modal'), {
        'MODAL_TITLE': isEdit ? 'Edit Server Template' : 'Add Server Template',
        'TEMPLATE_NAME': esc(data.name || ''),
        'TEMPLATE_DESCRIPTION': esc(data.description || ''),
        'NEST_OPTIONS': nestOptionsHtml,
        'EGG_OPTIONS': getServerTemplateEggOptionsHtml(data.nest_id, data.egg_id),
        'TEMPLATE_CPU': data.cpu !== undefined ? data.cpu : 0,
        'TEMPLATE_THREADS': esc(data.threads || ''),
        'TEMPLATE_MEMORY': data.memory !== undefined ? data.memory : 1024,
        'TEMPLATE_SWAP': data.swap !== undefined ? data.swap : 0,
        'TEMPLATE_DISK': data.disk !== undefined ? data.disk : 5120,
        'TEMPLATE_IO': data.io !== undefined ? data.io : 500,
        'TEMPLATE_DATABASES': data.database_limit !== undefined ? data.database_limit : 0,
        'TEMPLATE_BACKUPS': data.backup_limit !== undefined ? data.backup_limit : 0,
        'TEMPLATE_ALLOCATIONS': data.allocation_limit !== undefined ? data.allocation_limit : 0,
        'TEMPLATE_OOM_CHECKED': boolToDataAttr(toBool(data.oom_disabled, true))
    });

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    var modal = document.getElementById('serverTemplateModal');
    if (!modal) return;

    modal.dataset.templateId = isEdit ? String(data.id) : '';
    processDataChecked(modal);

    var nestSelect = modal.querySelector('[data-template-nest]');
    var eggSelect = modal.querySelector('[data-template-egg]');
    if (nestSelect && eggSelect) {
        nestSelect.addEventListener('change', function () {
            eggSelect.innerHTML = '<option value="">No egg (choose during server creation)</option>' + getServerTemplateEggOptionsHtml(nestSelect.value, '');
        });
    }

    var saveBtn = modal.querySelector('[data-action="save-server-template"]');
    if (saveBtn) {
        saveBtn.addEventListener('click', function () {
            saveServerTemplate();
        });
    }

    var closeBtn = modal.querySelector('[data-action="close-server-template-modal"]');
    if (closeBtn) {
        closeBtn.addEventListener('click', function () {
            closeServerTemplateModal();
        });
    }

    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            closeServerTemplateModal();
        }
    });
}

function closeServerTemplateModal() {
    var modal = document.getElementById('serverTemplateModal');
    if (modal) {
        modal.remove();
    }
}

function readServerTemplateModalData() {
    var modal = document.getElementById('serverTemplateModal');
    if (!modal) return null;

    var getFieldValue = function (field) {
        var el = modal.querySelector('[data-template-field="' + field + '"]');
        if (!el) return '';
        if (el.type === 'checkbox') return el.checked;
        return el.value;
    };

    return {
        name: String(getFieldValue('name') || '').trim(),
        description: String(getFieldValue('description') || '').trim(),
        nest_id: getFieldValue('nest_id') ? parseInt(getFieldValue('nest_id'), 10) : null,
        egg_id: getFieldValue('egg_id') ? parseInt(getFieldValue('egg_id'), 10) : null,
        cpu: parseInt(getFieldValue('cpu'), 10) || 0,
        threads: String(getFieldValue('threads') || '').trim() || null,
        memory: parseInt(getFieldValue('memory'), 10) || 0,
        swap: parseInt(getFieldValue('swap'), 10) || 0,
        disk: parseInt(getFieldValue('disk'), 10) || 0,
        io: parseInt(getFieldValue('io'), 10) || 500,
        oom_disabled: !!getFieldValue('oom_disabled'),
        database_limit: parseInt(getFieldValue('database_limit'), 10) || 0,
        allocation_limit: parseInt(getFieldValue('allocation_limit'), 10) || 0,
        backup_limit: parseInt(getFieldValue('backup_limit'), 10) || 0
    };
}

function saveServerTemplate() {
    var modal = document.getElementById('serverTemplateModal');
    if (!modal || !routes.serverTemplates) return;

    var templateId = modal.dataset.templateId ? parseInt(modal.dataset.templateId, 10) : null;
    var payload = readServerTemplateModalData();
    if (!payload || !payload.name) {
        toast('Template name is required', 'error');
        return;
    }

    var url = routes.serverTemplates;
    var method = 'POST';
    if (templateId) {
        url = routes.serverTemplates + '/' + templateId;
        method = 'PATCH';
    }

    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': csrfToken
        },
        body: JSON.stringify(payload)
    })
    .then(function (res) {
        if (!res.ok) throw new Error('Failed to save server template');
        return res.json();
    })
    .then(function (data) {
        closeServerTemplateModal();
        if (templateId) {
            var index = serverTemplatesData.findIndex(function (item) { return item.id === templateId; });
            if (index !== -1) {
                serverTemplatesData[index] = data.data;
            }
        } else {
            serverTemplatesData.push(data.data);
        }
        renderServerTemplatesList();
        toast('Server template saved', 'success');
    })
    .catch(function () {
        toast('Failed to save server template', 'error');
    });
}

function deleteServerTemplate(templateId) {
    if (!routes.serverTemplates) return;

    showConfirm('Delete Server Template', 'Are you sure you want to delete this server template?', function () {
        fetch(routes.serverTemplates + '/' + templateId, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'X-CSRF-TOKEN': csrfToken
            }
        })
        .then(function (res) {
            if (!res.ok) throw new Error('Failed to delete server template');
            serverTemplatesData = serverTemplatesData.filter(function (item) { return item.id !== templateId; });
            renderServerTemplatesList();
            toast('Server template deleted', 'success');
        })
        .catch(function () {
            toast('Failed to delete server template', 'error');
        });
    });
}

function renderThemeTab() {
    var theme = config.theme || {};
    var colors = theme.colors || {};
    var lightColors = theme.light_colors || {};

    var colorFields = [
        ['primary', 'Primary'],
        ['secondary', 'Secondary'],
        ['neutral', 'Neutral'],
        ['base', 'Base Text'],
        ['muted', 'Muted Text'],
        ['inverted', 'Inverted'],
        ['background', 'Background'],
        ['background_secondary', 'Background Alt']
    ];

    var colorCards = '';
    colorFields.forEach(function (c) {
        colorCards += renderColorCard(c[0], c[1], colors[c[0]], 'theme.colors.');
    });

    var lightColorCards = '';
    colorFields.forEach(function (c) {
        lightColorCards += renderColorCard(c[0], c[1], lightColors[c[0]], 'theme.light_colors.');
    });

    var colorPresetsHtml = renderColorPresets();

    var fontOptions = buildOptions(fonts.map(function(f) {
        return { value: f.value, label: f.label };
    }), theme.font_family);

    var borderRadius = theme.border_radius || 8;

    return renderTemplate('te-tab-theme', {
        'COLOR_PRESETS': colorPresetsHtml,
        'COLOR_CARDS': colorCards,
        'LIGHT_COLOR_CARDS': lightColorCards,
        'BORDER_RADIUS': borderRadius,
        'FONT_OPTIONS': fontOptions
    });
}

function renderColorPresets() {
    var html = '';
    colorPresets.forEach(function (preset) {
        var swatches = '';
        var previewColors = ['primary', 'background', 'neutral', 'base'];
        previewColors.forEach(function (key) {
            swatches += '<div class="te-preset-swatch" style="background:' + preset.colors[key] + '"></div>';
        });

        html += '<button class="te-preset-btn" data-preset="' + preset.id + '">';
        html += '<div class="te-preset-swatches">' + swatches + '</div>';
        html += '<span class="te-preset-name">' + esc(preset.name) + '</span>';
        html += '</button>';
    });
    return html;
}

function applyColorPreset(presetId) {
    var preset = colorPresets.find(function (p) { return p.id === presetId; });
    if (!preset) return;

    if (!config.theme) config.theme = {};
    if (!config.theme.colors) config.theme.colors = {};
    if (!config.theme.light_colors) config.theme.light_colors = {};

    for (var key in preset.colors) {
        if (preset.colors.hasOwnProperty(key)) {
            config.theme.colors[key] = preset.colors[key];
        }
    }

    if (preset.light_colors) {
        for (var key in preset.light_colors) {
            if (preset.light_colors.hasOwnProperty(key)) {
                config.theme.light_colors[key] = preset.light_colors[key];
            }
        }
    }

    markUnsaved();
    refreshPanel();
    save();
    toast('Applied "' + preset.name + '" preset', 'success');
}

function renderColorCard(key, label, value, pathPrefix) {
    var prefix = pathPrefix || 'theme.colors.';
    var defaultColors = prefix.indexOf('light') !== -1
        ? (defaults.theme && defaults.theme.light_colors)
        : (defaults.theme && defaults.theme.colors);
    var val = value || (defaultColors && defaultColors[key]) || '';
    var hex = hslToHex(val);

    return renderTemplate('te-color-card', {
        'KEY': key,
        'LABEL': label,
        'VALUE': val,
        'HEX': hex,
        'PATH_PREFIX': prefix
    });
}

function renderComponentsTab() {
    var components = config.components || {};
    var serverCard = components.server_card || 'default';
    var powerDock = components.power_dock || 'dock';
    var statCard = components.stat_card || 'default';
    var sidebarItemStyle = components.sidebar_item_style || 'default';
    var loginPage = components.login_page || 'centered';
    var loginPanelBgType = components.login_panel_bg_type || 'image';
    var loginPanelBgImage = components.login_panel_bg_image || 'https://static0.gamerantimages.com/wordpress/wp-content/uploads/2022/08/minecraft-4.jpg?q=50&fit=crop&w=1296&h=891&dpr=1.5';
    var loginPanelGradientStart = components.login_panel_gradient_start || 'hsl(229, 100%, 64%)';
    var loginPanelGradientEnd = components.login_panel_gradient_end || 'hsl(240, 3%, 6%)';
    var showPanelSettings = loginPage === 'split_left' || loginPage === 'split_card';
    var playerCount = components.player_count || {};
    var playerCountEnabled = toBool(playerCount.enabled, false);
    var playerCountPlacement = ['sidebar', 'stat_block', 'server_card'].indexOf(playerCount.placement) !== -1
        ? playerCount.placement
        : 'sidebar';
    var playerCountAllowedEggs = Array.isArray(playerCount.allowed_eggs) ? playerCount.allowed_eggs : [];
    var ramUpgradeAlert = components.ram_upgrade_alert || {};
    var ramAlertEnabled = toBool(ramUpgradeAlert.enabled, false);
    var ramAlertThreshold = ramUpgradeAlert.threshold !== undefined && ramUpgradeAlert.threshold !== null ? ramUpgradeAlert.threshold : 85;
    var ramAlertTitle = ramUpgradeAlert.title || 'RAM Limit Approaching';
    var ramAlertText = ramUpgradeAlert.text || 'Your server is using a high amount of RAM. Consider upgrading to a higher plan to ensure optimal performance.';
    var ramAlertButtonLink = ramUpgradeAlert.upgrade_button_link || '/store';

    var replacements = Object.assign({},
        radioStates('SERVER_CARD', serverCard, ['default', 'compact', 'minimal', 'detailed']),
        radioStates('POWER_DOCK', powerDock, ['dock', 'dock_labels', 'sidebar', 'topbar']),
        radioStates('STAT_CARD', statCard, ['default', 'centered', 'minimal', 'gradient', 'compact', 'split']),
        radioStates('SIDEBAR_ITEM', sidebarItemStyle, ['default', 'solid', 'gradient', 'gradient_no_border']),
        radioStates('LOGIN_PAGE', loginPage, ['centered', 'split_left', 'minimal', 'split_card']),
        radioStates('LOGIN_PANEL_TYPE', loginPanelBgType, ['image', 'gradient']),
        radioStates('PLAYER_COUNT', playerCountPlacement, ['sidebar', 'stat_block', 'server_card']),
        {
            'PLAYER_COUNT_ENABLED': boolToDataAttr(playerCountEnabled),
            'PLAYER_COUNT_EGGS_OPTIONS': renderComponentEggSelectorOptions('player_count.allowed_eggs', playerCountAllowedEggs),
            'PLAYER_COUNT_EGGS_COUNT': getComponentEggSelectorCount(playerCountAllowedEggs),
            'RAM_ALERT_ENABLED': boolToDataAttr(ramAlertEnabled),
            'RAM_ALERT_THRESHOLD': esc(ramAlertThreshold),
            'RAM_ALERT_TITLE': esc(ramAlertTitle),
            'RAM_ALERT_TEXT': esc(ramAlertText),
            'RAM_ALERT_BUTTON_LINK': esc(ramAlertButtonLink),
            'LOGIN_PANEL_SETTINGS_VISIBLE': showPanelSettings ? 'visible' : '',
            'LOGIN_PANEL_BG_IMAGE': loginPanelBgImage,
            'LOGIN_PANEL_HAS_IMAGE': loginPanelBgImage ? 'has-image' : '',
            'LOGIN_PANEL_PREVIEW_VISIBLE': loginPanelBgImage ? 'visible' : '',
            'LOGIN_PANEL_GRADIENT_START': loginPanelGradientStart,
            'LOGIN_PANEL_GRADIENT_START_HEX': hslToHex(loginPanelGradientStart),
            'LOGIN_PANEL_GRADIENT_END': loginPanelGradientEnd,
            'LOGIN_PANEL_GRADIENT_END_HEX': hslToHex(loginPanelGradientEnd),
            'LOGIN_PANEL_IMAGE_FIELDS_VISIBLE': loginPanelBgType === 'image' ? 'visible' : '',
            'LOGIN_PANEL_GRADIENT_FIELDS_VISIBLE': loginPanelBgType === 'gradient' ? 'visible' : ''
        }
    );

    return renderTemplate('te-tab-components', replacements);
}

function renderLayoutTab() {
    var layout = config.layout || {};
    var layoutType = layout.layout_type || 'default';
    var showDashboard = toBool(layout.show_dashboard, true);
    var defaultQuickActions = [
        { icon: 'terminal', title: 'Console', link: '/console' },
        { icon: 'folder-open', title: 'Files', link: '/files' },
        { icon: 'cloud-upload', title: 'Backups', link: '/backups' },
        { icon: 'sliders', title: 'Settings', link: '/settings' }
    ];
    var quickActions = Array.isArray(layout.dashboard_quick_actions) && layout.dashboard_quick_actions.length > 0
        ? layout.dashboard_quick_actions
        : defaultQuickActions;
    if (!layout.dashboard_quick_actions || layout.dashboard_quick_actions.length === 0) {
        setConfig('layout.dashboard_quick_actions', defaultQuickActions);
    }
    var navLinks = layout.nav_links || {};
    var categories = Array.isArray(navLinks.categories) ? navLinks.categories : [];

    var contentMaxWidth = layout.content_max_width !== undefined ? layout.content_max_width : 1200;
    var authBgImage = layout.auth_background_image || '';
    var authBgOverlay = layout.auth_background_overlay !== undefined ? layout.auth_background_overlay : 55;
    var dashboardBgImage = layout.dashboard_background_image || '';
    var dashboardBgOverlay = layout.dashboard_background_overlay !== undefined ? layout.dashboard_background_overlay : 35;
    var serverBgType = layout.server_background_type || 'none';
    var serverBgSource = layout.server_background_source || 'custom';
    var serverBgImage = layout.server_background_image || '';
    var serverBgOverlay = layout.server_background_overlay !== undefined ? layout.server_background_overlay : 50;

    var quickActionsHtml = quickActions.map(renderQuickActionItem).join('');

    var navCategoriesHtml = '';
    if (categories.length) {
        var sortedCategories = categories.map(function (cat, i) {
            return { category: cat, originalIndex: i };
        }).sort(function (a, b) {
            var orderA = a.category && (a.category.order === 0 || a.category.order) ? a.category.order : a.originalIndex;
            var orderB = b.category && (b.category.order === 0 || b.category.order) ? b.category.order : b.originalIndex;
            return orderA - orderB;
        });

        navCategoriesHtml = '<div data-sortable="nav-categories">' + sortedCategories.map(function(item) {
            return renderNavCategory(item.category, item.originalIndex);
        }).join('') + '</div>';
    } else {
        navCategoriesHtml = replaceAll(getTemplate('te-repeater-empty'), {
            'MESSAGE': 'No navigation categories configured.'
        });
    }

    var serverListLayout = layout.server_list_layout || 'list';

    var replacements = Object.assign({},
        radioStates('LAYOUT', layoutType, ['default', 'navbar', 'floating', 'bottombar']),
        radioStates('SERVER', serverListLayout === 'list' || !serverListLayout ? 'list' : serverListLayout, ['list', 'grid2', 'grid3']),
        radioStates('SERVER_BG', serverBgType, ['none', 'image']),
        radioStates('SERVER_BG_SRC', serverBgSource, ['custom', 'egg']),
        {
            'CONTENT_MAX_WIDTH': contentMaxWidth,
            'SHOW_DASHBOARD_CHECKED': boolToDataAttr(showDashboard),
            'AUTH_BG_HAS_IMAGE': authBgImage ? 'has-image' : '',
            'AUTH_BG_IMAGE_PREVIEW_VISIBLE': authBgImage ? 'visible' : '',
            'AUTH_BG_IMAGE_URL': authBgImage,
            'AUTH_BG_OVERLAY_OPACITY': authBgOverlay,
            'DASHBOARD_BG_HAS_IMAGE': dashboardBgImage ? 'has-image' : '',
            'DASHBOARD_BG_IMAGE_PREVIEW_VISIBLE': dashboardBgImage ? 'visible' : '',
            'DASHBOARD_BG_IMAGE_URL': dashboardBgImage,
            'DASHBOARD_BG_OVERLAY_OPACITY': dashboardBgOverlay,
            'QUICK_ACTIONS': quickActionsHtml,
            'ADD_QUICK_ACTION_DISABLED': quickActions.length >= 4 ? 'disabled' : '',
            'NAV_CATEGORIES': navCategoriesHtml,
            'ICON_PLUS': getIcon('plus'),
            'ICON_REFRESH': getIcon('refresh'),
            'SERVER_BG_SETTINGS_VISIBLE': serverBgType === 'image' ? 'visible' : '',
            'SERVER_BG_CUSTOM_VISIBLE': serverBgSource === 'custom' ? 'visible' : '',
            'SERVER_BG_HAS_IMAGE': serverBgImage ? 'has-image' : '',
            'SERVER_BG_IMAGE_PREVIEW_VISIBLE': serverBgImage ? 'visible' : '',
            'SERVER_BG_IMAGE_URL': serverBgImage,
            'SERVER_BG_OVERLAY_OPACITY': serverBgOverlay
        }
    );

    return renderTemplate('te-tab-layout', replacements);
}

function renderQuickActionItem(item, index) {
    var icon = item && item.icon ? item.icon : '';
    var title = item && item.title ? item.title : '';
    var link = item && item.link ? item.link : '';
    var template = getTemplate('te-quick-action-item');

    return replaceAll(template, {
        'INDEX': index,
        'INDEX_DISPLAY': index + 1,
        'ICON': esc(icon),
        'ICON_DISPLAY': icon ? esc(icon) : 'Select icon',
        'TITLE': esc(title),
        'LINK': esc(link),
        'ICON_CLOSE': getIcon('close')
    });
}

var linksPreviewEgg = '';

function renderLinksTab() {
    var layout = config.layout || {};
    var navLinks = layout.nav_links || {};
    var categories = Array.isArray(navLinks.categories) ? navLinks.categories : [];
    var dashboardCustomLinks = Array.isArray(layout.dashboard_custom_links) ? layout.dashboard_custom_links : [];
    var accountCustomLinks = Array.isArray(layout.account_custom_links) ? layout.account_custom_links : [];

    var navCategoriesHtml = '';
    if (categories.length) {
        var sortedCategories = categories.map(function (cat, i) {
            return { category: cat, originalIndex: i };
        }).sort(function (a, b) {
            var orderA = a.category && (a.category.order === 0 || a.category.order) ? a.category.order : a.originalIndex;
            var orderB = b.category && (b.category.order === 0 || b.category.order) ? b.category.order : b.originalIndex;
            return orderA - orderB;
        });

        navCategoriesHtml = '<div data-sortable="nav-categories">';
        sortedCategories.forEach(function (item) {
            navCategoriesHtml += renderNavCategory(item.category, item.originalIndex);
        });
        navCategoriesHtml += '</div>';
    } else {
        navCategoriesHtml = replaceAll(getTemplate('te-repeater-empty'), {
            'MESSAGE': 'No navigation categories configured.'
        });
    }

    var dashboardCustomLinksHtml = '';
    if (dashboardCustomLinks.length) {
        dashboardCustomLinksHtml = '<div data-sortable="dashboard-custom-links">';
        dashboardCustomLinks.forEach(function (link, i) {
            dashboardCustomLinksHtml += renderCustomLinkItem(link, i, 'dashboard_custom_links');
        });
        dashboardCustomLinksHtml += '</div>';
    } else {
        dashboardCustomLinksHtml = '<div class="te-custom-links-empty">No custom links added yet.</div>';
    }

    var accountCustomLinksHtml = '';
    if (accountCustomLinks.length) {
        accountCustomLinksHtml = '<div data-sortable="account-custom-links">';
        accountCustomLinks.forEach(function (link, i) {
            accountCustomLinksHtml += renderCustomLinkItem(link, i, 'account_custom_links');
        });
        accountCustomLinksHtml += '</div>';
    } else {
        accountCustomLinksHtml = '<div class="te-custom-links-empty">No custom links added yet.</div>';
    }

    var eggOptionsHtml = '<option value="">All servers (no filter)</option>';
    eggs.forEach(function (egg) {
        var selected = linksPreviewEgg === String(egg.id) ? ' selected' : '';
        eggOptionsHtml += '<option value="' + egg.id + '"' + selected + '>' + esc(egg.name) + ' (' + esc(egg.nest_name) + ')</option>';
    });

    var previewHtml = renderLinksPreview();

    var template = getTemplate('te-tab-links');
    return replaceAll(template, {
        'NAV_CATEGORIES': navCategoriesHtml,
        'DASHBOARD_CUSTOM_LINKS': dashboardCustomLinksHtml,
        'ACCOUNT_CUSTOM_LINKS': accountCustomLinksHtml,
        'ICON_PLUS': getIcon('plus'),
        'ICON_REFRESH': getIcon('refresh'),
        'EGG_OPTIONS': eggOptionsHtml,
        'PREVIEW_HTML': previewHtml,
        'SERVER_LINKS_ACTIVE': linksMode === 'server' ? 'active' : '',
        'DASHBOARD_LINKS_ACTIVE': linksMode === 'dashboard' ? 'active' : '',
        'ACCOUNT_LINKS_ACTIVE': linksMode === 'account' ? 'active' : '',
        'SERVER_LINKS_EDITOR_VISIBLE': linksMode === 'server' ? 'visible' : '',
        'DASHBOARD_LINKS_EDITOR_VISIBLE': linksMode === 'dashboard' ? 'visible' : '',
        'ACCOUNT_LINKS_EDITOR_VISIBLE': linksMode === 'account' ? 'visible' : '',
        'EGG_SELECTOR_VISIBLE': linksMode === 'server' ? 'visible' : ''
    });
}

function isHttpUrl(url) {
    return /^https?:\/\//i.test((url || '').toString().trim());
}

function getOpenInNewTabDefault(item, urlField) {
    if (!item || typeof item !== 'object') return false;
    if (item.open_in_new_tab === true || item.open_in_new_tab === false) {
        return item.open_in_new_tab;
    }
    return isHttpUrl(item[urlField]);
}

function renderCustomLinkItem(item, linkIndex, pathPrefix) {
    var label = item && item.label ? item.label : '';
    var icon = item && item.icon ? item.icon : 'link';
    var url = item && item.url ? item.url : '';
    var openInNewTab = getOpenInNewTabDefault(item, 'url');

    var template = getTemplate('te-custom-link-item');

    return replaceAll(template, {
        'LINK_INDEX': String(linkIndex),
        'LABEL': esc(label),
        'ICON': esc(icon),
        'URL': esc(url),
        'PATH_PREFIX': pathPrefix,
        'OPEN_SAME_TAB_ACTIVE': openInNewTab ? '' : 'active',
        'OPEN_NEW_TAB_ACTIVE': openInNewTab ? 'active' : '',
        'ICON_ARROW_UP': getIcon('arrow-up'),
        'ICON_ARROW_DOWN': getIcon('arrow-down'),
        'ICON_CLOSE': getIcon('close')
    });
}

function renderLinksPreview() {
    var layout = config.layout || {};
    var layoutType = layout.layout_type || 'default';
    var theme = config.theme || {};
    var colors = theme.colors || {};

    var primaryColor = colors.primary || 'hsl(229, 100%, 64%)';
    var backgroundColor = colors.background || 'hsl(240, 3%, 6%)';
    var backgroundSecondary = colors.background_secondary || 'hsl(240, 5%, 10%)';
    var neutralColor = colors.neutral || 'hsl(240, 5%, 18%)';
    var baseColor = colors.base || 'hsl(0, 0%, 100%)';
    var mutedColor = colors.muted || 'hsl(240, 5%, 64%)';

    var styleVars = '--preview-primary:' + primaryColor + ';' +
        '--preview-bg:' + backgroundColor + ';' +
        '--preview-bg-secondary:' + backgroundSecondary + ';' +
        '--preview-neutral:' + neutralColor + ';' +
        '--preview-base:' + baseColor + ';' +
        '--preview-muted:' + mutedColor + ';';

    var html = '<div class="te-nav-preview-wrapper" style="' + styleVars + '">';

    if (linksMode === 'dashboard' || linksMode === 'account') {
        var dashboardCustomLinks = Array.isArray(layout.dashboard_custom_links) ? layout.dashboard_custom_links : [];
        var accountCustomLinks = Array.isArray(layout.account_custom_links) ? layout.account_custom_links : [];

        if (linksMode === 'account') {
            html += '<div class="te-nav-preview te-nav-preview-default">';
            html += '<div class="te-nav-preview-sidebar">';
            html += '<div class="te-nav-preview-account-nav">';

            accountCustomLinks.forEach(function (link, index) {
                var activeClass = index === 0 ? ' active' : '';
                html += '<div class="te-nav-preview-account-link' + activeClass + '">';
                html += '<i class="fa fa-' + esc(link.icon || 'link') + '"></i>';
                html += '<span>' + esc(link.label || 'Link') + '</span>';
                html += '</div>';
            });

            html += '</div>';
            html += '</div>';
            html += '</div>';
        } else {
            html += '<div class="te-nav-preview te-nav-preview-default">';
            html += '<div class="te-nav-preview-sidebar">';
            html += '<div class="te-nav-preview-categories">';

            html += '<div class="te-nav-preview-category">';
            html += '<div class="te-nav-preview-category-title">Navigation</div>';
            html += '<div class="te-nav-preview-links">';
            html += '<div class="te-nav-preview-link active">';
            html += '<i class="fa fa-server"></i>';
            html += '<span>Servers</span>';
            html += '</div>';

            dashboardCustomLinks.forEach(function (link) {
                html += '<div class="te-nav-preview-link">';
                html += '<i class="fa fa-' + esc(link.icon || 'link') + '"></i>';
                html += '<span>' + esc(link.label || 'Link') + '</span>';
                html += '</div>';
            });

            html += '<div class="te-nav-preview-link">';
            html += '<i class="fa fa-user-circle"></i>';
            html += '<span>Account</span>';
            html += '</div>';

            html += '</div>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
        }
    } else {
        var navLinks = layout.nav_links || {};
        var categories = Array.isArray(navLinks.categories) ? navLinks.categories : [];

        var sortedCategories = categories.map(function (cat, i) {
            return { category: cat, originalIndex: i };
        }).sort(function (a, b) {
            var orderA = a.category && (a.category.order === 0 || a.category.order) ? a.category.order : a.originalIndex;
            var orderB = b.category && (b.category.order === 0 || b.category.order) ? b.category.order : b.originalIndex;
            return orderA - orderB;
        });

        var categoriesHtml = '';
        var tabsHtml = '';
        var isFirstLink = true;

        sortedCategories.forEach(function (item) {
            var cat = item.category;
            if (!cat || cat.enabled === false) return;

            var links = Array.isArray(cat.links) ? cat.links : [];
            var sortedLinks = links.map(function (link, i) {
                return { link: link, originalIndex: i };
            }).sort(function (a, b) {
                var orderA = a.link && (a.link.order === 0 || a.link.order) ? a.link.order : a.originalIndex;
                var orderB = b.link && (b.link.order === 0 || b.link.order) ? b.link.order : b.originalIndex;
                return orderA - orderB;
            });

            var visibleLinks = [];
            sortedLinks.forEach(function (linkItem) {
                var link = linkItem.link;
                if (!link || link.enabled === false) return;

                var eggFilter = Array.isArray(link.egg_filter) ? link.egg_filter : [];
                if (linksPreviewEgg && eggFilter.length > 0) {
                    if (eggFilter.indexOf(parseInt(linksPreviewEgg, 10)) === -1) {
                        return;
                    }
                }
                visibleLinks.push(link);
            });

            if (visibleLinks.length === 0) return;

            if (layoutType === 'navbar' || layoutType === 'bottombar') {
                visibleLinks.forEach(function (link) {
                    var activeClass = isFirstLink ? 'active' : '';
                    isFirstLink = false;
                    tabsHtml += '<div class="te-nav-preview-tab ' + activeClass + '">';
                    tabsHtml += '<i class="fa fa-' + esc(link.icon || 'circle') + '"></i>';
                    tabsHtml += '<span>' + esc(link.label || 'Link') + '</span>';
                    tabsHtml += '</div>';
                });
            } else {
                var linksHtml = '';
                visibleLinks.forEach(function (link) {
                    var activeClass = isFirstLink ? 'active' : '';
                    isFirstLink = false;
                    linksHtml += '<div class="te-nav-preview-link ' + activeClass + '">';
                    linksHtml += '<i class="fa fa-' + esc(link.icon || 'circle') + '"></i>';
                    linksHtml += '<span>' + esc(link.label || 'Link') + '</span>';
                    linksHtml += '</div>';
                });

                categoriesHtml += '<div class="te-nav-preview-category">';
                categoriesHtml += '<div class="te-nav-preview-category-title">' + esc(cat.label || 'Category') + '</div>';
                categoriesHtml += '<div class="te-nav-preview-links">' + linksHtml + '</div>';
                categoriesHtml += '</div>';
            }
        });

        if (layoutType === 'navbar') {
            html += '<div class="te-nav-preview te-nav-preview-navbar">';
            html += '<div class="te-nav-preview-topbar">';
            html += '<div class="te-nav-preview-tabs">' + tabsHtml + '</div>';
            html += '</div>';
            html += '</div>';
        } else if (layoutType === 'bottombar') {
            html += '<div class="te-nav-preview te-nav-preview-bottombar">';
            html += '<div class="te-nav-preview-bottomnav">';
            html += '<div class="te-nav-preview-tabs">' + tabsHtml + '</div>';
            html += '</div>';
            html += '</div>';
        } else if (layoutType === 'floating') {
            html += '<div class="te-nav-preview te-nav-preview-floating">';
            html += '<div class="te-nav-preview-sidebar te-nav-preview-sidebar-floating">';
            html += '<div class="te-nav-preview-categories">' + categoriesHtml + '</div>';
            html += '</div>';
            html += '</div>';
        } else {
            html += '<div class="te-nav-preview te-nav-preview-default">';
            html += '<div class="te-nav-preview-sidebar">';
            html += '<div class="te-nav-preview-categories">' + categoriesHtml + '</div>';
            html += '</div>';
            html += '</div>';
        }
    }

    html += '</div>';
    return html;
}

function updateLinksPreview() {
    var container = document.getElementById('linksPreviewContainer');
    if (container) {
        container.innerHTML = renderLinksPreview();
    }
}

function renderNavCategory(cat, catIndex) {
    var label = cat && cat.label ? cat.label : ('Category ' + (catIndex + 1));
    var enabled = cat && cat.enabled !== false;
    var links = cat && Array.isArray(cat.links) ? cat.links : [];
    var linkCount = links.length;

    var linksHtml = '';
    if (links.length) {
        var sortedLinks = links.map(function (link, i) {
            return { link: link, originalIndex: i };
        }).sort(function (a, b) {
            var orderA = a.link && (a.link.order === 0 || a.link.order) ? a.link.order : a.originalIndex;
            var orderB = b.link && (b.link.order === 0 || b.link.order) ? b.link.order : b.originalIndex;
            return orderA - orderB;
        });

        linksHtml = '<div data-sortable-links="' + catIndex + '">';
        sortedLinks.forEach(function (item) {
            linksHtml += renderNavLink(item.link, catIndex, item.originalIndex);
        });
        linksHtml += '</div>';
    }

    var template = getTemplate('te-nav-category');

    return replaceAll(template, {
        'CAT_INDEX': catIndex,
        'LABEL': esc(label),
        'LINK_COUNT': linkCount,
        'ENABLED_CHECKED': enabled ? 'true' : 'false',
        'NAV_LINKS': linksHtml,
        'ICON_PLUS': getIcon('plus')
    });
}

function renderNavLink(item, catIndex, linkIndex) {
    var label = item && item.label ? item.label : '';
    var icon = item && item.icon ? item.icon : '';
    var link = item && item.link ? item.link : '';
    var enabled = item && item.enabled !== false;
    var permission = item && item.permission ? item.permission : '';
    var eggFilter = item && Array.isArray(item.egg_filter) ? item.egg_filter : [];
    var openInNewTab = getOpenInNewTabDefault(item, 'link');

    var isAllMode = eggFilter.length === 0;
    var eggOptions = renderEggOptions(eggFilter, catIndex, linkIndex) || '';
    var permissionLabel = permission ? permission : 'None (visible to all)';

    var template = getTemplate('te-nav-link');

    return replaceAll(template, {
        'CAT_INDEX': String(catIndex),
        'LINK_INDEX': String(linkIndex),
        'LABEL': esc(label),
        'ICON': esc(icon),
        'LINK': esc(link),
        'PERMISSION': esc(permission),
        'PERMISSION_LABEL': esc(permissionLabel),
        'ENABLED_CHECKED': enabled ? 'true' : 'false',
        'OPEN_SAME_TAB_ACTIVE': openInNewTab ? '' : 'active',
        'OPEN_NEW_TAB_ACTIVE': openInNewTab ? 'active' : '',
        'EGG_MODE_ALL': isAllMode ? 'active' : '',
        'EGG_MODE_SOME': isAllMode ? '' : 'active',
        'EGG_LIST_VISIBLE': isAllMode ? '' : 'visible',
        'EGG_OPTIONS': eggOptions,
        'ICON_ARROW_UP': getIcon('arrow-up'),
        'ICON_ARROW_DOWN': getIcon('arrow-down'),
        'ICON_CLOSE': getIcon('close')
    });
}

function renderEggOptions(selectedEggs, catIndex, linkIndex) {
    if (!eggs || !Array.isArray(eggs) || eggs.length === 0) {
        return '<div style="padding: 12px; color: var(--editor-text-muted); font-size: 12px;">No eggs available</div>';
    }

    var html = '';
    for (var i = 0; i < eggs.length; i++) {
        var egg = eggs[i];
        var isSelected = selectedEggs && selectedEggs.indexOf(egg.id) !== -1;
        var optionTemplate = getTemplate('te-egg-filter-option');
        if (optionTemplate) {
            html += replaceAll(optionTemplate, {
                'EGG_ID': String(egg.id),
                'EGG_NAME': esc(egg.name || ''),
                'EGG_NEST': esc(egg.nest_name || ''),
                'CAT_INDEX': String(catIndex),
                'LINK_INDEX': String(linkIndex),
                'EGG_CHECKED': isSelected ? 'true' : 'false'
            });
        }
    }
    return html;
}

function renderSeoTab() {
    var seo = config.seo || {};

    var html = renderTemplate('te-tab-seo', {
        'INDEXING_ENABLED_CHECKED': boolToDataAttr(toBool(seo.indexing_enabled, false)),
        'META_TITLE': esc(seo.meta_title || ''),
        'META_DESCRIPTION': esc(seo.meta_description || ''),
        'META_KEYWORDS': esc(seo.meta_keywords || ''),
        'META_IMAGE': esc(seo.meta_image || ''),
        'FAVICON': esc(seo.favicon || '')
    });

    return processComponents(html);
}

function renderEggsTab() {
    var eggImages = config.eggs || {};
    var items = '';

    eggs.forEach(function (egg) {
        items += renderEggItem(egg, eggImages[egg.id]);
    });

    return renderTemplate('te-tab-eggs', {
        'EGG_ITEMS': items
    });
}

function renderEggItem(egg, img) {
    var hasImg = img && img.length > 0;
    var template = getTemplate('te-egg-item');

    var eggImage = hasImg
        ? replaceAll(getTemplate('te-egg-image-preview'), {
            'VALUE': img,
            'EGG_ID': egg.id,
            'ICON_TRASH': getIcon('trash')
        })
        : replaceAll(getTemplate('te-egg-image-placeholder'), { 'ICON_PHOTO': getIcon('photo') });

    return replaceAll(template, {
        'EGG_ID': egg.id,
        'EGG_NAME': esc(egg.name),
        'EGG_NEST': esc(egg.nest_name),
        'EGG_IMAGE': eggImage
    });
}

function getComponentEggSelectorCount(selectedEggs) {
    return getEggSelectorCount(selectedEggs, 'All eggs');
}

function renderComponentEggSelectorOptions(settingId, selectedEggs) {
    return renderEggSelector(settingId, selectedEggs);
}

function normaliseSftpHostOverrides(overrides) {
    if (!Array.isArray(overrides)) {
        return [];
    }

    return overrides.filter(function (override) {
        return override && typeof override === 'object';
    });
}

function getSftpOverrideForNode(nodeId, overrides) {
    var nodeIdString = String(nodeId);
    var normalisedOverrides = normaliseSftpHostOverrides(overrides);

    for (var i = 0; i < normalisedOverrides.length; i++) {
        if (String(normalisedOverrides[i].node_id) === nodeIdString) {
            return normalisedOverrides[i];
        }
    }

    return { node_id: nodeId, enabled: false, host: '' };
}

function upsertSftpHostOverride(nodeId, updates) {
    var overrides = normaliseSftpHostOverrides(getConfigValue('advanced.sftp_host_overrides', []));
    var nodeIdString = String(nodeId);
    var existingIndex = -1;

    for (var i = 0; i < overrides.length; i++) {
        if (String(overrides[i].node_id) === nodeIdString) {
            existingIndex = i;
            break;
        }
    }

    var override = existingIndex >= 0
        ? Object.assign({}, overrides[existingIndex])
        : { node_id: nodeId, enabled: false, host: '' };

    if (updates.enabled !== undefined) {
        override.enabled = updates.enabled;
    }

    if (updates.host !== undefined) {
        override.host = updates.host;
    }

    if (existingIndex >= 0) {
        overrides[existingIndex] = override;
    } else {
        overrides.push(override);
    }

    setConfig('advanced.sftp_host_overrides', overrides);
}

function renderSftpHostOverridesHtml() {
    if (!nodes || nodes.length === 0) {
        return '<div class="te-alert te-alert-info"><i class="fa fa-info-circle"></i><span>No nodes available. Create nodes in the admin panel first.</span></div>';
    }

    var overrides = getConfigValue('advanced.sftp_host_overrides', []);
    var items = nodes.map(function (node) {
        var override = getSftpOverrideForNode(node.id, overrides);
        var enabled = toBool(override.enabled, false);
        var host = override.host || '';

        return '<div class="te-sftp-override-item" data-sftp-override-node-id="' + node.id + '">' +
            '<div class="te-sftp-override-header">' +
            '<div class="te-sftp-override-node-info">' +
            '<div class="te-sftp-override-node-name"><i class="fa fa-server"></i>' + esc(node.name) + '</div>' +
            '<div class="te-sftp-override-node-fqdn">' + esc(node.fqdn || '') + '</div>' +
            '</div>' +
            '<label class="te-toggle">' +
            '<input type="checkbox" data-sftp-override-enabled data-node-id="' + node.id + '"' + (enabled ? ' checked' : '') + '>' +
            '<span class="te-toggle-slider"></span>' +
            '</label>' +
            '</div>' +
            '<div class="te-sftp-override-input-wrapper" data-sftp-override-input-wrapper data-node-id="' + node.id + '"' + (enabled ? '' : ' hidden') + '>' +
            '<input type="text" class="te-input" data-sftp-override-host data-node-id="' + node.id + '" placeholder="Override host (e.g. sftp.example.com)" value="' + esc(host) + '">' +
            '</div>' +
            '</div>';
    });

    return '<div class="te-sftp-overrides-list">' + items.join('') + '</div>';
}

function renderAdvancedTab() {
    var components = config.components || {};
    var advanced = config.advanced || {};
    var translationsEnabled = toBool(components.translations_enabled, true);
    var defaultLanguage = components.default_language || 'en';
    var enabledLanguages = components.enabled_languages || null;
    var hideDashboardHeader = toBool(components.hide_dashboard_header, false);
    var registrationEnabled = toBool(components.registration_enabled, true);
    var allowStartupCommandEdit = toBool(components.allow_startup_command_edit, true);
    var allowStartupCommandEditEggs = Array.isArray(components.allow_startup_command_edit_eggs)
        ? components.allow_startup_command_edit_eggs
        : [];
    var allowStartupVariablesEdit = toBool(components.allow_startup_variables_edit, true);
    var allowStartupVariablesEditEggs = Array.isArray(components.allow_startup_variables_edit_eggs)
        ? components.allow_startup_variables_edit_eggs 
        : [];
    var allowDockerImageEdit = toBool(components.allow_docker_image_edit, true);
    var trashEnabled = toBool(components.trash_enabled, true);
    var trashAutoDeleteHours = Number(components.trash_auto_delete_hours);
    if (!isFinite(trashAutoDeleteHours) || trashAutoDeleteHours < 1) {
        trashAutoDeleteHours = 168;
    }
    trashAutoDeleteHours = Math.floor(trashAutoDeleteHours);
    var searchIgnoredFolders = components.search_ignored_folders || '';
    var searchMode = components.search_mode === 'current_directory' ? 'current_directory' : 'global';
    var searchModeOptions = buildOptions([
        { value: 'global', label: 'Global — search all server files' },
        { value: 'current_directory', label: 'Current folder — search only the open directory' }
    ], searchMode);
    var consoleCommandPrelude = advanced.console_command_prelude || 'container@pterodactyl~ ';
    var consolePreludeColor = advanced.console_prelude_color || 'hsl(60, 100%, 70%)';
    var consolePreludeColorHex = hslToHex(consolePreludeColor);
    var backupIgnoredPaths = advanced.backup_ignored_paths || '';
    var fileEditorType = advanced.file_editor_type === 'monaco' ? 'monaco' : 'default';
    var fileEditorTypeOptions = buildOptions([
        { value: 'default', label: 'Default (CodeMirror)' },
        { value: 'monaco', label: 'Monaco Editor' }
    ], fileEditorType);
    var maxServerFolders = advanced.max_server_folders || 10;
    var maxAvatarUploadFileSize = advanced.max_avatar_upload_file_size || 4;
    var keybindsEnabled = toBool(advanced.keybinds_enabled, false);
    var captcha = advanced.captcha || {};
    var captchaProviders = captcha.providers || {};
    var captchaProvider = captcha.provider || 'none';
    if (captchaProvider === 'none' && toBool(advanced.turnstile_enabled, false)) {
        captchaProvider = 'cloudflare_turnstile';
    }
    var validCaptchaProviders = ['none', 'cloudflare_turnstile', 'google_recaptcha', 'hcaptcha'];
    if (validCaptchaProviders.indexOf(captchaProvider) === -1) {
        captchaProvider = 'none';
    }
    var cloudflareCaptcha = captchaProviders.cloudflare_turnstile || {};
    var googleCaptcha = captchaProviders.google_recaptcha || {};
    var hcaptcha = captchaProviders.hcaptcha || {};
    
    var billingIntegration = advanced.billing_integration || {};
    var billingEnabled = toBool(billingIntegration.enabled, false);
    var billingPlatform = billingIntegration.platform === 'paymenter' ? 'paymenter' : 'whmcs';

    if (enabledLanguages === null) {
        enabledLanguages = Object.keys(languages);
    }

    var defaultLanguageOptions = '';
    var languageCheckboxes = '';

    for (var code in languages) {
        if (languages.hasOwnProperty(code)) {
            var isEnabled = enabledLanguages.indexOf(code) !== -1;

            defaultLanguageOptions += '<option value="' + code + '"' + (defaultLanguage === code ? ' selected' : '') + '>' + languages[code] + '</option>';

            languageCheckboxes += '<label class="te-language-item' + (isEnabled ? ' enabled' : '') + '">';
            languageCheckboxes += '<input type="checkbox" data-language-code="' + code + '"' + (isEnabled ? ' checked' : '') + '>';
            languageCheckboxes += '<span class="te-language-code">' + code.toUpperCase() + '</span>';
            languageCheckboxes += '<span class="te-language-name">' + languages[code] + '</span>';
            languageCheckboxes += '</label>';
        }
    }

    var template = getTemplate('te-tab-advanced');

    return replaceAll(template, {
        'CONSOLE_COMMAND_PRELUDE': esc(consoleCommandPrelude),
        'CONSOLE_PRELUDE_COLOR': esc(consolePreludeColor),
        'CONSOLE_PRELUDE_COLOR_HEX': esc(consolePreludeColorHex),
        'BACKUP_IGNORED_PATHS': esc(backupIgnoredPaths),
        'FILE_EDITOR_TYPE_OPTIONS': fileEditorTypeOptions,
        'MAX_SERVER_FOLDERS': esc(maxServerFolders),
        'MAX_AVATAR_UPLOAD_FILE_SIZE': esc(maxAvatarUploadFileSize),
        'REGISTRATION_ENABLED_CHECKED': boolToDataAttr(registrationEnabled),
        'HIDE_DASHBOARD_HEADER_CHECKED': boolToDataAttr(hideDashboardHeader),
        'ALLOW_STARTUP_COMMAND_EDIT_CHECKED': boolToDataAttr(allowStartupCommandEdit),
        'ALLOW_STARTUP_COMMAND_EDIT_EGGS_OPTIONS': renderComponentEggSelectorOptions('allow_startup_command_edit_eggs', allowStartupCommandEditEggs),
        'ALLOW_STARTUP_COMMAND_EDIT_EGGS_COUNT': getComponentEggSelectorCount(allowStartupCommandEditEggs),
        'ALLOW_STARTUP_VARIABLES_EDIT_CHECKED': boolToDataAttr(allowStartupVariablesEdit),
        'ALLOW_STARTUP_VARIABLES_EDIT_EGGS_OPTIONS': renderComponentEggSelectorOptions('allow_startup_variables_edit_eggs', allowStartupVariablesEditEggs),
        'ALLOW_STARTUP_VARIABLES_EDIT_EGGS_COUNT': getComponentEggSelectorCount(allowStartupVariablesEditEggs),
        'ALLOW_DOCKER_IMAGE_EDIT_CHECKED': boolToDataAttr(allowDockerImageEdit),
        'TRASH_ENABLED_CHECKED': boolToDataAttr(trashEnabled),
        'TRASH_AUTO_DELETE_HOURS': esc(trashAutoDeleteHours),
        'SEARCH_IGNORED_FOLDERS': esc(searchIgnoredFolders),
        'SEARCH_MODE_OPTIONS': searchModeOptions,
        'TRANSLATIONS_ENABLED_CHECKED': boolToDataAttr(translationsEnabled),
        'DEFAULT_LANGUAGE_OPTIONS': defaultLanguageOptions,
        'LANGUAGE_CHECKBOXES': languageCheckboxes,
        'KEYBINDS_ENABLED_CHECKED': boolToDataAttr(keybindsEnabled),
        'BILLING_INTEGRATION_ENABLED_CHECKED': boolToDataAttr(billingEnabled),
        'BILLING_PLATFORM_OPTIONS': buildOptions([
            { value: 'whmcs', label: 'WHMCS' },
            { value: 'paymenter', label: 'Paymenter' }
        ], billingPlatform),
        'BILLING_URL': esc(billingIntegration.billing_url || ''),
        'BILLING_API_KEY': '',
        'BILLING_API_IDENTIFIER': '',
        'BILLING_API_SECRET': '',
        'CAPTCHA_PROVIDER_OPTIONS': buildOptions([
            { value: 'none', label: 'Disabled' },
            { value: 'cloudflare_turnstile', label: 'Cloudflare Turnstile' },
            { value: 'google_recaptcha', label: 'Google reCAPTCHA' },
            { value: 'hcaptcha', label: 'hCaptcha' }
        ], captchaProvider),
        'CAPTCHA_CLOUDFLARE_SITE_KEY': esc(cloudflareCaptcha.site_key || advanced.turnstile_site_key || ''),
        'CAPTCHA_CLOUDFLARE_SECRET_KEY': '',
        'CAPTCHA_GOOGLE_SITE_KEY': esc(googleCaptcha.site_key || ''),
        'CAPTCHA_GOOGLE_SECRET_KEY': '',
        'CAPTCHA_HCAPTCHA_SITE_KEY': esc(hcaptcha.site_key || ''),
        'CAPTCHA_HCAPTCHA_SECRET_KEY': '',
        'SFTP_HOST_OVERRIDES': renderSftpHostOverridesHtml()
    });
}

function toggleLanguage(code, enabled) {
    var components = config.components || {};
    var enabledLanguages = components.enabled_languages || Object.keys(languages);

    if (enabled && enabledLanguages.indexOf(code) === -1) {
        enabledLanguages.push(code);
    } else if (!enabled && enabledLanguages.indexOf(code) !== -1) {
        if (enabledLanguages.length <= 1) {
            toast('At least one language must be enabled', 'error');
            var checkbox = document.querySelector('input[data-language-code="' + code + '"]');
            if (checkbox) {
                checkbox.checked = true;
                var item = checkbox.closest('.te-language-item');
                if (item) item.classList.add('enabled');
            }
            return;
        }
        enabledLanguages = enabledLanguages.filter(function (c) { return c !== code; });
    }

    setConfig('components.enabled_languages', enabledLanguages);
}

function renderAddonsTab() {
    var addonSettings = config.addons || {};
    var template = getTemplate('te-tab-addons');
    var installedHtml = '';
    var availableHtml = '';

    var installedAddons = addons.filter(function (a) { return a.installed; });
    var availableAddons = addons.filter(function (a) { return !a.installed; });

    installedAddons.forEach(function (addon) {
        var itemTemplate = getTemplate('te-addon-item-installed');
        var addonConfig = addonSettings[addon.id] || {};
        var isEnabled = typeof addonConfig === 'object' ? toBool(addonConfig.enabled, true) : toBool(addonConfig, true);
        var toggleHtml = '';
        var statusClass = '';
        var statusText = '';
        var optionsHtml = '';
        var purchaseLinkHtml = '';

        if (isEnabled) {
            toggleHtml = replaceAll(getTemplate('te-addon-toggle-enabled'), { 'ADDON_ID': addon.id });
            statusClass = 'te-addon-status-enabled';
            statusText = 'Enabled';
        } else {
            toggleHtml = replaceAll(getTemplate('te-addon-toggle-disabled'), { 'ADDON_ID': addon.id });
            statusClass = 'te-addon-status-disabled';
            statusText = 'Disabled';
        }

        if (addon.hasSettings) {
            optionsHtml = replaceAll(getTemplate('te-addon-options-button'), { 'ADDON_ID': addon.id });
        }

        if (addon.purchaseUrl) {
            purchaseLinkHtml = replaceAll(getTemplate('te-addon-purchase-link'), {
                'ADDON_PURCHASE_URL': esc(addon.purchaseUrl)
            });
        }

        installedHtml += replaceAll(itemTemplate, {
            'ADDON_ID': addon.id,
            'ADDON_NAME': esc(addon.name),
            'ADDON_DESCRIPTION': esc(addon.description),
            'ADDON_AUTHOR': esc(addon.author),
            'STATUS_CLASS': statusClass,
            'STATUS_TEXT': statusText,
            'ADDON_OPTIONS': optionsHtml,
            'ADDON_PURCHASE_LINK': purchaseLinkHtml,
            'ADDON_TOGGLE': toggleHtml
        });
    });

    availableAddons.forEach(function (addon) {
        var itemTemplate = getTemplate('te-addon-item-available');
        availableHtml += replaceAll(itemTemplate, {
            'ADDON_ID': addon.id,
            'ADDON_NAME': esc(addon.name),
            'ADDON_DESCRIPTION': esc(addon.description),
            'ADDON_AUTHOR': esc(addon.author),
            'ADDON_PURCHASE_URL': esc(addon.purchaseUrl || '#')
        });
    });

    if (!installedHtml) {
        installedHtml = replaceAll(getTemplate('te-addons-empty'), { 'EMPTY_MESSAGE': 'No addons installed yet.' });
    }
    if (!availableHtml) {
        availableHtml = replaceAll(getTemplate('te-addons-empty'), { 'EMPTY_MESSAGE': 'All available addons are installed!' });
    }

    return replaceAll(template, {
        'INSTALLED_ADDONS_LIST': installedHtml,
        'AVAILABLE_ADDONS_LIST': availableHtml
    });
}

function toggleAddon(addonId, enabled) {
    setConfig('addons.' + addonId + '.enabled', enabled);
    renderContent();
}

function openAddonSettings(addonId) {
    activeAddonSettings = addonId;
    var url = new URL(window.location);
    url.searchParams.set('addon', addonId);
    history.replaceState({}, '', url);
    if (addonId === 'free_servers') {
        var pending = 0;
        var total = 2;
        var done = function () {
            pending++;
            if (pending >= total) render();
        };
        if (!signupOffersLoaded) {
            loadSignupOffers(done);
        } else {
            done();
        }
        if (!signupOfferClaimsLoaded) {
            loadSignupOfferClaims(done);
        } else {
            done();
        }
        return;
    }
    render();
}

function closeAddonSettings() {
    activeAddonSettings = null;
    var url = new URL(window.location);
    url.searchParams.delete('addon');
    history.replaceState({}, '', url);
    render();
}

function renderAddonSettingsPanel() {
    var addon = addons.find(function (a) { return a.id === activeAddonSettings; });
    if (!addon) return '';

    var template = getTemplate('te-addon-settings-panel');
    var fieldsHtml = renderAddonSettingsFields(addon);

    return replaceAll(template, {
        'ADDON_NAME': esc(addon.name),
        'CONFIG_ACTIONS_MENU': renderConfigActionsMenu(),
        'SETTINGS_FIELDS': fieldsHtml
    });
}

function renderAddonSettingsFields(addon) {
    if (!addon.settings || !addon.settings.length) return '<p class="te-help-text">No settings available for this addon.</p>';

    var html = '';
    var addonSettings = config.addons && config.addons[addon.id] && config.addons[addon.id].settings ? config.addons[addon.id].settings : {};

    addon.settings.forEach(function (setting) {
        var template;
        var value = addonSettings[setting.id] !== undefined ? addonSettings[setting.id] : setting.default;

        switch (setting.type) {
            case 'offer_config':
                template = getTemplate('te-addon-setting-offer-config');
                var offerItemsHtml = '';
                var offerItemTemplate = getTemplate('te-offer-config-item');
                signupOffers.forEach(function (offer) {
                    var metaParts = [];
                    metaParts.push(offer.egg_name || 'Unknown Egg');
                    metaParts.push(offer.memory + ' MB RAM');
                    metaParts.push(offer.disk + ' MB Disk');
                    if (offer.claims_count > 0) metaParts.push(offer.claims_count + ' claim(s)');
                    if (!offer.enabled) metaParts.push('Disabled');
                    offerItemsHtml += replaceAll(offerItemTemplate, {
                        'OFFER_ID': offer.id,
                        'OFFER_NAME': esc(offer.name),
                        'OFFER_META': esc(metaParts.join(' | '))
                    });
                });
                html += replaceAll(template, {
                    'ADDON_ID': addon.id,
                    'SETTING_ID': setting.id,
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'OFFER_ITEMS': offerItemsHtml
                });
                break;

            case 'claims_list':
                template = getTemplate('te-addon-setting-claims-list');
                var claimsRowsHtml = '';
                if (signupOfferClaims.length > 0) {
                    var rowTemplate = getTemplate('te-claims-row');
                    signupOfferClaims.forEach(function (cl) {
                        var statusLabels = { pending: 'Pending', claimed: 'Active', expired: 'Expired', server_expired: 'Suspended' };
                        claimsRowsHtml += replaceAll(rowTemplate, {
                            'SEARCH_TEXT': esc((cl.username + ' ' + cl.email + ' ' + cl.offer_name + ' ' + cl.status).toLowerCase()),
                            'USERNAME': esc(cl.username),
                            'EMAIL': esc(cl.email),
                            'OFFER_NAME': esc(cl.offer_name),
                            'STATUS': cl.status,
                            'STATUS_LABEL': statusLabels[cl.status] || cl.status,
                            'SERVER_NAME': cl.server_name ? esc(cl.server_name) : '—',
                            'CLAIM_EXPIRY': cl.claim_countdown || (cl.claim_expires_at ? esc(cl.claim_expires_at) : '—'),
                            'SERVER_EXPIRY': cl.server_countdown || (cl.server_expires_at ? esc(cl.server_expires_at) : '—'),
                            'CREATED_AT': cl.created_at ? esc(cl.created_at.substring(0, 10)) : '—'
                        });
                    });
                }
                html += replaceAll(template, {
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'CLAIMS_COUNT': signupOfferClaims.length + ' total',
                    'CLAIMS_ROWS': claimsRowsHtml || '<div style="text-align:center;color:var(--editor-text-muted);padding:24px;font-size:12px;">No claims yet</div>',
                    'CLAIMS_EXPANDED_CLASS': signupOfferClaimsExpanded ? 'te-claims-chevron-open' : '',
                    'CLAIMS_HIDDEN_CLASS': signupOfferClaimsExpanded ? '' : 'te-claims-panel-hidden'
                });
                break;

            case 'text':
                template = getTemplate('te-addon-setting-text');
                html += replaceAll(template, {
                    'ADDON_ID': addon.id,
                    'SETTING_ID': setting.id,
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'SETTING_VALUE': esc(value || ''),
                    'SETTING_PLACEHOLDER': esc(setting.placeholder || '')
                });
                break;

            case 'password':
                template = getTemplate('te-addon-setting-password');
                html += replaceAll(template, {
                    'ADDON_ID': addon.id,
                    'SETTING_ID': setting.id,
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'SETTING_VALUE': esc(value || ''),
                    'SETTING_PLACEHOLDER': esc(setting.placeholder || '')
                });
                break;

            case 'number':
                template = getTemplate('te-addon-setting-number');
                html += replaceAll(template, {
                    'ADDON_ID': addon.id,
                    'SETTING_ID': setting.id,
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'SETTING_VALUE': esc(value || '')
                });
                break;

            case 'textarea':
                template = getTemplate('te-addon-setting-textarea');
                html += replaceAll(template, {
                    'ADDON_ID': addon.id,
                    'SETTING_ID': setting.id,
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'SETTING_VALUE': esc(value || '')
                });
                break;

            case 'toggle':
                template = getTemplate('te-addon-setting-toggle');
                html += replaceAll(template, {
                    'ADDON_ID': addon.id,
                    'SETTING_ID': setting.id,
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'SETTING_VALUE': toBool(value, false) ? 'true' : 'false'
                });
                break;

            case 'select':
                template = getTemplate('te-addon-setting-select');
                var optionsHtml = '';
                if (setting.options) {
                    setting.options.forEach(function (opt) {
                        var selected = String(value) === String(opt.value) ? ' selected' : '';
                        optionsHtml += '<option value="' + esc(opt.value) + '"' + selected + '>' + esc(opt.label) + '</option>';
                    });
                }
                html += replaceAll(template, {
                    'ADDON_ID': addon.id,
                    'SETTING_ID': setting.id,
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'SELECT_OPTIONS': optionsHtml
                });
                break;

            case 'platform_toggles':
                template = getTemplate('te-addon-setting-platform-toggles');
                var platformTogglesHtml = '';
                var platformItemTemplate = getTemplate('te-addon-platform-toggle-item');
                var platformSettings = addonSettings.platforms || {};

                if (setting.platforms) {
                    setting.platforms.forEach(function (platform) {
                        var platformEnabled = platformSettings[platform.id] !== undefined ? platformSettings[platform.id] : true;
                        platformTogglesHtml += replaceAll(platformItemTemplate, {
                            'ADDON_ID': addon.id,
                            'PLATFORM_ID': platform.id,
                            'PLATFORM_LABEL': esc(platform.label),
                            'PLATFORM_CHECKED': toBool(platformEnabled, true) ? 'true' : 'false',
                            'PLATFORM_DISABLED': platform.disabled ? 'te-platform-disabled' : '',
                            'PLATFORM_DISABLED_ATTR': platform.disabled ? 'disabled' : ''
                        });
                    });
                }

                html += replaceAll(template, {
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'PLATFORM_TOGGLES': platformTogglesHtml
                });
                break;

            case 'egg_selector':
                template = getTemplate('te-addon-setting-egg-selector');
                var eggOptionsHtml = '';
                var selectedEggs = Array.isArray(value) ? value : [];

                if (eggs && eggs.length > 0) {
                    eggs.forEach(function (egg) {
                        var isSelected = selectedEggs.indexOf(egg.id) !== -1;
                        eggOptionsHtml += '<label class="te-egg-selector-item' + (isSelected ? ' selected' : '') + '">';
                        eggOptionsHtml += '<input type="checkbox" data-addon-egg-select="' + addon.id + '" data-setting-id="' + setting.id + '" data-egg-id="' + egg.id + '"' + (isSelected ? ' checked' : '') + '>';
                        eggOptionsHtml += '<span class="te-egg-selector-name">' + esc(egg.name) + '</span>';
                        eggOptionsHtml += '<span class="te-egg-selector-nest">' + esc(egg.nest_name) + '</span>';
                        eggOptionsHtml += '</label>';
                    });
                } else {
                    eggOptionsHtml = '<div class="te-egg-selector-empty">No eggs available</div>';
                }

                html += replaceAll(template, {
                    'ADDON_ID': addon.id,
                    'SETTING_ID': setting.id,
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'EGG_OPTIONS': eggOptionsHtml,
                    'SELECTED_COUNT': selectedEggs.length
                });
                break;

            case 'action':
                template = getTemplate('te-addon-setting-action');
                html += replaceAll(template, {
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'ACTION_ID': esc(setting.action || setting.id),
                    'BUTTON_LABEL': esc(setting.button_label || setting.label),
                    'BUTTON_STYLE': esc(setting.button_style || 'secondary'),
                    'BUTTON_ICON': esc(setting.button_icon || 'bolt'),
                    'CONFIRM_TEXT': esc(setting.confirm || '')
                });
                break;

            case 'domain_list':
                template = getTemplate('te-addon-setting-domain-list');
                var domainItemsHtml = '';
                var domains = Array.isArray(value) ? value : [];
                var domainItemTemplate = getTemplate('te-addon-domain-list-item');

                domains.forEach(function (domain) {
                    domainItemsHtml += replaceAll(domainItemTemplate, {
                        'ADDON_ID': addon.id,
                        'SETTING_ID': setting.id,
                        'DOMAIN': esc(domain)
                    });
                });

                html += replaceAll(template, {
                    'ADDON_ID': addon.id,
                    'SETTING_ID': setting.id,
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'DOMAIN_ITEMS': domainItemsHtml
                });
                break;

            case 'domain_config':
                template = getTemplate('te-addon-setting-domain-config');
                var domainConfigItemsHtml = '';
                var domainConfigs = normaliseDomainConfigs(value);
                var domainConfigItemTemplate = getTemplate('te-addon-domain-config-item');

                domainConfigs.forEach(function (domainConfig, index) {
                    var isDefaultDomain = index === 0;
                    var isLastDomain = index === domainConfigs.length - 1;
                    var metaParts = [];
                    var routingMode = domainConfig.routing_mode === 'web' ? 'web' : 'game';
                    var srvEnabled = toBool(domainConfig.srv_enabled, true);
                    var aRecordEnabled = toBool(domainConfig.a_record_enabled, false);
                    var srvServiceMode = getDomainSrvServiceMode(domainConfig);
                    var srvServiceDefault = domainConfig.srv_service_default || domainConfig.srv_service || '_minecraft';
                    var srvServiceByEgg = (typeof domainConfig.srv_service_by_egg === 'object' && domainConfig.srv_service_by_egg !== null && !Array.isArray(domainConfig.srv_service_by_egg))
                        ? domainConfig.srv_service_by_egg
                        : {};
                    var srvServiceByEggCount = Object.keys(srvServiceByEgg).length;
                    if (domainConfig.zone_id) metaParts.push('Zone: ' + domainConfig.zone_id.substring(0, 8) + '...');
                    if (domainConfig.dns_ip) metaParts.push('IP: ' + domainConfig.dns_ip);
                    metaParts.push(routingMode === 'web' ? 'Mode: Web' : 'Mode: Game');
                    if (routingMode === 'game' && srvEnabled) {
                        if (srvServiceMode === 'per_egg') {
                            metaParts.push('SRV: Per Egg (' + srvServiceByEggCount + ' override' + (srvServiceByEggCount === 1 ? '' : 's') + ')');
                            metaParts.push('Default: ' + srvServiceDefault);
                        } else {
                            metaParts.push('SRV: ' + (domainConfig.srv_service || '_minecraft'));
                        }
                    }
                    if (routingMode === 'game' && aRecordEnabled) metaParts.push('A Record');
                    var metaText = metaParts.length > 0 ? metaParts.join(' | ') : 'Not configured';

                    domainConfigItemsHtml += replaceAll(domainConfigItemTemplate, {
                        'ADDON_ID': addon.id,
                        'SETTING_ID': setting.id,
                        'DOMAIN_INDEX': index,
                        'DOMAIN_NAME': esc(domainConfig.domain || 'Unnamed Domain'),
                        'DOMAIN_DEFAULT_MARKER': isDefaultDomain ? ' <span class="te-domain-default-indicator"><i class="fa fa-star"></i> Default</span>' : '',
                        'DOMAIN_META': esc(metaText),
                        'MOVE_UP_DISABLED': isDefaultDomain ? 'disabled' : '',
                        'MOVE_DOWN_DISABLED': isLastDomain ? 'disabled' : ''
                    });
                });

                html += replaceAll(template, {
                    'ADDON_ID': addon.id,
                    'SETTING_ID': setting.id,
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'DOMAIN_CONFIG_ITEMS': domainConfigItemsHtml
                });
                break;

            case 'egg_config':
                template = getTemplate('te-addon-setting-egg-config');
                var eggConfigMap = (typeof value === 'object' && value !== null && !Array.isArray(value)) ? value : {};
                var availableEggIds = getConfigValue('addons.' + addon.id + '.settings.available_eggs', []);
                var eggConfigItemsHtml = '';
                var eggConfigItemTemplate = getTemplate('te-addon-egg-config-item');

                if (Array.isArray(availableEggIds) && availableEggIds.length > 0) {
                    availableEggIds.forEach(function (eggId) {
                        var egg = eggs.find(function (e) { return e.id === eggId; });
                        if (!egg) return;

                        var eggConf = eggConfigMap[String(eggId)] || {};
                        var allowedTargets = Array.isArray(eggConf.allowed_targets) ? eggConf.allowed_targets : [];
                        var srvService = eggConf.srv_service || '';
                        var srvProtocol = eggConf.srv_protocol || '';
                        var connectionDisplayMode = eggConf.connection_display_mode || 'srv';

                        var metaParts = [];
                        if (allowedTargets.length > 0) {
                            metaParts.push(allowedTargets.length + ' target egg(s)');
                        } else {
                            metaParts.push('All eggs allowed');
                        }
                        if (srvService && srvProtocol) {
                            metaParts.push('SRV: ' + srvService + ' ' + (srvProtocol === '_tcp' ? 'TCP' : 'UDP'));
                        }
                        if (connectionDisplayMode === 'ip_port') {
                            metaParts.push('Display: IP:Port');
                        } else {
                            metaParts.push('Display: Subdomain Only');
                        }
                        var metaText = metaParts.join(' | ');

                        eggConfigItemsHtml += replaceAll(eggConfigItemTemplate, {
                            'ADDON_ID': addon.id,
                            'SETTING_ID': setting.id,
                            'EGG_ID': String(eggId),
                            'EGG_NAME': esc(egg.name) + ' (' + esc(egg.nest_name) + ')',
                            'EGG_META': esc(metaText)
                        });
                    });
                } else {
                    eggConfigItemsHtml = '<div style="padding: 16px; text-align: center; color: var(--editor-text-muted); font-size: 13px;">Select available eggs above first, then configure per-egg restrictions here.</div>';
                }

                html += replaceAll(template, {
                    'ADDON_ID': addon.id,
                    'SETTING_ID': setting.id,
                    'SETTING_LABEL': esc(setting.label),
                    'SETTING_DESCRIPTION': setting.description || '',
                    'EGG_CONFIG_ITEMS': eggConfigItemsHtml
                });
                break;
        }
    });

    return html;
}

function filterAvailableAddons(searchTerm) {
    var container = document.getElementById('availableAddonsList');
    if (!container) return;

    var cards = container.querySelectorAll('.te-addon-card');
    var term = searchTerm.toLowerCase().trim();

    cards.forEach(function (card) {
        var name = card.querySelector('.te-addon-name');
        var desc = card.querySelector('.te-addon-description');
        var nameText = name ? name.textContent.toLowerCase() : '';
        var descText = desc ? desc.textContent.toLowerCase() : '';

        if (!term || nameText.indexOf(term) !== -1 || descText.indexOf(term) !== -1) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

function getNestOptionsHtml(selectedNestId) {
    var selected = String(selectedNestId || '');
    var html = '<option value="">Select target nest...</option>';

    nests.forEach(function (nest) {
        var nestId = String(nest.id);
        var isSelected = selected !== '' && selected === nestId ? ' selected' : '';
        html += '<option value="' + esc(nestId) + '"' + isSelected + '>' + esc(nest.name) + '</option>';
    });

    return html;
}

function renderMassEggCards(filteredEggs) {
    if (!filteredEggs.length) {
        return getTemplate('te-mass-eggs-empty');
    }

    var html = '';
    filteredEggs.forEach(function (egg) {
        var searchText = [
            String(egg.id || ''),
            String(egg.name || ''),
            String(egg.description || ''),
            String(egg.category || '')
        ].join(' ').toLowerCase();
        var description = egg.description ? esc(egg.description) : 'No description provided.';
        html += '<div class="te-mass-eggs-card" data-mass-egg-search-text="' + esc(searchText) + '" data-mass-egg-category="' + esc(String(egg.category || '')) + '">';
        html += '<div class="te-mass-eggs-card-head">';
        html += '<span class="te-mass-eggs-card-title">' + esc(egg.name || egg.id || 'Unnamed egg') + '</span>';
        html += '<span class="te-mass-eggs-card-category">' + esc(egg.category || 'uncategorised') + '</span>';
        html += '</div>';
        html += '<p class="te-mass-eggs-card-desc">' + description + '</p>';
        html += '<div class="te-mass-eggs-card-actions">';
        html += '<button class="te-btn te-btn-primary te-btn-sm" data-mass-egg-install="' + esc(egg.id || '') + '">';
        html += '<i class="fa fa-download"></i> Install';
        html += '</button>';
        html += '</div>';
        html += '</div>';
    });

    return html;
}

function applyMassEggFilters() {
    var container = document.querySelector('.te-mass-eggs-grid');
    if (!container) return;

    var cards = container.querySelectorAll('.te-mass-eggs-card');
    if (!cards.length) return;

    var term = String(massEggSearch || '').toLowerCase().trim();
    var category = String(massEggCategory || '');
    var visibleCount = 0;

    cards.forEach(function (card) {
        var searchText = (card.dataset.massEggSearchText || '').toLowerCase();
        var cardCategory = card.dataset.massEggCategory || '';
        var matchesTerm = !term || searchText.indexOf(term) !== -1;
        var matchesCategory = !category || cardCategory === category;
        var isVisible = matchesTerm && matchesCategory;

        card.style.display = isVisible ? '' : 'none';
        if (isVisible) {
            visibleCount++;
        }
    });

    var countEl = document.querySelector('.te-mass-eggs-section-meta');
    if (countEl) {
        countEl.textContent = visibleCount + ' result(s)';
    }
}

function renderMassEggImporterTab() {
    if (!massEggTargetNest && nests.length) {
        massEggTargetNest = String(nests[0].id);
    }

    if (!massEggsLoaded && !massEggsLoading && !massEggsError) {
        loadMassEggCatalogue();
    }

    if (massEggsLoading && !massEggsLoaded) {
        return getTemplate('te-mass-eggs-loading');
    }

    if (massEggsError && !massEggsLoaded) {
        return replaceAll(getTemplate('te-mass-eggs-error'), { 'ERROR_TEXT': esc(massEggsError) });
    }

    var template = getTemplate('te-tab-import-eggs');
    var statusBanner = massEggsError ? replaceAll(getTemplate('te-mass-eggs-error'), { 'ERROR_TEXT': esc(massEggsError) }) : '';
    var search = massEggSearch.toLowerCase().trim();
    var selectedCategory = String(massEggCategory || '');

    var categoryOptions = '<option value="">All categories</option>';
    massEggCategories.forEach(function (category) {
        var name = String(category.name || '');
        var selected = name === selectedCategory ? ' selected' : '';
        var countSuffix = category.count ? ' (' + category.count + ')' : '';
        categoryOptions += '<option value="' + esc(name) + '"' + selected + '>' + esc(name + countSuffix) + '</option>';
    });

    var filteredEggs = massEggCatalogue.filter(function (egg) {
        var matchesCategory = !selectedCategory || String(egg.category || '') === selectedCategory;
        if (!matchesCategory) return false;
        if (!search) return true;
        var haystack = [
            String(egg.id || ''),
            String(egg.name || ''),
            String(egg.description || ''),
            String(egg.category || ''),
        ].join(' ').toLowerCase();
        return haystack.indexOf(search) !== -1;
    });

    return replaceAll(template, {
        'STATUS_BANNER': statusBanner,
        'SEARCH_VALUE': esc(massEggSearch),
        'CATEGORY_OPTIONS': categoryOptions,
        'NEST_OPTIONS': getNestOptionsHtml(massEggTargetNest),
        'IMPORT_NEST_OPTIONS': getNestOptionsHtml(massEggImportNest),
        'RESULT_COUNT': filteredEggs.length + ' result(s)',
        'EGG_CARDS': renderMassEggCards(filteredEggs)
    });
}

function runAddonAction(actionId, confirmText) {
    if (confirmText && !window.confirm(confirmText)) {
        return;
    }

    if (actionId === 'force_cancel_server_imports') {
        forceCancelAllServerImports();
        return;
    }

    toast('Unknown addon action', 'error');
}

function forceCancelAllServerImports() {
    if (!routes.serverImporterForceCancelAll) {
        toast('Force cancel route is missing', 'error');
        return;
    }

    showLoading(true);

    fetch(routes.serverImporterForceCancelAll, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': csrfToken
        },
        body: JSON.stringify({})
    })
        .then(function (response) { return response.json().then(function (data) { return { ok: response.ok, data: data }; }); })
        .then(function (result) {
            showLoading(false);

            if (!result.ok || !result.data.success) {
                toast(result.data.error || 'Failed to cancel imports', 'error');
                return;
            }

            var count = parseInt(result.data.cancelled, 10) || 0;

            if (count === 0) {
                toast('No active imports to cancel', 'success');
                return;
            }

            toast('Cancelled ' + count + ' import' + (count === 1 ? '' : 's'), 'success');
        })
        .catch(function () {
            showLoading(false);
            toast('Failed to cancel imports', 'error');
        });
}

function loadMassEggCatalogue(onComplete) {
    if (!routes.massEggImporterCatalogue) {
        massEggsError = 'Egg import routes are missing.';
        if (typeof onComplete === 'function') onComplete();
        return;
    }

    massEggsLoading = true;

    fetch(routes.massEggImporterCatalogue, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken }
    })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            massEggsLoading = false;

            if (!Array.isArray(data.categories) || !Array.isArray(data.eggs)) {
                massEggsLoaded = false;
                massEggsError = data.error || 'Invalid catalogue response.';
                if (typeof onComplete === 'function') onComplete();
                refreshPanel();
                return;
            }

            massEggCategories = data.categories;
            massEggCatalogue = data.eggs;
            massEggsLoaded = true;
            massEggsError = '';

            if (typeof onComplete === 'function') onComplete();
            refreshPanel();
        })
        .catch(function () {
            massEggsLoading = false;
            massEggsLoaded = false;
            massEggsError = 'Failed to load egg catalogue.';
            if (typeof onComplete === 'function') onComplete();
            refreshPanel();
        });
}

function installMassEggFromCatalogue(eggId) {
    if (!routes.massEggImporterInstall) {
        toast('Install route is missing', 'error');
        return;
    }

    if (!massEggTargetNest) {
        toast('Select a target nest first', 'error');
        return;
    }

    var egg = massEggCatalogue.find(function (entry) { return String(entry.id) === String(eggId); });
    if (!egg || !egg.downloadUrl) {
        toast('Selected egg cannot be installed', 'error');
        return;
    }

    showLoading(true);

    fetch(routes.massEggImporterInstall, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-CSRF-TOKEN': csrfToken
        },
        body: JSON.stringify({
            nest_id: parseInt(massEggTargetNest, 10),
            egg_id: egg.id,
            download_url: egg.downloadUrl
        })
    })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            showLoading(false);
            if (data.success) {
                toast('Egg installed: ' + (data.egg && data.egg.name ? data.egg.name : egg.name), 'success');
            } else {
                toast(data.error || 'Failed to install egg', 'error');
            }
        })
        .catch(function () {
            showLoading(false);
            toast('Failed to install egg', 'error');
        });
}

function importMassEggFiles() {
    if (!routes.massEggImporterImport) {
        toast('Import route is missing', 'error');
        return;
    }

    var modal = document.querySelector('.te-modal-overlay[data-modal="mass-eggs-import"]');
    var fileInput = modal ? modal.querySelector('[data-mass-eggs-files]') : null;
    if (!fileInput || !fileInput.files || !fileInput.files.length) {
        toast('Select at least one JSON file', 'error');
        return;
    }

    if (!massEggImportNest) {
        toast('Select a target nest first', 'error');
        return;
    }

    var formData = new FormData();
    formData.append('nest_id', massEggImportNest);

    Array.from(fileInput.files).forEach(function (file) {
        formData.append('import_files[]', file);
    });

    showLoading(true);

    fetch(routes.massEggImporterImport, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'X-CSRF-TOKEN': csrfToken
        },
        body: formData
    })
        .then(function (response) { return response.json(); })
        .then(function (data) {
            showLoading(false);

            var importedCount = Array.isArray(data.imported) ? data.imported.length : 0;
            var failedCount = Array.isArray(data.failed) ? data.failed.length : 0;

            if (importedCount > 0) {
                toast('Imported ' + importedCount + ' egg(s)' + (failedCount > 0 ? ', ' + failedCount + ' failed' : ''), 'success');
                fileInput.value = '';
                closeMassEggImportModal();
                return;
            }

            toast(data.error || 'No eggs were imported', 'error');
        })
        .catch(function () {
            showLoading(false);
            toast('Failed to import egg files', 'error');
        });
}

function openMassEggImportModal() {
    closeMassEggImportModal();

    var template = getTemplate('te-mass-eggs-import-modal');
    var modalHtml = replaceAll(template, {
        'IMPORT_NEST_OPTIONS': getNestOptionsHtml(massEggImportNest)
    });

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    var modal = document.querySelector('.te-modal-overlay[data-modal="mass-eggs-import"]');
    if (!modal) {
        return;
    }

    setTimeout(function () {
        modal.classList.add('visible');
    }, 10);
}

function closeMassEggImportModal() {
    var modal = document.querySelector('.te-modal-overlay[data-modal="mass-eggs-import"]');
    if (!modal) {
        return;
    }

    modal.classList.remove('visible');

    setTimeout(function () {
        if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }, 200);
}

function renderEnvironmentTab() {
    var template = getTemplate('te-tab-environment');

    if (!envLoaded) {
        loadEnvironmentVariables();
        return replaceAll(template, {
            'ENV_VARS_LIST': getTemplate('te-env-loading'),
            'ADD_BUTTON': '',
            'READONLY_WARNING': ''
        });
    }

    var listHtml = renderEnvVarsList();
    var addButton = (envWritable || envIsDemo) ? '<button class="te-btn te-btn-sm te-btn-primary" data-action="add-env-var"><i class="fa fa-plus"></i> Add Variable</button>' : '';
    var readonlyWarning = (!envWritable && !envIsDemo) ? getTemplate('te-env-readonly-warning') : '';

    return replaceAll(template, {
        'ENV_VARS_LIST': listHtml,
        'ADD_BUTTON': addButton,
        'READONLY_WARNING': readonlyWarning
    });
}

function renderEnvVarsList(filter) {
    var keys = Object.keys(envVariables);

    if (keys.length === 0) {
        return getTemplate('te-env-empty');
    }

    var html = '';
    var filterLower = filter ? filter.toLowerCase() : '';

    keys.sort().forEach(function (key) {
        if (filterLower && key.toLowerCase().indexOf(filterLower) === -1) {
            return;
        }

        var varData = envVariables[key];
        var isProtected = varData.protected === true;
        var isSensitive = varData.sensitive === true;

        var editButton = '';
        var deleteButton = '';

        if (!envWritable && !envIsDemo) {
            editButton = '';
            deleteButton = '';
        } else if (!isProtected) {
            editButton = replaceAll(getTemplate('te-env-edit-button'), { 'KEY': esc(key) });
            deleteButton = replaceAll(getTemplate('te-env-delete-button'), { 'KEY': esc(key) });
        } else {
            editButton = getTemplate('te-env-protected-badge');
        }

        html += replaceAll(getTemplate('te-env-var-item'), {
            'KEY': esc(key),
            'VALUE': esc(varData.value || ''),
            'SENSITIVE_CLASS': isSensitive ? 'te-env-sensitive' : '',
            'EDIT_BUTTON': editButton,
            'DELETE_BUTTON': deleteButton
        });
    });

    return html || getTemplate('te-env-empty');
}

function loadEnvironmentVariables() {
    fetch(routes.environment, {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken }
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.success) {
                envVariables = data.variables || {};
                envWritable = data.writable !== false;
                envIsDemo = data.demo === true;
                envLoaded = true;
                refreshPanel();
            } else {
                toast(data.error || 'Failed to load environment variables', 'error');
            }
        })
        .catch(function () {
            toast('Failed to load environment variables', 'error');
        });
}

function showEnvModal(mode, key) {
    if (envIsDemo) {
        toast('Can not edit in demo', 'error');
        return;
    }
    envModalMode = mode;
    envEditingKey = key || null;

    var keyValue = '';
    var valueValue = '';
    var keyDisabled = '';
    var title = 'Add Environment Variable';
    var saveText = 'Add Variable';

    if (mode === 'edit' && key && envVariables[key]) {
        keyValue = key;
        valueValue = envVariables[key].raw || '';
        title = 'Edit Environment Variable';
        saveText = 'Save Changes';

        if (envVariables[key].sensitive) {
            valueValue = '';
        }
    }

    var modalHtml = replaceAll(getTemplate('te-env-modal'), {
        'MODAL_TITLE': title,
        'KEY_VALUE': esc(keyValue),
        'VALUE_VALUE': esc(valueValue),
        'KEY_DISABLED': keyDisabled,
        'SAVE_BUTTON_TEXT': saveText
    });

    var modal = document.getElementById('confirmModal');
    var modalContent = modal.querySelector('.te-modal');
    modalContent.innerHTML = modalHtml;
    modal.classList.add('visible');

    var cancelBtn = modalContent.querySelector('[data-env-modal-cancel]');
    var saveBtn = modalContent.querySelector('[data-env-modal-save]');

    if (cancelBtn) {
        cancelBtn.onclick = function () {
            hideEnvModal();
        };
    }

    if (saveBtn) {
        saveBtn.onclick = function () {
            saveEnvVariable();
        };
    }

    setTimeout(function () {
        var keyInput = document.getElementById('envKeyInput');
        if (keyInput) keyInput.focus();
    }, 100);
}

function hideEnvModal() {
    var modal = document.getElementById('confirmModal');
    modal.classList.remove('visible');

    var modalContent = modal.querySelector('.te-modal');
    modalContent.innerHTML = '<div class="te-modal-header"><span class="te-modal-title" id="confirmModalTitle">Confirm</span></div><div class="te-modal-body"><p id="confirmModalMessage">Are you sure?</p></div><div class="te-modal-footer"><button class="te-btn te-btn-secondary" id="confirmModalCancel">Cancel</button><button class="te-btn te-btn-danger" id="confirmModalConfirm">Confirm</button></div>';

    setupModal();
    envModalMode = 'add';
    envEditingKey = null;
}

function saveEnvVariable() {
    var keyInput = document.getElementById('envKeyInput');
    var valueInput = document.getElementById('envValueInput');

    if (!keyInput || !valueInput) return;

    var key = keyInput.value.trim().toUpperCase();
    var value = valueInput.value;

    if (!key) {
        toast('Variable name is required', 'error');
        return;
    }

    if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
        toast('Invalid variable name. Use uppercase letters, numbers, and underscores only.', 'error');
        return;
    }

    var method = envModalMode === 'edit' ? 'PATCH' : 'POST';
    var body = { key: key, value: value };

    if (envModalMode === 'edit' && envEditingKey) {
        body.original_key = envEditingKey;
    }

    showLoading(true);
    fetch(routes.environment, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken },
        body: JSON.stringify(body)
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            showLoading(false);
            if (data.success) {
                envVariables = data.variables || {};
                hideEnvModal();
                refreshPanel();
                toast(data.message || 'Variable saved', 'success');
            } else {
                toast(data.error || 'Failed to save variable', 'error');
            }
        })
        .catch(function () {
            showLoading(false);
            toast('Failed to save variable', 'error');
        });
}

function deleteEnvVariable(key) {
    if (envIsDemo) {
        toast('Can not edit in demo', 'error');
        return;
    }
    showConfirm('Delete Variable', 'Are you sure you want to delete "' + key + '"? This action cannot be undone.', function () {
        showLoading(true);
        fetch(routes.environment, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken },
            body: JSON.stringify({ key: key })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                showLoading(false);
                if (data.success) {
                    envVariables = data.variables || {};
                    refreshPanel();
                    toast(data.message || 'Variable deleted', 'success');
                } else {
                    toast(data.error || 'Failed to delete variable', 'error');
                }
            })
            .catch(function () {
                showLoading(false);
                toast('Failed to delete variable', 'error');
            });
    });
}

function filterEnvVariables(searchTerm) {
    var list = document.getElementById('envVarsList');
    if (list) {
        list.innerHTML = renderEnvVarsList(searchTerm);
    }
}

function renderEmptyTab() {
    return renderTemplate('te-tab-empty', {
        'ICON_INFO': getIcon('info')
    });
}

function renderPreview() {
    var w = previewWidth || '100%';
    var widthStyle = typeof w === 'number' ? w + 'px' : w;
    var template = getTemplate('te-preview');

    return replaceAll(template, {
        'DESKTOP_ACTIVE': !previewWidth ? 'active' : '',
        'TABLET_ACTIVE': previewWidth === 768 ? 'active' : '',
        'MOBILE_ACTIVE': previewWidth === 375 ? 'active' : '',
        'PREVIEW_WIDTH': widthStyle,
        'VIEWPORT_SIZE': typeof w === 'number' ? w + 'px' : 'Responsive',
        'ICON_DESKTOP': getIcon('desktop'),
        'ICON_TABLET': getIcon('tablet'),
        'ICON_MOBILE': getIcon('mobile'),
        'ICON_REFRESH': getIcon('refresh'),
        'ICON_EXTERNAL_LINK': getIcon('external-link')
    });
}

function renderLogoUpload(path, value) {
    var hasVal = value && value.length > 0;

    if (hasVal) {
        var template = getTemplate('te-logo-upload-with-preview');
        return replaceAll(template, {
            'PATH': path,
            'VALUE': esc(value),
            'ICON_UPLOAD_LOGO': getIcon('upload-logo'),
            'ICON_CLOSE': getIcon('close')
        });
    }

    var template = getTemplate('te-logo-upload-empty');
    return replaceAll(template, {
        'PATH': path,
        'VALUE': esc(value || ''),
        'ICON_UPLOAD': getIcon('upload')
    });
}

function renderFileUpload(path, value) {
    var hasVal = value && value.length > 0;
    var template = getTemplate('te-file-upload');

    var filePreview = '';
    if (hasVal) {
        filePreview = replaceAll(getTemplate('te-file-preview'), {
            'PATH': path,
            'VALUE': value,
            'ICON_CLOSE': getIcon('close')
        });
    }

    return replaceAll(template, {
        'PATH': path,
        'VALUE': esc(value || ''),
        'FILE_PREVIEW': filePreview,
        'ICON_UPLOAD': getIcon('upload')
    });
}

function processComponents(html) {
    var container = document.createElement('div');
    container.innerHTML = html;

    container.querySelectorAll('[data-component="logo-upload"]').forEach(function (el) {
        var path = el.dataset.path;
        var value = el.dataset.value;
        el.outerHTML = renderLogoUpload(path, value);
    });

    container.querySelectorAll('[data-component="file-upload"]').forEach(function (el) {
        var path = el.dataset.path;
        var value = el.dataset.value;
        el.outerHTML = renderFileUpload(path, value);
    });

    return container.innerHTML;
}

function setupEvents() {
    var editor = document.getElementById('themeEditor');

    editor.onclick = function (e) {
        var el = e.target;

        if (configMenuOpen && !el.closest('.te-config-menu')) {
            setConfigMenuState(false);
        }

        var toggleConfigMenuBtn = el.closest('[data-action="toggle-config-menu"]');
        if (toggleConfigMenuBtn) {
            e.preventDefault();
            e.stopPropagation();
            setConfigMenuState(!configMenuOpen);
            return;
        }

        var openImportConfigBtn = el.closest('[data-action="open-import-config"]');
        if (openImportConfigBtn) {
            e.preventDefault();
            var configMenu = openImportConfigBtn.closest('.te-config-menu');
            var configImportInput = configMenu ? configMenu.querySelector('[data-config-import-input]') : null;
            if (configImportInput) {
                configImportInput.click();
            }
            return;
        }

        var consoleColorSwatch = el.closest('.te-console-color-swatch');
        if (consoleColorSwatch) {
            var consoleColorWrap = consoleColorSwatch.closest('.te-console-color-picker-wrap');
            if (consoleColorWrap) {
                var consoleColorInput = consoleColorWrap.querySelector('.te-console-color-hidden');
                if (consoleColorInput) {
                    consoleColorInput.click();
                }
            }
            return;
        }

        var tabBtn = el.closest('.te-tab-btn[data-tab]');
        if (tabBtn) {
            activeTab = tabBtn.dataset.tab;
            activeAddonSettings = null;
            var url = new URL(window.location);
            url.searchParams.set('tab', activeTab);
            url.searchParams.delete('addon');
            history.replaceState({}, '', url);
            render();
            return;
        }

        var addDomainConfigBtn = el.closest('[data-action="add-domain-config"]');
        if (addDomainConfigBtn) {
            var addonId = addDomainConfigBtn.dataset.addonId;
            var settingId = addDomainConfigBtn.dataset.settingId;
            openDomainConfigModal(addonId, settingId, 'new');
            return;
        }

        var editDomainConfigBtn = el.closest('[data-action="edit-domain-config"]');
        if (editDomainConfigBtn) {
            var addonId = editDomainConfigBtn.dataset.addonId;
            var settingId = editDomainConfigBtn.dataset.settingId;
            var domainIndex = editDomainConfigBtn.dataset.domainIndex;
            openDomainConfigModal(addonId, settingId, domainIndex);
            return;
        }

        var removeDomainConfigBtn = el.closest('[data-action="remove-domain-config"]');
        if (removeDomainConfigBtn) {
            var addonId = removeDomainConfigBtn.dataset.addonId;
            var settingId = removeDomainConfigBtn.dataset.settingId;
            var domainIndex = removeDomainConfigBtn.dataset.domainIndex;
            removeDomainConfig(addonId, settingId, parseInt(domainIndex));
            return;
        }

        var moveDomainConfigBtn = el.closest('[data-action="move-domain-config"]');
        if (moveDomainConfigBtn) {
            var addonId = moveDomainConfigBtn.dataset.addonId;
            var settingId = moveDomainConfigBtn.dataset.settingId;
            var domainIndex = moveDomainConfigBtn.dataset.domainIndex;
            var direction = moveDomainConfigBtn.dataset.direction;
            moveDomainConfig(addonId, settingId, parseInt(domainIndex), direction);
            return;
        }

        var saveDomainConfigBtn = el.closest('[data-action="save-domain-config"]');
        if (saveDomainConfigBtn) {
            var addonId = saveDomainConfigBtn.dataset.addonId;
            var settingId = saveDomainConfigBtn.dataset.settingId;
            var domainIndex = saveDomainConfigBtn.dataset.domainIndex;
            saveDomainConfig(addonId, settingId, domainIndex);
            return;
        }

        var editEggConfigBtn = el.closest('[data-action="edit-egg-config"]');
        if (editEggConfigBtn) {
            openEggConfigModal(editEggConfigBtn.dataset.addonId, editEggConfigBtn.dataset.settingId, editEggConfigBtn.dataset.eggId);
            return;
        }

        var resetEggConfigBtn = el.closest('[data-action="reset-egg-config"]');
        if (resetEggConfigBtn) {
            resetEggConfig(resetEggConfigBtn.dataset.addonId, resetEggConfigBtn.dataset.settingId, resetEggConfigBtn.dataset.eggId);
            return;
        }

        var saveEggConfigBtn = el.closest('[data-action="save-egg-config"]');
        if (saveEggConfigBtn) {
            saveEggConfig(saveEggConfigBtn.dataset.addonId, saveEggConfigBtn.dataset.settingId, saveEggConfigBtn.dataset.eggId);
            return;
        }

        var closeEggConfigModalBtn = el.closest('[data-action="close-egg-config-modal"]');
        if (closeEggConfigModalBtn) {
            closeEggConfigModal();
            return;
        }

        var addOfferBtn = el.closest('[data-action="add-offer"]');
        if (addOfferBtn) {
            openOfferModal(null);
            return;
        }

        var editOfferBtn = el.closest('[data-action="edit-offer"]');
        if (editOfferBtn) {
            var offerId = parseInt(editOfferBtn.dataset.offerId);
            var offerData = signupOffers.find(function (o) { return o.id === offerId; });
            if (offerData) openOfferModal(offerData);
            return;
        }

        var removeOfferBtn = el.closest('[data-action="remove-offer"]');
        if (removeOfferBtn) {
            removeOffer(parseInt(removeOfferBtn.dataset.offerId));
            return;
        }

        var saveOfferBtn = el.closest('[data-action="save-offer"]');
        if (saveOfferBtn) {
            saveOffer(saveOfferBtn.dataset.offerId);
            return;
        }

        var closeOfferModalBtn = el.closest('[data-action="close-offer-modal"]');
        if (closeOfferModalBtn) {
            closeOfferModal();
            return;
        }

        var removeUserBtn = el.closest('[data-remove-user]');
        if (removeUserBtn) {
            var userId = parseInt(removeUserBtn.dataset.removeUser);
            var issueModal = removeUserBtn.closest('.te-modal-overlay[data-modal="issue-offer"]');
            if (issueModal) {
                issueModalSelectedUsers = issueModalSelectedUsers.filter(function (u) { return u.id !== userId; });
                renderIssueSelectedUsers();
            } else {
                offerModalSelectedUsers = offerModalSelectedUsers.filter(function (u) { return u.id !== userId; });
                renderSelectedUsers();
            }
            return;
        }

        var issueOfferBtn = el.closest('[data-action="issue-offer"]');
        if (issueOfferBtn) {
            openIssueOfferModal();
            return;
        }

        var toggleClaimsBtn = el.closest('[data-action="toggle-claims"]');
        if (toggleClaimsBtn) {
            toggleClaimsList();
            return;
        }

        var closeIssueModalBtn = el.closest('[data-action="close-issue-modal"]');
        if (closeIssueModalBtn) {
            closeIssueOfferModal();
            return;
        }

        var submitIssueBtn = el.closest('[data-action="submit-issue-offer"]');
        if (submitIssueBtn) {
            submitIssueOffer();
            return;
        }

        var closeModalBtn = el.closest('[data-action="close-modal"]');
        if (closeModalBtn) {
            closeDomainConfigModal();
            return;
        }

        var createAnnouncementBtn = el.closest('#te-create-announcement-btn');
        if (createAnnouncementBtn) {
            openAnnouncementModal(null);
            return;
        }

        var editAnnouncementBtn = el.closest('[data-action="edit-announcement"]');
        if (editAnnouncementBtn) {
            var announcementId = parseInt(editAnnouncementBtn.dataset.announcementId);
            var announcementData = announcementsData.find(function (a) { return a.id === announcementId; });
            if (announcementData) {
                openAnnouncementModal(announcementData);
            }
            return;
        }

        var deleteAnnouncementBtn = el.closest('[data-action="delete-announcement"]');
        if (deleteAnnouncementBtn) {
            var announcementId = parseInt(deleteAnnouncementBtn.dataset.announcementId);
            deleteAnnouncement(announcementId);
            return;
        }

        var addOAuthProviderBtn = el.closest('[data-action="add-oauth-provider"]');
        if (addOAuthProviderBtn) {
            openOAuthProviderModal(null);
            return;
        }

        var editOAuthProviderBtn = el.closest('[data-action="edit-oauth-provider"]');
        if (editOAuthProviderBtn) {
            var oauthProviderId = parseInt(editOAuthProviderBtn.dataset.providerId, 10);
            var oauthProviderData = oauthProvidersData.find(function (item) { return item.id === oauthProviderId; });
            if (oauthProviderData) {
                openOAuthProviderModal(oauthProviderData);
            }
            return;
        }

        var deleteOAuthProviderBtn = el.closest('[data-action="delete-oauth-provider"]');
        if (deleteOAuthProviderBtn) {
            deleteOAuthProvider(parseInt(deleteOAuthProviderBtn.dataset.providerId, 10));
            return;
        }

        var moveOAuthProviderUpBtn = el.closest('[data-action="move-oauth-provider-up"]');
        if (moveOAuthProviderUpBtn) {
            moveOAuthProvider(parseInt(moveOAuthProviderUpBtn.dataset.providerId, 10), 'up');
            return;
        }

        var moveOAuthProviderDownBtn = el.closest('[data-action="move-oauth-provider-down"]');
        if (moveOAuthProviderDownBtn) {
            moveOAuthProvider(parseInt(moveOAuthProviderDownBtn.dataset.providerId, 10), 'down');
            return;
        }

        var copyOAuthCallbackBtn = el.closest('[data-action="copy-oauth-callback"]');
        if (copyOAuthCallbackBtn) {
            copyOAuthCallbackUrl(copyOAuthCallbackBtn.dataset.callbackUrl || '');
            return;
        }

        var copyOAuthModalCallbackBtn = el.closest('[data-action="copy-oauth-modal-callback"]');
        if (copyOAuthModalCallbackBtn) {
            var oauthModal = document.getElementById('oauthProviderModal');
            var callbackPreview = oauthModal ? oauthModal.querySelector('[data-oauth-callback-preview]') : null;
            copyOAuthCallbackUrl(callbackPreview ? callbackPreview.value : '');
            return;
        }

        var closeOAuthProviderModalBtn = el.closest('[data-action="close-oauth-provider-modal"]');
        if (closeOAuthProviderModalBtn) {
            closeOAuthProviderModal();
            return;
        }

        var saveOAuthProviderBtn = el.closest('[data-action="save-oauth-provider"]');
        if (saveOAuthProviderBtn) {
            saveOAuthProvider();
            return;
        }

        var addServerTemplateBtn = el.closest('[data-action="add-server-template"]');
        if (addServerTemplateBtn) {
            openServerTemplateModal(null);
            return;
        }

        var editServerTemplateBtn = el.closest('[data-action="edit-server-template"]');
        if (editServerTemplateBtn) {
            var serverTemplateId = parseInt(editServerTemplateBtn.dataset.templateId, 10);
            var serverTemplateData = serverTemplatesData.find(function (item) { return item.id === serverTemplateId; });
            if (serverTemplateData) {
                openServerTemplateModal(serverTemplateData);
            }
            return;
        }

        var deleteServerTemplateBtn = el.closest('[data-action="delete-server-template"]');
        if (deleteServerTemplateBtn) {
            deleteServerTemplate(parseInt(deleteServerTemplateBtn.dataset.templateId, 10));
            return;
        }

        var closeServerTemplateModalBtn = el.closest('[data-action="close-server-template-modal"]');
        if (closeServerTemplateModalBtn) {
            closeServerTemplateModal();
            return;
        }

        var saveServerTemplateBtn = el.closest('[data-action="save-server-template"]');
        if (saveServerTemplateBtn) {
            saveServerTemplate();
            return;
        }

        var action = el.closest('[data-action]');
        if (action) {
            handleAction(action.dataset.action);
            return;
        }


        var device = el.closest('[data-device]');
        if (device) {
            setDevice(device.dataset.device);
            return;
        }

        var removeFile = el.closest('[data-remove-file]');
        if (removeFile) {
            setConfig(removeFile.dataset.removeFile, '');
            refreshPanel();
            return;
        }

        var clearImage = el.closest('[data-clear-image]');
        if (clearImage) {
            e.preventDefault();
            e.stopPropagation();
            setConfig(clearImage.dataset.clearImage, '');
            refreshPanel();
            return;
        }

        var repeaterAdd = el.closest('[data-repeater-add]');
        if (repeaterAdd) {
            var path = repeaterAdd.dataset.repeaterAdd;
            if (path === 'layout.dashboard_quick_actions') {
                addRepeaterItem(path, { icon: '', title: '', link: '' });
            }
            refreshPanel();
            return;
        }

        var repeaterRemove = el.closest('[data-repeater-remove]');
        if (repeaterRemove) {
            var path = repeaterRemove.dataset.repeaterRemove;
            var idx = parseInt(repeaterRemove.dataset.index || '0', 10);
            removeRepeaterItem(path, idx);
            refreshPanel();
            return;
        }

        var navAction = el.closest('[data-nav-action]');
        if (navAction) {
            var catIndexToExpand = null;
            var linkIndexToExpand = null;

            if (navAction.dataset.navAction === 'add-link') {
                catIndexToExpand = navAction.dataset.catIndex;
                var catLinks = getConfigValue('layout.nav_links.categories.' + catIndexToExpand + '.links', []);
                linkIndexToExpand = Array.isArray(catLinks) ? catLinks.length : 0;
            }

            if (navAction.dataset.navAction === 'add-category') {
                var existingCats = getConfigValue('layout.nav_links.categories', []);
                catIndexToExpand = Array.isArray(existingCats) ? existingCats.length : 0;
            }

            if (navAction.dataset.navAction === 'move-link') {
                catIndexToExpand = navAction.dataset.catIndex;
            }

            if (navAction.dataset.navAction === 'delete-category') {
                var catIdx = navAction.dataset.catIndex;
                var categoryEl = document.querySelector('.te-nav-category[data-cat-index="' + catIdx + '"]');
                var categoryLabelInput = categoryEl ? categoryEl.querySelector('.te-nav-category-label-input') : null;
                var catLabel = (categoryLabelInput && categoryLabelInput.value.trim()) ? categoryLabelInput.value.trim() : (navAction.dataset.catLabel || 'this category');
                showConfirm(
                    'Delete Category',
                    'Are you sure you want to delete "' + catLabel + '" and all its links? This cannot be undone.',
                    function () {
                        var categories = getConfigValue('layout.nav_links.categories', []);
                        if (Array.isArray(categories) && categories[catIdx]) {
                            categories.splice(catIdx, 1);
                            categories.forEach(function (c, i) { if (c && typeof c === 'object') c.order = i; });
                            setConfig('layout.nav_links.categories', categories);
                            refreshPanel();
                            updateLinksPreview();
                        }
                    }
                );
                return;
            }

            handleNavAction(navAction);
            refreshPanel();
            updateLinksPreview();

            if (catIndexToExpand !== null) {
                var category = document.querySelector('.te-nav-category[data-cat-index="' + catIndexToExpand + '"]');
                if (category) {
                    category.classList.add('expanded');

                    if (linkIndexToExpand !== null) {
                        category.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        var newLink = category.querySelector('.te-nav-link-item[data-link-index="' + linkIndexToExpand + '"]');
                        if (newLink) {
                            newLink.classList.add('expanded');
                            var labelInput = newLink.querySelector('.te-nav-link-label-input');
                            if (labelInput) {
                                labelInput.focus();
                                labelInput.select();
                            }
                        }
                    }
                }
            }
            return;
        }

        var customLinkAction = el.closest('[data-custom-link-action]');
        if (customLinkAction) {
            handleCustomLinkAction(customLinkAction);
            refreshPanel();
            updateLinksPreview();
            return;
        }

        var linksModeBtn = el.closest('[data-links-mode]');
        if (linksModeBtn) {
            linksMode = linksModeBtn.dataset.linksMode;
            refreshPanel();
            updateLinksPreview();
            return;
        }

        var toggleCategory = el.closest('[data-toggle-category]');
        if (toggleCategory) {
            var catIndex = toggleCategory.dataset.toggleCategory;
            var category = toggleCategory.closest('.te-nav-category');
            if (category) {
                category.classList.toggle('expanded');
            }
            return;
        }

        var toggleLink = el.closest('[data-toggle-link]');
        if (toggleLink) {
            var linkId = toggleLink.dataset.toggleLink;
            var linkItem = toggleLink.closest('.te-nav-link-item');
            if (linkItem) {
                linkItem.classList.toggle('expanded');
            }
            return;
        }

        var toggleCustomLink = el.closest('[data-toggle-custom-link]');
        if (toggleCustomLink) {
            var linkIndex = toggleCustomLink.dataset.toggleCustomLink;
            var linkItem = toggleCustomLink.closest('.te-custom-link-item');
            if (linkItem) {
                linkItem.classList.toggle('expanded');
            }
            return;
        }

        var eggAction = el.closest('[data-egg-action]');
        if (eggAction) {
            handleEggFilterAction(eggAction);
            return;
        }

        var openTabAction = el.closest('[data-open-tab-action]');
        if (openTabAction) {
            handleOpenTabAction(openTabAction);
            return;
        }

        var customOpenTabAction = el.closest('[data-custom-open-tab-action]');
        if (customOpenTabAction) {
            handleCustomOpenTabAction(customOpenTabAction);
            return;
        }

        var removeEgg = el.closest('[data-egg-remove]');
        if (removeEgg) {
            if (config.eggs) delete config.eggs[removeEgg.dataset.eggRemove];
            markUnsaved();
            refreshPanel();
            return;
        }

        var eggUploadBtn = el.closest('[data-egg-upload-btn]');
        if (eggUploadBtn) {
            var eggId = eggUploadBtn.dataset.eggUploadBtn;
            var fileInput = document.querySelector('[data-egg-upload="' + eggId + '"]');
            if (fileInput) fileInput.click();
            return;
        }

        var logoReplace = el.closest('[data-logo-replace]');
        if (logoReplace) {
            var path = logoReplace.dataset.logoReplace;
            var wrapper = logoReplace.closest('.te-logo-preview-wrapper');
            var fileInput = wrapper ? wrapper.querySelector('input[type="file"]') : null;
            if (fileInput) fileInput.click();
            return;
        }

        var presetBtn = el.closest('[data-preset]');
        if (presetBtn) {
            applyColorPreset(presetBtn.dataset.preset);
            return;
        }

        var envEdit = el.closest('[data-env-edit]');
        if (envEdit) {
            showEnvModal('edit', envEdit.dataset.envEdit);
            return;
        }

        var envDelete = el.closest('[data-env-delete]');
        if (envDelete) {
            deleteEnvVariable(envDelete.dataset.envDelete);
            return;
        }

        var envModalCancel = el.closest('[data-env-modal-cancel]');
        if (envModalCancel) {
            hideEnvModal();
            return;
        }

        var envModalSave = el.closest('[data-env-modal-save]');
        if (envModalSave) {
            saveEnvVariable();
            return;
        }

        var addonSettingsBtn = el.closest('[data-addon-settings]');
        if (addonSettingsBtn) {
            openAddonSettings(addonSettingsBtn.dataset.addonSettings);
            return;
        }

        var addonActionBtn = el.closest('[data-addon-action]');
        if (addonActionBtn) {
            runAddonAction(addonActionBtn.dataset.addonAction, addonActionBtn.dataset.confirm || '');
            return;
        }

        var massEggRefreshBtn = el.closest('[data-mass-eggs-refresh]');
        if (massEggRefreshBtn) {
            massEggsLoaded = false;
            massEggsLoading = false;
            massEggsError = '';
            massEggCategories = [];
            massEggCatalogue = [];
            refreshPanel();
            return;
        }

        var massEggInstallBtn = el.closest('[data-mass-egg-install]');
        if (massEggInstallBtn) {
            installMassEggFromCatalogue(massEggInstallBtn.dataset.massEggInstall);
            return;
        }

        var massEggOpenImportBtn = el.closest('[data-mass-eggs-open-import]');
        if (massEggOpenImportBtn) {
            openMassEggImportModal();
            return;
        }

        var massEggImportBtn = el.closest('[data-mass-eggs-import-submit]');
        if (massEggImportBtn) {
            importMassEggFiles();
            return;
        }

        var massEggCloseImportBtn = el.closest('[data-mass-eggs-close-import]');
        if (massEggCloseImportBtn) {
            closeMassEggImportModal();
            return;
        }

        var domainAddBtn = el.closest('[data-addon-domain-add]');
        if (domainAddBtn) {
            var addonId = domainAddBtn.dataset.addonDomainAdd;
            var settingId = domainAddBtn.dataset.settingId;
            var input = document.querySelector('[data-addon-domain-input="' + addonId + '"]');
            if (input && input.value.trim()) {
                addDomain(addonId, settingId, input.value.trim());
                input.value = '';
            }
            return;
        }

        var domainRemoveBtn = el.closest('[data-addon-domain-remove]');
        if (domainRemoveBtn) {
            var addonId = domainRemoveBtn.dataset.addonDomainRemove;
            var settingId = domainRemoveBtn.dataset.settingId;
            var domain = domainRemoveBtn.dataset.domain;
            removeDomain(addonId, settingId, domain);
            return;
        }

        var massEggImportOverlay = el.closest('.te-modal-overlay[data-modal="mass-eggs-import"]');
        if (massEggImportOverlay && el === massEggImportOverlay) {
            closeMassEggImportModal();
            return;
        }

        var modalOverlay = el.closest('.te-modal-overlay');
        if (modalOverlay && el === modalOverlay) {
            closeDomainConfigModal();
            return;
        }

        var layoutOption = el.closest('.te-layout-option');
        if (layoutOption) {
            var radio = layoutOption.querySelector('input[type="radio"]');
            if (radio && radio.dataset.path) {
                radio.checked = true;
                setConfig(radio.dataset.path, radio.value);
                var groupName = radio.name;
                if (groupName) {
                    document.querySelectorAll('.te-layout-option input[name="' + groupName + '"]').forEach(function (input) {
                        var label = input.closest('.te-layout-option');
                        if (label) label.classList.remove('active');
                    });
                } else {
                    document.querySelectorAll('.te-layout-option').forEach(function (opt) {
                        opt.classList.remove('active');
                    });
                }
                layoutOption.classList.add('active');

                if (radio.name === 'server_background_type') {
                    var bgSettings = document.querySelector('.te-server-bg-settings');
                    var customFields = document.querySelector('.te-server-bg-custom-fields');
                    if (bgSettings) {
                        if (radio.value === 'image') {
                            bgSettings.classList.add('visible');
                            var sourceRadio = document.querySelector('input[name="server_background_source"]:checked');
                            var source = sourceRadio ? sourceRadio.value : 'custom';
                            if (customFields) customFields.classList.toggle('visible', source === 'custom');
                        } else {
                            bgSettings.classList.remove('visible');
                            if (customFields) customFields.classList.remove('visible');
                        }
                    }
                }
                if (radio.name === 'server_background_source') {
                    var customFields = document.querySelector('.te-server-bg-custom-fields');
                    if (customFields) customFields.classList.toggle('visible', radio.value === 'custom');
                }
            }
            return;
        }

        var componentOption = el.closest('.te-component-option');
        if (componentOption) {
            var radio = componentOption.querySelector('input[type="radio"]');
            if (radio && radio.dataset.path) {
                radio.checked = true;
                setConfig(radio.dataset.path, radio.value);
                var groupName = radio.name;
                if (groupName) {
                    document.querySelectorAll('.te-component-option input[name="' + groupName + '"]').forEach(function (input) {
                        var label = input.closest('.te-component-option');
                        if (label) label.classList.remove('active');
                    });
                }
                componentOption.classList.add('active');

                if (groupName === 'login_page') {
                    var panelSettings = document.querySelector('.te-login-panel-settings');
                    if (panelSettings) {
                        if (radio.value === 'split_left' || radio.value === 'split_card') {
                            panelSettings.classList.add('visible');
                        } else {
                            panelSettings.classList.remove('visible');
                        }
                    }
                }
            }
            return;
        }

        var loginPanelTypeOption = el.closest('.te-login-panel-type-option');
        if (loginPanelTypeOption) {
            var radio = loginPanelTypeOption.querySelector('input[type="radio"]');
            if (radio && radio.dataset.path) {
                radio.checked = true;
                setConfig(radio.dataset.path, radio.value);
                document.querySelectorAll('.te-login-panel-type-option').forEach(function (opt) {
                    opt.classList.remove('active');
                });
                loginPanelTypeOption.classList.add('active');

                var imageFields = document.querySelector('.te-login-panel-image-fields');
                var gradientFields = document.querySelector('.te-login-panel-gradient-fields');
                if (imageFields && gradientFields) {
                    if (radio.value === 'image') {
                        imageFields.classList.add('visible');
                        gradientFields.classList.remove('visible');
                    } else {
                        imageFields.classList.remove('visible');
                        gradientFields.classList.add('visible');
                    }
                }
            }
            return;
        }
    };

    editor.oninput = function (e) {
        var el = e.target;

        if (el.dataset.sftpOverrideHost !== undefined) {
            var sftpHostNodeId = parseInt(el.dataset.nodeId, 10);
            if (!isNaN(sftpHostNodeId)) {
                upsertSftpHostOverride(sftpHostNodeId, { host: el.value });
            }
        }

        if (el.dataset.path) {
            setConfig(el.dataset.path, el.type === 'checkbox' ? el.checked : el.value);
            if (el.dataset.path.indexOf('layout.nav_links') !== -1) {
                updateLinksPreview();
            }
            if (el.dataset.path === 'advanced.billing_integration.platform') {
                updateBillingPlatformFields(el.value);
            }
        }

        if (el.type === 'range') {
            var row = el.closest('.te-slider-row');
            var display = row.querySelector('.te-slider-value');
            var preview = row.querySelector('.te-radius-preview');
            var suffix = el.dataset.suffix || 'px';
            if (display) display.textContent = el.value + suffix;
            if (preview) preview.style.borderRadius = el.value + 'px';
        }

        if (el.dataset.addonSearch !== undefined) {
            filterAvailableAddons(el.value);
        }

        if (el.dataset.massEggSearch !== undefined) {
            massEggSearch = el.value || '';
            applyMassEggFilters();
        }

        if (el.type === 'color' && el.dataset.path) {
            var hsl = hexToHsl(el.value);
            var card = el.closest('.te-color-card');
            var colorWrap = el.closest('.te-color-input-wrap');
            var gradientPicker = el.closest('.te-gradient-picker');
            var consoleColorWrap = el.closest('.te-console-color-picker-wrap');
            if (card) {
                var text = card.querySelector('input[type="text"]');
                if (text) text.value = hsl;
            }
            if (colorWrap) {
                var text = colorWrap.querySelector('.te-color-text');
                if (text) text.value = hsl;
            }
            if (gradientPicker) {
                var text = gradientPicker.querySelector('.te-gradient-input');
                if (text) text.value = hsl;
                updateGradientPreview();
            }
            if (consoleColorWrap) {
                var consoleText = consoleColorWrap.querySelector('input[type="text"]');
                var consoleSwatch = consoleColorWrap.querySelector('.te-console-color-swatch');
                if (consoleText) consoleText.value = hsl;
                if (consoleSwatch) consoleSwatch.style.backgroundColor = el.value;
            }
            setConfig(el.dataset.path, hsl);
        }

        if (el.type === 'text' && el.closest('.te-color-input-wrap') && el.dataset.path) {
            var colorWrap = el.closest('.te-color-input-wrap');
            var colorPicker = colorWrap.querySelector('.te-color-picker');
            if (colorPicker) {
                colorPicker.value = hslToHex(el.value);
            }
        }

        if (el.classList.contains('te-gradient-input') && el.dataset.path) {
            var gradientPicker = el.closest('.te-gradient-picker');
            var colorPicker = gradientPicker ? gradientPicker.querySelector('.te-gradient-color') : null;
            if (colorPicker) {
                colorPicker.value = hslToHex(el.value);
            }
            updateGradientPreview();
        }

        if (el.classList.contains('te-egg-search')) {
            var eggList = el.closest('.te-egg-list') || el.closest('.te-egg-list-compact');
            if (eggList) {
                filterEggOptions(eggList, el.value);
            }
        }

        if (el.classList.contains('te-env-search')) {
            filterEnvVariables(el.value);
        }

        if (el.classList.contains('te-egg-selector-search')) {
            var selector = el.closest('.te-egg-selector');
            if (selector) {
                filterEggSelectorOptions(selector, el.value);
            }
        }
    };

    function updateGradientPreview() {
        var preview = document.querySelector('.te-gradient-preview');
        if (!preview) return;
        var startInput = document.querySelector('.te-gradient-input[data-path="components.login_panel_gradient_start"]');
        var endInput = document.querySelector('.te-gradient-input[data-path="components.login_panel_gradient_end"]');
        if (startInput && endInput) {
            preview.style.background = 'linear-gradient(135deg, ' + startInput.value + ', ' + endInput.value + ')';
        }
    }

    editor.onchange = function (e) {
        var el = e.target;
        if (el.id === 'linksPreviewEgg') {
            linksPreviewEgg = el.value;
            updateLinksPreview();
            return;
        }
        if (el.dataset.massEggCategory !== undefined) {
            massEggCategory = el.value || '';
            applyMassEggFilters();
            return;
        }
        if (el.dataset.massEggNest !== undefined) {
            massEggTargetNest = el.value || '';
            return;
        }
        if (el.dataset.massEggsImportNest !== undefined) {
            massEggImportNest = el.value || '';
            return;
        }
        if (el.type === 'file' && el.dataset.configImportInput !== undefined) {
            importConfigFile(el);
            return;
        }
        if (el.type === 'file' && el.dataset.uploadPath) {
            uploadFile(el, el.dataset.uploadPath);
        }
        if (el.type === 'file' && el.dataset.eggUpload) {
            uploadEggImage(el, el.dataset.eggUpload);
        }
        if (el.type === 'checkbox' && el.dataset.action === 'toggle-announcement') {
            toggleAnnouncementEnabled(parseInt(el.dataset.announcementId), el.checked);
            return;
        }
        if (el.type === 'checkbox' && el.dataset.sftpOverrideEnabled !== undefined) {
            var sftpEnabledNodeId = parseInt(el.dataset.nodeId, 10);
            if (!isNaN(sftpEnabledNodeId)) {
                upsertSftpHostOverride(sftpEnabledNodeId, { enabled: el.checked });
                var sftpInputWrapper = document.querySelector('[data-sftp-override-input-wrapper][data-node-id="' + sftpEnabledNodeId + '"]');
                if (sftpInputWrapper) {
                    if (el.checked) {
                        sftpInputWrapper.removeAttribute('hidden');
                    } else {
                        sftpInputWrapper.setAttribute('hidden', '');
                    }
                }
            }
            return;
        }
        if (el.type === 'checkbox' && el.dataset.path) {
            setConfig(el.dataset.path, el.checked);
            if (el.dataset.path.indexOf('layout.nav_links') !== -1) {
                updateLinksPreview();
            }
        }
        if (el.tagName === 'SELECT' && el.dataset.path === 'advanced.billing_integration.platform') {
            updateBillingPlatformFields(el.value);
        }
        if (el.type === 'checkbox' && el.dataset.languageCode) {
            toggleLanguage(el.dataset.languageCode, el.checked);
            var item = el.closest('.te-language-item');
            if (item) {
                item.classList.toggle('enabled', el.checked);
            }
        }
        if (el.type === 'checkbox' && el.dataset.componentEggSelectAll) {
            var componentSettingId = el.dataset.componentEggSelectAll;
            var componentSettingPath = 'components.' + componentSettingId;
            var componentSelector = el.closest('.te-egg-selector');
            var selectedComponentEggs = getConfigValue(componentSettingPath, []);
            if (!Array.isArray(selectedComponentEggs)) selectedComponentEggs = [];

            if (el.checked) {
                setConfig(componentSettingPath, []);
                if (componentSelector) {
                    componentSelector.querySelectorAll('input[data-component-egg-select="' + componentSettingId + '"]').forEach(function (input) {
                        input.checked = false;
                        var option = input.closest('.te-egg-selector-item');
                        if (option) option.classList.remove('selected');
                    });
                }
            } else if (selectedComponentEggs.length === 0) {
                el.checked = true;
            }

            var componentAllItem = el.closest('.te-egg-selector-item');
            if (componentAllItem) {
                componentAllItem.classList.toggle('selected', el.checked);
            }

            var componentCountEl = document.querySelector('.te-egg-selector-count[data-component-setting-id="' + componentSettingId + '"]');
            if (componentCountEl) componentCountEl.textContent = getComponentEggSelectorCount([]);
        }
        if (el.type === 'checkbox' && el.dataset.componentEggSelect) {
            var startupSettingId = el.dataset.componentEggSelect;
            var startupEggId = parseInt(el.dataset.eggId, 10);
            var startupSettingPath = 'components.' + startupSettingId;
            var currentStartupEggs = getConfigValue(startupSettingPath, []);
            if (!Array.isArray(currentStartupEggs)) currentStartupEggs = [];

            currentStartupEggs = currentStartupEggs
                .map(function (eggId) { return parseInt(eggId, 10); })
                .filter(function (eggId) { return !isNaN(eggId); });

            var startupIdx = currentStartupEggs.indexOf(startupEggId);
            if (el.checked && startupIdx === -1) {
                currentStartupEggs.push(startupEggId);
            } else if (!el.checked && startupIdx !== -1) {
                currentStartupEggs.splice(startupIdx, 1);
            }

            setConfig(startupSettingPath, currentStartupEggs);

            var startupItem = el.closest('.te-egg-selector-item');
            if (startupItem) startupItem.classList.toggle('selected', el.checked);

            var startupSelector = el.closest('.te-egg-selector');
            var startupAllCheckbox = startupSelector
                ? startupSelector.querySelector('input[data-component-egg-select-all="' + startupSettingId + '"]')
                : null;
            if (startupAllCheckbox) {
                startupAllCheckbox.checked = currentStartupEggs.length === 0;
                var startupAllItem = startupAllCheckbox.closest('.te-egg-selector-item');
                if (startupAllItem) startupAllItem.classList.toggle('selected', startupAllCheckbox.checked);
            }

            var startupCountEl = document.querySelector('.te-egg-selector-count[data-component-setting-id="' + startupSettingId + '"]');
            if (startupCountEl) startupCountEl.textContent = getComponentEggSelectorCount(currentStartupEggs);
        }
        if (el.type === 'checkbox' && el.dataset.addonToggle) {
            toggleAddon(el.dataset.addonToggle, el.checked);
        }
        if (el.type === 'checkbox' && el.dataset.addonEggSelect) {
            var addonId = el.dataset.addonEggSelect;
            var settingId = el.dataset.settingId;
            var eggId = parseInt(el.dataset.eggId, 10);
            var currentEggs = getConfigValue('addons.' + addonId + '.settings.' + settingId, []);
            if (!Array.isArray(currentEggs)) currentEggs = [];

            var idx = currentEggs.indexOf(eggId);
            if (el.checked && idx === -1) {
                currentEggs.push(eggId);
            } else if (!el.checked && idx !== -1) {
                currentEggs.splice(idx, 1);
            }
            setConfig('addons.' + addonId + '.settings.' + settingId, currentEggs);

            var item = el.closest('.te-egg-selector-item');
            if (item) item.classList.toggle('selected', el.checked);

            var countEl = document.querySelector('.te-egg-selector-count[data-addon-id="' + addonId + '"][data-setting-id="' + settingId + '"]');
            if (countEl) countEl.textContent = currentEggs.length + ' selected';
        }
        if (el.type === 'checkbox' && (el.closest('.te-egg-option') || el.closest('.te-egg-option-compact'))) {
            var catIndex = parseInt(el.dataset.catIndex || '0', 10);
            var linkIndex = parseInt(el.dataset.linkIndex || '0', 10);
            var eggId = parseInt(el.dataset.eggId, 10);
            var eggFilterPath = 'layout.nav_links.categories.' + catIndex + '.links.' + linkIndex + '.egg_filter';
            var currentFilter = getConfigValue(eggFilterPath, []);
            if (!Array.isArray(currentFilter)) currentFilter = [];

            var idx = currentFilter.indexOf(eggId);
            if (el.checked && idx === -1) {
                currentFilter.push(eggId);
            } else if (!el.checked && idx !== -1) {
                currentFilter.splice(idx, 1);
            }
            setConfig(eggFilterPath, currentFilter);
            updateLinksPreview();
        }
        if (el.type === 'radio' && el.dataset.path) {
            setConfig(el.dataset.path, el.value);
            var groupName = el.name;
            if (groupName) {
                document.querySelectorAll('.te-layout-option input[name="' + groupName + '"]').forEach(function (input) {
                    var label = input.closest('.te-layout-option');
                    if (label) label.classList.remove('active');
                });
                document.querySelectorAll('.te-component-option input[name="' + groupName + '"]').forEach(function (input) {
                    var label = input.closest('.te-component-option');
                    if (label) label.classList.remove('active');
                });
            } else {
                document.querySelectorAll('.te-layout-option').forEach(function (opt) {
                    opt.classList.remove('active');
                });
            }
            var label = el.closest('.te-layout-option') || el.closest('.te-component-option');
            if (label) label.classList.add('active');
        }
    };

    editor.querySelectorAll('.te-resize-handle').forEach(function (handle) {
        handle.onmousedown = function (e) { startResize(e, handle.dataset.resize); };
    });
}

function setupUrlTracking() {
    var iframe = document.getElementById('previewFrame');
    if (!iframe) {
        return;
    };
    var lastUrl = '/';

    function check() {
        try {
            var url = iframe.contentWindow.location.pathname + iframe.contentWindow.location.search;
            if (url !== lastUrl) {
                lastUrl = url;
                document.getElementById('previewUrl').textContent = url;
                document.getElementById('previewUrlLink').href = url;
            }
        } catch (e) { }
    }

    iframe.onload = function () {
        check();
        if (previewUrlToRestore) {
            try {
                var urlToRestore = previewUrlToRestore;
                previewUrlToRestore = null;
                setTimeout(function () {
                    iframe.contentWindow.history.pushState({}, '', urlToRestore);
                    iframe.contentWindow.dispatchEvent(new PopStateEvent('popstate'));
                }, 100);
            } catch (e) { }
        }
    };
    setInterval(check, 500);
}

function getPreviewUrl() {
    var iframe = document.getElementById('previewFrame');
    if (iframe && iframe.contentWindow) {
        try {
            return iframe.contentWindow.location.pathname + iframe.contentWindow.location.search;
        } catch (e) { }
    }
    return '/';
}

function reloadPreviewWithUrl() {
    var iframe = document.getElementById('previewFrame');
    if (iframe) {
        previewUrlToRestore = getPreviewUrl();
        iframe.src = '/';
    }
}

function handleAction(action) {
    if (action === 'save') save();
    if (action === 'export-config') exportConfigFile();
    if (action === 'reset') {
        showConfirm('Reset Settings', 'Are you sure you want to reset all settings to their defaults? This cannot be undone.', function () {
            doReset();
        });
    }
    if (action === 'refresh-preview') {
        reloadPreviewWithUrl();
    }
    if (action === 'back') {
        if (!unsavedChanges) {
            window.location.href = routes.settings;
        } else {
            showConfirm('Unsaved Changes', 'You have unsaved changes. Are you sure you want to leave?', function () {
                window.location.href = routes.settings;
            });
        }
    }
    if (action === 'back-to-addons') {
        closeAddonSettings();
    }
    if (action === 'add-env-var') {
        showEnvModal('add');
    }
}

function setConfig(path, value) {
    var pathParts = path.split('.');
    var currentObject = config;

    for (var i = 0; i < pathParts.length - 1; i++) {
        var currentKey = pathParts[i];
        var nextKey = pathParts[i + 1];
        var nextKeyIsNumber = /^[0-9]+$/.test(nextKey);

        if (currentObject[currentKey] === undefined || currentObject[currentKey] === null) {
            currentObject[currentKey] = nextKeyIsNumber ? [] : {};
        } else if (nextKeyIsNumber && !Array.isArray(currentObject[currentKey])) {
            currentObject[currentKey] = [];
        } else if (!nextKeyIsNumber && Array.isArray(currentObject[currentKey])) {
            currentObject[currentKey] = {};
        } else if (typeof currentObject[currentKey] !== 'object') {
            currentObject[currentKey] = nextKeyIsNumber ? [] : {};
        }

        currentObject = currentObject[currentKey];
    }

    var finalKey = pathParts[pathParts.length - 1];
    var finalKeyIsNumber = /^[0-9]+$/.test(finalKey);

    if (Array.isArray(currentObject) && finalKeyIsNumber) {
        currentObject[parseInt(finalKey, 10)] = value;
    } else {
        currentObject[finalKey] = value;
    }

    markUnsaved();
}

function getConfigValue(path, fallback) {
    var pathParts = path.split('.');
    var currentObject = config;

    for (var i = 0; i < pathParts.length; i++) {
        if (currentObject === undefined || currentObject === null) {
            return fallback;
        }
        currentObject = currentObject[pathParts[i]];
    }

    if (currentObject === undefined) {
        return fallback;
    }

    return currentObject;
}

function addRepeaterItem(path, item, max) {
    var currentList = getConfigValue(path, []);

    if (!Array.isArray(currentList)) {
        currentList = [];
    }

    if (typeof max === 'number' && currentList.length >= max) {
        return;
    }

    currentList.push(item);
    setConfig(path, currentList);
}

function removeRepeaterItem(path, index) {
    var currentList = getConfigValue(path, []);

    if (!Array.isArray(currentList)) {
        currentList = [];
    }

    if (index < 0 || index >= currentList.length) {
        return;
    }

    currentList.splice(index, 1);
    setConfig(path, currentList);
}

function getDefaultsValue(path, fallback) {
    var pathParts = path.split('.');
    var currentObject = defaults;

    for (var i = 0; i < pathParts.length; i++) {
        if (currentObject === undefined || currentObject === null) {
            return fallback;
        }
        currentObject = currentObject[pathParts[i]];
    }

    if (currentObject === undefined) {
        return fallback;
    }

    return currentObject;
}

function handleNavAction(btn) {
    var action = btn.dataset.navAction;
    if (action === 'reset-defaults') {
        var defaultNavLinks = getDefaultsValue('layout.nav_links', {});
        var categories = defaultNavLinks.categories || [];
        categories.forEach(function (cat) {
            if (cat) {
                cat.enabled = true;
                var links = Array.isArray(cat.links) ? cat.links : [];
                links.forEach(function (link) {
                    if (link) link.enabled = true;
                });
            }
        });
        setConfig('layout.nav_links', defaultNavLinks);
        return;
    }

    if (action === 'add-category') {
        var existingCategories = getConfigValue('layout.nav_links.categories', []);
        if (!Array.isArray(existingCategories)) existingCategories = [];
        existingCategories.push({
            id: 'custom_cat_' + Date.now(),
            label: 'New Category',
            enabled: true,
            order: existingCategories.length,
            links: []
        });
        setConfig('layout.nav_links.categories', existingCategories);
        return existingCategories.length - 1;
    }

    var catIndex = parseInt(btn.dataset.catIndex || '0', 10);
    var linkIndex = parseInt(btn.dataset.linkIndex || '0', 10);

    var categories = getConfigValue('layout.nav_links.categories', []);
    if (!Array.isArray(categories) || !categories[catIndex]) return;
    var catPath = 'layout.nav_links.categories.' + catIndex;
    var linksPath = catPath + '.links';
    var links = getConfigValue(linksPath, []);
    if (!Array.isArray(links)) links = [];

    if (action === 'move-category') {
        var dir = btn.dataset.dir;
        categories.forEach(function (c, i) {
            if (c && typeof c === 'object' && (c.order === undefined || c.order === null)) c.order = i;
        });
        var sortedCategories = categories.map(function (cat, i) {
            return { category: cat, originalIndex: i };
        }).sort(function (a, b) {
            var orderA = a.category && (a.category.order === 0 || a.category.order) ? a.category.order : a.originalIndex;
            var orderB = b.category && (b.category.order === 0 || b.category.order) ? b.category.order : b.originalIndex;
            return orderA - orderB;
        });

        var currentPos = sortedCategories.findIndex(function (item) {
            return item.originalIndex === catIndex;
        });

        if (currentPos !== -1) {
            if (dir === 'up' && currentPos > 0) {
                var currentOrderUp = sortedCategories[currentPos].category.order;
                var prevOrderUp = sortedCategories[currentPos - 1].category.order;
                sortedCategories[currentPos].category.order = prevOrderUp;
                sortedCategories[currentPos - 1].category.order = currentOrderUp;
            }
            if (dir === 'down' && currentPos < sortedCategories.length - 1) {
                var currentOrderDown = sortedCategories[currentPos].category.order;
                var nextOrderDown = sortedCategories[currentPos + 1].category.order;
                sortedCategories[currentPos].category.order = nextOrderDown;
                sortedCategories[currentPos + 1].category.order = currentOrderDown;
            }
        }

        setConfig('layout.nav_links.categories', categories);
        return;
    }

    if (action === 'add-link') {
        links.push({
            id: 'custom_' + Date.now(),
            label: '',
            icon: 'globe',
            link: '',
            permission: '',
            enabled: true,
            order: links.length,
            egg_filter: [],
            open_in_new_tab: false,
        });
        setConfig(linksPath, links);
        return;
    }

    if (action === 'remove-link') {
        if (linkIndex < 0 || linkIndex >= links.length) return;
        links.splice(linkIndex, 1);
        links.forEach(function (l, i) { if (l && typeof l === 'object') l.order = i; });
        setConfig(linksPath, links);
        return;
    }

    if (action === 'move-link') {
        var dir = btn.dataset.dir;
        if (dir === 'up' && linkIndex > 0) {
            var t1 = links[linkIndex - 1];
            links[linkIndex - 1] = links[linkIndex];
            links[linkIndex] = t1;
            links.forEach(function (l, i) { if (l && typeof l === 'object') l.order = i; });
            setConfig(linksPath, links);
        }
        if (dir === 'down' && linkIndex < links.length - 1) {
            var t2 = links[linkIndex + 1];
            links[linkIndex + 1] = links[linkIndex];
            links[linkIndex] = t2;
            links.forEach(function (l, i) { if (l && typeof l === 'object') l.order = i; });
            setConfig(linksPath, links);
        }
        return;
    }
}

function handleCustomLinkAction(btn) {
    var action = btn.dataset.customLinkAction;
    var linkIndex = parseInt(btn.dataset.linkIndex || '0', 10);
    var linkType = btn.dataset.linkType;

    if (action === 'add') {
        var pathPrefix = linkType === 'dashboard' ? 'dashboard_custom_links' : 'account_custom_links';
        var links = getConfigValue('layout.' + pathPrefix, []);
        if (!Array.isArray(links)) links = [];

        links.push({
            label: '',
            icon: 'link',
            url: '',
            open_in_new_tab: false
        });

        setConfig('layout.' + pathPrefix, links);
        return;
    }

    var pathPrefix = linksMode === 'dashboard' ? 'dashboard_custom_links' : 'account_custom_links';
    var links = getConfigValue('layout.' + pathPrefix, []);
    if (!Array.isArray(links)) links = [];

    if (action === 'remove') {
        if (linkIndex < 0 || linkIndex >= links.length) return;
        links.splice(linkIndex, 1);
        setConfig('layout.' + pathPrefix, links);
        return;
    }

    if (action === 'move') {
        var dir = btn.dataset.dir;
        if (dir === 'up' && linkIndex > 0) {
            var temp = links[linkIndex - 1];
            links[linkIndex - 1] = links[linkIndex];
            links[linkIndex] = temp;
            setConfig('layout.' + pathPrefix, links);
        }
        if (dir === 'down' && linkIndex < links.length - 1) {
            var temp = links[linkIndex + 1];
            links[linkIndex + 1] = links[linkIndex];
            links[linkIndex] = temp;
            setConfig('layout.' + pathPrefix, links);
        }
        return;
    }
}

function handleEggFilterAction(btn) {
    var action = btn.dataset.eggAction;
    var catIndex = parseInt(btn.dataset.catIndex || '0', 10);
    var linkIndex = parseInt(btn.dataset.linkIndex || '0', 10);

    var eggFilterPath = 'layout.nav_links.categories.' + catIndex + '.links.' + linkIndex + '.egg_filter';
    var filterContainer = btn.closest('.te-nav-link-egg-section') || btn.closest('.te-egg-filter');

    if (action === 'mode-all') {
        setConfig(eggFilterPath, []);
        if (filterContainer) {
            filterContainer.querySelector('[data-egg-action="mode-all"]').classList.add('active');
            filterContainer.querySelector('[data-egg-action="mode-some"]').classList.remove('active');
            var eggList = filterContainer.querySelector('.te-egg-list-compact') || filterContainer.querySelector('.te-egg-list');
            if (eggList) eggList.classList.remove('visible');
        }
        updateLinksPreview();
        return;
    }

    if (action === 'mode-some') {
        if (filterContainer) {
            filterContainer.querySelector('[data-egg-action="mode-all"]').classList.remove('active');
            filterContainer.querySelector('[data-egg-action="mode-some"]').classList.add('active');
            var eggList = filterContainer.querySelector('.te-egg-list-compact') || filterContainer.querySelector('.te-egg-list');
            if (eggList) eggList.classList.add('visible');
        }
        return;
    }
}

function updateOpenTabToggleState(container, openInNewTab) {
    if (!container) return;
    var sameBtn = container.querySelector('[data-open-tab-action="same"], [data-custom-open-tab-action="same"]');
    var newBtn = container.querySelector('[data-open-tab-action="new"], [data-custom-open-tab-action="new"]');
    if (sameBtn) {
        if (openInNewTab) sameBtn.classList.remove('active');
        else sameBtn.classList.add('active');
    }
    if (newBtn) {
        if (openInNewTab) newBtn.classList.add('active');
        else newBtn.classList.remove('active');
    }
}

function handleOpenTabAction(btn) {
    var action = btn.dataset.openTabAction;
    var catIndex = parseInt(btn.dataset.catIndex || '0', 10);
    var linkIndex = parseInt(btn.dataset.linkIndex || '0', 10);
    var openInNewTab = action === 'new';
    var path = 'layout.nav_links.categories.' + catIndex + '.links.' + linkIndex + '.open_in_new_tab';

    setConfig(path, openInNewTab);
    updateOpenTabToggleState(btn.closest('.te-nav-link-field') || btn.closest('.te-egg-toggle-group-sm'), openInNewTab);
    updateLinksPreview();
}

function handleCustomOpenTabAction(btn) {
    var action = btn.dataset.customOpenTabAction;
    var linkIndex = parseInt(btn.dataset.linkIndex || '0', 10);
    var pathPrefix = btn.dataset.pathPrefix || (linksMode === 'dashboard' ? 'dashboard_custom_links' : 'account_custom_links');
    var openInNewTab = action === 'new';
    var path = 'layout.' + pathPrefix + '.' + linkIndex + '.open_in_new_tab';

    setConfig(path, openInNewTab);
    updateOpenTabToggleState(btn.closest('.te-custom-link-field') || btn.closest('.te-egg-toggle-group-sm'), openInNewTab);
}

function filterEggOptions(eggList, searchTerm) {
    var term = searchTerm.toLowerCase();
    eggList.querySelectorAll('.te-egg-option, .te-egg-option-compact').forEach(function (opt) {
        var name = opt.querySelector('.te-egg-option-name') || opt.querySelector('.te-egg-option-name-sm');
        var nest = opt.querySelector('.te-egg-option-nest');
        var nameText = name ? name.textContent.toLowerCase() : '';
        var nestText = nest ? nest.textContent.toLowerCase() : '';
        var matches = !term || nameText.indexOf(term) !== -1 || nestText.indexOf(term) !== -1;
        opt.style.display = matches ? '' : 'none';
    });
}

function filterEggSelectorOptions(selector, searchTerm) {
    var term = searchTerm.toLowerCase();
    selector.querySelectorAll('.te-egg-selector-item').forEach(function (item) {
        var name = item.querySelector('.te-egg-selector-name');
        var nest = item.querySelector('.te-egg-selector-nest');
        var nameText = name ? name.textContent.toLowerCase() : '';
        var nestText = nest ? nest.textContent.toLowerCase() : '';
        var matches = !term || nameText.indexOf(term) !== -1 || nestText.indexOf(term) !== -1;
        item.style.display = matches ? '' : 'none';
    });
}

function addDomain(addonId, settingId, domain) {
    domain = domain.toLowerCase().trim();

    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i.test(domain)) {
        toast('Please enter a valid domain (e.g., example.com)', 'error');
        return;
    }

    var currentDomains = getConfigValue('addons.' + addonId + '.settings.' + settingId, []);
    if (!Array.isArray(currentDomains)) currentDomains = [];

    if (currentDomains.indexOf(domain) !== -1) {
        toast('This domain is already added', 'error');
        return;
    }

    currentDomains.push(domain);
    setConfig('addons.' + addonId + '.settings.' + settingId, currentDomains);

    var listContainer = document.querySelector('.te-domain-list[data-addon-id="' + addonId + '"][data-setting-id="' + settingId + '"] .te-domain-list-items');
    if (listContainer) {
        var itemTemplate = getTemplate('te-addon-domain-list-item');
        var newItemHtml = replaceAll(itemTemplate, {
            'ADDON_ID': addonId,
            'SETTING_ID': settingId,
            'DOMAIN': esc(domain)
        });
        listContainer.insertAdjacentHTML('beforeend', newItemHtml);
    }

    toast('Domain added', 'success');
}

function removeDomain(addonId, settingId, domain) {
    var currentDomains = getConfigValue('addons.' + addonId + '.settings.' + settingId, []);
    if (!Array.isArray(currentDomains)) currentDomains = [];

    var idx = currentDomains.indexOf(domain);
    if (idx !== -1) {
        currentDomains.splice(idx, 1);
        setConfig('addons.' + addonId + '.settings.' + settingId, currentDomains);

        var itemToRemove = document.querySelector('.te-domain-list-item[data-domain="' + domain + '"]');
        if (itemToRemove) {
            itemToRemove.remove();
        }
        toast('Domain removed', 'success');
    }
}

function normaliseSrvServiceValue(value, fallback) {
    var cleaned = String(value || '').trim().toLowerCase();
    if (cleaned === '') {
        return fallback !== undefined ? fallback : '_minecraft';
    }
    if (cleaned.charAt(0) !== '_') {
        cleaned = '_' + cleaned;
    }
    return cleaned;
}

function isValidSrvServiceValue(value) {
    return /^_[a-z0-9][a-z0-9_-]*$/i.test(String(value || '').trim());
}


function normaliseDomainSrvServiceMap(value) {
    var map = {};
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return map;
    }

    Object.keys(value).forEach(function (eggId) {
        var cleanEggId = String(eggId || '').trim();
        var service = normaliseSrvServiceValue(value[eggId], '');
        if (cleanEggId !== '' && service !== '') {
            map[cleanEggId] = service;
        }
    });

    return map;
}

function normaliseDomainSrvProtocolMap(value) {
    var map = {};
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return map;
    }

    Object.keys(value).forEach(function (eggId) {
        var cleanEggId = String(eggId || '').trim();
        var protocol = (value[eggId] === '_udp') ? '_udp' : '_tcp';
        if (cleanEggId !== '') {
            map[cleanEggId] = protocol;
        }
    });

    return map;
}

function normaliseDomainConfig(value) {
    var source = {};
    if (typeof value === 'string') {
        source.domain = value;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        source = value;
    }

    var routingMode = source.routing_mode === 'web' ? 'web' : 'game';
    var srvServiceByEgg = normaliseDomainSrvServiceMap(source.srv_service_by_egg);
    var srvProtocolByEgg = normaliseDomainSrvProtocolMap(source.srv_protocol_by_egg);
    var srvServiceMode = source.srv_service_mode === 'per_egg' || Object.keys(srvServiceByEgg).length > 0 ? 'per_egg' : 'global';
    var srvService = normaliseSrvServiceValue(source.srv_service, '_minecraft');
    var srvServiceDefault = normaliseSrvServiceValue(source.srv_service_default || source.srv_service, '_minecraft');

    var domainConfig = {
        domain: String(source.domain || '').toLowerCase().trim(),
        zone_id: String(source.zone_id || '').trim(),
        dns_ip: String(source.dns_ip || '').trim(),
        routing_mode: routingMode,
        srv_enabled: toBool(source.srv_enabled, true),
        srv_service_mode: srvServiceMode,
        srv_service: srvServiceMode === 'per_egg' ? srvServiceDefault : srvService,
        srv_service_default: srvServiceDefault,
        srv_service_by_egg: srvServiceMode === 'per_egg' ? srvServiceByEgg : {},
        srv_protocol: source.srv_protocol === '_udp' ? '_udp' : '_tcp',
        srv_protocol_by_egg: srvServiceMode === 'per_egg' ? srvProtocolByEgg : {},
        a_record_enabled: toBool(source.a_record_enabled, false)
    };

    if (domainConfig.routing_mode === 'web') {
        domainConfig.srv_enabled = false;
        domainConfig.a_record_enabled = true;
    }

    return domainConfig;
}

function normaliseDomainConfigs(value) {
    var items = [];

    if (Array.isArray(value)) {
        items = value;
    } else if (typeof value === 'object' && value !== null) {
        if (value.domain !== undefined || value.zone_id !== undefined) {
            items = [value];
        } else {
            items = Object.keys(value).sort(function (a, b) {
                var numberA = parseInt(a, 10);
                var numberB = parseInt(b, 10);
                if (!isNaN(numberA) && !isNaN(numberB)) {
                    return numberA - numberB;
                }
                return String(a).localeCompare(String(b));
            }).map(function (key) {
                return value[key];
            });
        }
    } else if (typeof value === 'string' && value.trim() !== '') {
        items = [value];
    }

    return items.map(function (domainConfig) {
        return normaliseDomainConfig(domainConfig);
    }).filter(function (domainConfig) {
        return domainConfig.domain !== '' || domainConfig.zone_id !== '';
    });
}

function getDomainSrvServiceMode(domainConfig) {
    if (typeof domainConfig !== 'object' || domainConfig === null || Array.isArray(domainConfig)) {
        domainConfig = {};
    }
    var map = normaliseDomainSrvServiceMap(domainConfig.srv_service_by_egg);
    var hasMappedServices = Object.keys(map).length > 0;
    if (domainConfig.srv_service_mode === 'per_egg' || hasMappedServices) {
        return 'per_egg';
    }
    return 'global';
}

function buildDomainSrvEggOptions(selectedEggId) {
    var options = '<option value="">Select egg...</option>';
    eggs.forEach(function (egg) {
        var selected = String(egg.id) === String(selectedEggId) ? ' selected' : '';
        options += '<option value="' + String(egg.id) + '"' + selected + '>' + esc(egg.name) + ' (' + esc(egg.nest_name) + ')</option>';
    });
    return options;
}

function buildDomainSrvEggServiceRows(srvServiceByEgg, srvProtocolByEgg) {
    var template = getTemplate('te-domain-srv-egg-service-row');
    var rows = '';
    var serviceMap = (typeof srvServiceByEgg === 'object' && srvServiceByEgg !== null && !Array.isArray(srvServiceByEgg)) ? srvServiceByEgg : {};
    var protocolMap = (typeof srvProtocolByEgg === 'object' && srvProtocolByEgg !== null && !Array.isArray(srvProtocolByEgg)) ? srvProtocolByEgg : {};

    Object.keys(serviceMap).forEach(function (eggId) {
        var service = normaliseSrvServiceValue(serviceMap[eggId], '');
        if (!service) {
            return;
        }
        var protocol = protocolMap[eggId] || '_tcp';
        rows += replaceAll(template, {
            'SRV_EGG_OPTIONS': buildDomainSrvEggOptions(eggId),
            'SRV_EGG_SERVICE_VALUE': esc(service),
            'SRV_EGG_TCP_SELECTED': protocol === '_tcp' ? 'selected' : '',
            'SRV_EGG_UDP_SELECTED': protocol === '_udp' ? 'selected' : '',
        });
    });

    return rows;
}

function appendDomainSrvEggServiceRow(modal, eggId, service, protocol) {
    var rowsContainer = modal.querySelector('[data-srv-egg-service-rows]');
    if (!rowsContainer) {
        return;
    }

    var template = getTemplate('te-domain-srv-egg-service-row');
    var rowHtml = replaceAll(template, {
        'SRV_EGG_OPTIONS': buildDomainSrvEggOptions(eggId || ''),
        'SRV_EGG_SERVICE_VALUE': esc(service || ''),
        'SRV_EGG_TCP_SELECTED': (!protocol || protocol === '_tcp') ? 'selected' : '',
        'SRV_EGG_UDP_SELECTED': (protocol === '_udp') ? 'selected' : '',
    });

    rowsContainer.insertAdjacentHTML('beforeend', rowHtml);
}

function openDomainConfigModal(addonId, settingId, domainIndex) {
    var domainConfigs = normaliseDomainConfigs(getConfigValue('addons.' + addonId + '.settings.' + settingId, []));

    var isNew = domainIndex === -1 || domainIndex === 'new';
    var domainConfig = isNew ? {
        domain: '',
        zone_id: '',
        dns_ip: '',
        routing_mode: 'game',
        srv_enabled: true,
        srv_service_mode: 'global',
        srv_service: '_minecraft',
        srv_service_default: '_minecraft',
        srv_service_by_egg: {},
        srv_protocol: '_tcp',
        srv_protocol_by_egg: {},
        a_record_enabled: false
    } : normaliseDomainConfig(domainConfigs[parseInt(domainIndex)] || {});
    var routingMode = (domainConfig.routing_mode || 'game') === 'web' ? 'web' : 'game';
    var srvEnabled = toBool(domainConfig.srv_enabled, true);
    var aRecordEnabled = toBool(domainConfig.a_record_enabled, false);
    var srvServiceMode = getDomainSrvServiceMode(domainConfig);
    var srvServiceValue = normaliseSrvServiceValue(domainConfig.srv_service, '_minecraft');
    var srvServiceDefaultValue = normaliseSrvServiceValue(domainConfig.srv_service_default || domainConfig.srv_service, '_minecraft');
    var srvServiceByEgg = normaliseDomainSrvServiceMap(domainConfig.srv_service_by_egg);
    var srvProtocolByEgg = normaliseDomainSrvProtocolMap(domainConfig.srv_protocol_by_egg);
    var srvEggServiceRows = buildDomainSrvEggServiceRows(srvServiceByEgg, srvProtocolByEgg);

    var template = getTemplate('te-domain-config-modal');
    var modalHtml = replaceAll(template, {
        'MODAL_TITLE': isNew ? 'Add Domain' : 'Edit Domain',
        'ADDON_ID': addonId,
        'SETTING_ID': settingId,
        'DOMAIN_INDEX': isNew ? 'new' : domainIndex,
        'DOMAIN_VALUE': esc(domainConfig.domain || ''),
        'ZONE_ID_VALUE': esc(domainConfig.zone_id || ''),
        'DNS_IP_VALUE': esc(domainConfig.dns_ip || ''),
        'ROUTING_MODE_GAME_SELECTED': routingMode !== 'web' ? 'selected' : '',
        'ROUTING_MODE_WEB_SELECTED': routingMode === 'web' ? 'selected' : '',
        'SRV_ENABLED_CHECKED': srvEnabled ? 'checked' : '',
        'SRV_SERVICE_MODE_GLOBAL_SELECTED': srvServiceMode === 'global' ? 'selected' : '',
        'SRV_SERVICE_MODE_PER_EGG_SELECTED': srvServiceMode === 'per_egg' ? 'selected' : '',
        'SRV_SERVICE_VALUE': esc(srvServiceValue),
        'SRV_SERVICE_DEFAULT_VALUE': esc(srvServiceDefaultValue),
        'SRV_EGG_SERVICE_ROWS': srvEggServiceRows,
        'SRV_TCP_SELECTED': domainConfig.srv_protocol !== '_udp' ? 'selected' : '',
        'SRV_UDP_SELECTED': domainConfig.srv_protocol === '_udp' ? 'selected' : '',
        'SRV_FIELDS_HIDDEN': !srvEnabled ? 'hidden' : '',
        'SRV_SERVICE_GLOBAL_FIELDS_HIDDEN': !srvEnabled || srvServiceMode === 'per_egg' ? 'hidden' : '',
        'SRV_SERVICE_PER_EGG_FIELDS_HIDDEN': !srvEnabled || srvServiceMode !== 'per_egg' ? 'hidden' : '',
        'A_RECORD_ENABLED_CHECKED': aRecordEnabled ? 'checked' : '',
        'GAME_FIELDS_HIDDEN': routingMode === 'web' ? 'hidden' : '',
        'WEB_FIELDS_HIDDEN': routingMode === 'web' ? '' : 'hidden'
    });

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    var modal = document.querySelector('.te-modal-overlay[data-modal="domain-config"]');
    if (modal) {
        setTimeout(function () {
            modal.classList.add('visible');
        }, 10);

        var srvToggle = modal.querySelector('[data-field="srv_enabled"]');
        var srvFields = modal.querySelector('.te-srv-fields');
        var aRecordToggle = modal.querySelector('[data-field="a_record_enabled"]');
        var routingModeField = modal.querySelector('[data-field="routing_mode"]');
        var srvServiceModeField = modal.querySelector('[data-field="srv_service_mode"]');
        var srvServiceGlobalFields = modal.querySelector('.te-srv-service-global-fields');
        var srvServicePerEggFields = modal.querySelector('.te-srv-service-per-egg-fields');
        var gameFields = modal.querySelector('.te-domain-game-fields');
        var webFields = modal.querySelector('.te-domain-web-fields');

        if (routingModeField) {
            routingModeField.value = routingMode;
        }

        if (srvToggle) {
            srvToggle.checked = srvEnabled;
        }

        if (aRecordToggle) {
            aRecordToggle.checked = aRecordEnabled;
        }

        var updateSrvServiceModeFields = function () {
            var isWebMode = routingModeField && routingModeField.value === 'web';
            var srvAvailable = srvToggle && srvToggle.checked && !isWebMode;
            var mode = srvServiceModeField && srvServiceModeField.value === 'per_egg' ? 'per_egg' : 'global';

            if (srvServiceGlobalFields) {
                if (srvAvailable && mode === 'global') srvServiceGlobalFields.removeAttribute('hidden');
                else srvServiceGlobalFields.setAttribute('hidden', '');
            }

            if (srvServicePerEggFields) {
                if (srvAvailable && mode === 'per_egg') srvServicePerEggFields.removeAttribute('hidden');
                else srvServicePerEggFields.setAttribute('hidden', '');
            }
        };

        var updateRoutingModeFields = function () {
            var isWebMode = routingModeField && routingModeField.value === 'web';

            if (gameFields) {
                if (isWebMode) gameFields.setAttribute('hidden', '');
                else gameFields.removeAttribute('hidden');
            }

            if (webFields) {
                if (isWebMode) webFields.removeAttribute('hidden');
                else webFields.setAttribute('hidden', '');
            }

            if (aRecordToggle) {
                if (isWebMode) {
                    aRecordToggle.checked = true;
                    aRecordToggle.disabled = true;
                } else {
                    aRecordToggle.disabled = false;
                }
            }

            updateSrvServiceModeFields();
        };

        if (srvToggle && srvFields) {
            srvToggle.addEventListener('change', function () {
                if (this.checked) {
                    srvFields.removeAttribute('hidden');
                } else {
                    srvFields.setAttribute('hidden', '');
                }

                updateSrvServiceModeFields();
            });
        }

        if (srvServiceModeField) {
            srvServiceModeField.value = srvServiceMode;
            srvServiceModeField.addEventListener('change', updateSrvServiceModeFields);
        }

        var addSrvEggServiceRowBtn = modal.querySelector('[data-action="add-srv-egg-service-row"]');
        if (addSrvEggServiceRowBtn) {
            addSrvEggServiceRowBtn.addEventListener('click', function () {
                appendDomainSrvEggServiceRow(modal, '', '', '_tcp');
            });
        }

        if (routingModeField) {
            routingModeField.addEventListener('change', updateRoutingModeFields);
            updateRoutingModeFields();
        }

        var saveBtn = modal.querySelector('[data-action="save-domain-config"]');
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                var btnAddonId = this.dataset.addonId;
                var btnSettingId = this.dataset.settingId;
                var btnDomainIndex = this.dataset.domainIndex;
                saveDomainConfig(btnAddonId, btnSettingId, btnDomainIndex);
            });
        }

        var cancelBtn = modal.querySelector('[data-action="close-modal"]');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function () {
                closeDomainConfigModal();
            });
        }

        modal.addEventListener('click', function (e) {
            var removeSrvEggRowBtn = e.target.closest('[data-action="remove-srv-egg-service-row"]');
            if (removeSrvEggRowBtn) {
                var row = removeSrvEggRowBtn.closest('[data-srv-egg-service-row]');
                if (row) {
                    row.remove();
                }
                return;
            }

            if (e.target === modal) {
                closeDomainConfigModal();
            }
        });
    }
}

function closeDomainConfigModal() {
    var modal = document.querySelector('.te-modal-overlay[data-modal="domain-config"]');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(function () {
            modal.remove();
        }, 200);
    }
}

function saveDomainConfig(addonId, settingId, domainIndex) {
    var modal = document.querySelector('.te-modal-overlay[data-modal="domain-config"]');
    if (!modal) return;

    var domain = (modal.querySelector('[data-field="domain"]').value || '').toLowerCase().trim();
    var zoneId = (modal.querySelector('[data-field="zone_id"]').value || '').trim();
    var dnsIp = (modal.querySelector('[data-field="dns_ip"]').value || '').trim();
    var routingMode = modal.querySelector('[data-field="routing_mode"]').value || 'game';
    var srvEnabled = modal.querySelector('[data-field="srv_enabled"]').checked;
    var srvServiceMode = modal.querySelector('[data-field="srv_service_mode"]').value === 'per_egg' ? 'per_egg' : 'global';
    var srvService = normaliseSrvServiceValue(modal.querySelector('[data-field="srv_service"]').value, '_minecraft');
    var srvServiceDefault = normaliseSrvServiceValue(modal.querySelector('[data-field="srv_service_default"]').value || srvService, '_minecraft');
    var srvProtocol = modal.querySelector('[data-field="srv_protocol"]').value || '_tcp';
    var aRecordEnabled = modal.querySelector('[data-field="a_record_enabled"]').checked;
    var srvServiceByEgg = {};
    var srvProtocolByEgg = {};
    var rawSrvEggRows = modal.querySelectorAll('[data-srv-egg-service-row]');

    rawSrvEggRows.forEach(function (row) {
        var eggId = (row.querySelector('[data-field="srv_egg_id"]').value || '').trim();
        var serviceRaw = (row.querySelector('[data-field="srv_egg_service"]').value || '').trim();
        var protocol = (row.querySelector('[data-field="srv_egg_protocol"]').value || '_tcp').trim();

        if (!eggId && !serviceRaw) {
            return;
        }

        if (!eggId || !serviceRaw) {
            srvServiceByEgg.__hasInvalidRow = true;
            return;
        }

        var parsedEggId = parseInt(eggId);
        if (isNaN(parsedEggId)) {
            srvServiceByEgg.__hasInvalidRow = true;
            return;
        }

        var service = normaliseSrvServiceValue(serviceRaw, '');
        srvServiceByEgg[String(parsedEggId)] = service;
        srvProtocolByEgg[String(parsedEggId)] = protocol === '_udp' ? '_udp' : '_tcp';
    });

    if (!domain) {
        toast('Please enter a domain name', 'error');
        return;
    }

    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i.test(domain)) {
        toast('Please enter a valid domain (e.g., example.com)', 'error');
        return;
    }

    if (!zoneId) {
        toast('Please enter a CloudFlare Zone ID', 'error');
        return;
    }

    if (routingMode === 'web') {
        srvEnabled = false;
        aRecordEnabled = true;
    } else {
        if (srvServiceByEgg.__hasInvalidRow) {
            toast('Each per-egg SRV override must include both an egg and a service.', 'error');
            return;
        }

        if (srvEnabled && srvServiceMode === 'global' && !isValidSrvServiceValue(srvService)) {
            toast('Global SRV service must start with "_" and use only letters, numbers, "_" or "-".', 'error');
            return;
        }

        if (srvEnabled && srvServiceMode === 'per_egg' && !isValidSrvServiceValue(srvServiceDefault)) {
            toast('Default SRV service must start with "_" and use only letters, numbers, "_" or "-".', 'error');
            return;
        }

        if (srvEnabled && srvServiceMode === 'per_egg') {
            var invalidSrvEggService = Object.keys(srvServiceByEgg).find(function (eggId) {
                if (eggId === '__hasInvalidRow') {
                    return false;
                }
                return !isValidSrvServiceValue(srvServiceByEgg[eggId]);
            });
            if (invalidSrvEggService) {
                toast('Per-egg SRV services must start with "_" and use only letters, numbers, "_" or "-".', 'error');
                return;
            }
        }

        if (!srvEnabled && !aRecordEnabled) {
            toast('You must enable at least one DNS record type (SRV or A record).', 'error');
            return;
        }
    }

    if (srvServiceByEgg.__hasInvalidRow) {
        delete srvServiceByEgg.__hasInvalidRow;
    }

    var domainConfigs = normaliseDomainConfigs(getConfigValue('addons.' + addonId + '.settings.' + settingId, []));

    var isNew = domainIndex === 'new' || domainIndex === -1;

    var existingIdx = domainConfigs.findIndex(function (d, idx) {
        return d.domain === domain && (isNew || idx !== parseInt(domainIndex));
    });

    if (existingIdx !== -1) {
        toast('This domain already exists', 'error');
        return;
    }

    var newConfig = normaliseDomainConfig({
        domain: domain,
        zone_id: zoneId,
        dns_ip: dnsIp,
        routing_mode: routingMode === 'web' ? 'web' : 'game',
        srv_enabled: srvEnabled,
        srv_service_mode: srvServiceMode,
        srv_service: srvServiceMode === 'per_egg' ? srvServiceDefault : srvService,
        srv_service_default: srvServiceMode === 'per_egg' ? srvServiceDefault : srvService,
        srv_service_by_egg: srvServiceMode === 'per_egg' ? srvServiceByEgg : {},
        srv_protocol: srvProtocol,
        srv_protocol_by_egg: srvServiceMode === 'per_egg' ? srvProtocolByEgg : {},
        a_record_enabled: aRecordEnabled
    });

    if (isNew) {
        domainConfigs.push(newConfig);
    } else {
        domainConfigs[parseInt(domainIndex)] = newConfig;
    }

    setConfig('addons.' + addonId + '.settings.' + settingId, domainConfigs);

    closeDomainConfigModal();

    setTimeout(function() {
        refreshAddonSettingsPanel();
        toast(isNew ? 'Domain added' : 'Domain updated', 'success');
    }, 250);
}

function removeDomainConfig(addonId, settingId, domainIndex) {
    var domainConfigs = normaliseDomainConfigs(getConfigValue('addons.' + addonId + '.settings.' + settingId, []));

    var domainConfig = domainConfigs[domainIndex];
    if (!domainConfig) return;

    if (!confirm('Remove domain "' + domainConfig.domain + '"?')) return;

    domainConfigs.splice(domainIndex, 1);
    setConfig('addons.' + addonId + '.settings.' + settingId, domainConfigs);

    var item = document.querySelector('.te-domain-config-item[data-domain-index="' + domainIndex + '"]');
    if (item) item.remove();

    refreshAddonSettingsPanel();
    toast('Domain removed', 'success');
}

function moveDomainConfig(addonId, settingId, domainIndex, direction) {
    var domainConfigs = normaliseDomainConfigs(getConfigValue('addons.' + addonId + '.settings.' + settingId, []));
    var targetIndex = direction === 'up' ? domainIndex - 1 : domainIndex + 1;

    if (domainIndex < 0 || targetIndex < 0 || domainIndex >= domainConfigs.length || targetIndex >= domainConfigs.length) {
        return;
    }

    var movingDomain = domainConfigs[domainIndex];
    domainConfigs[domainIndex] = domainConfigs[targetIndex];
    domainConfigs[targetIndex] = movingDomain;

    setConfig('addons.' + addonId + '.settings.' + settingId, domainConfigs);
    refreshAddonSettingsPanel();
    toast(targetIndex === 0 ? 'Default domain updated' : 'Domain order updated', 'success');
}

function loadSignupOffers(callback) {
    if (!routes.freeServers) {
        signupOffers = [];
        signupOffersLoaded = true;
        if (callback) callback();
        return;
    }
    var offersUrl = routes.freeServers + (routes.freeServers.indexOf('?') === -1 ? '?' : '&') + '_t=' + Date.now();
    fetch(offersUrl, {
        cache: 'no-store',
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken }
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        var offers = Array.isArray(data) ? data : (data.offers || []);
        signupOffers = offers.map(function (offer) {
            return normaliseSignupOfferData(offer);
        });
        signupOffersLoaded = true;
        if (callback) callback();
    })
    .catch(function () {
        signupOffers = [];
        signupOffersLoaded = true;
        if (callback) callback();
    });
}

function loadSignupOfferClaims(callback) {
    if (!routes.freeServersClaims) {
        signupOfferClaims = [];
        signupOfferClaimsLoaded = true;
        if (callback) callback();
        return;
    }
    fetch(routes.freeServersClaims, {
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken }
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        signupOfferClaims = data.claims || [];
        signupOfferClaimsLoaded = true;
        if (callback) callback();
    })
    .catch(function () {
        signupOfferClaims = [];
        signupOfferClaimsLoaded = true;
        if (callback) callback();
    });
}

function toggleClaimsList() {
    signupOfferClaimsExpanded = !signupOfferClaimsExpanded;
    var panel = document.getElementById('te-claims-panel');
    var chevron = document.querySelector('.te-claims-chevron');
    if (panel) {
        if (signupOfferClaimsExpanded) {
            panel.classList.remove('te-claims-panel-hidden');
            if (chevron) chevron.classList.add('te-claims-chevron-open');
        } else {
            panel.classList.add('te-claims-panel-hidden');
            if (chevron) chevron.classList.remove('te-claims-chevron-open');
        }
    }
}

function setupClaimsSearch() {
    var searchInput = document.getElementById('te-claims-search');
    var filterSelect = document.getElementById('te-claims-filter');
    if (!searchInput && !filterSelect) return;

    var doFilter = function () {
        var query = (searchInput ? searchInput.value : '').toLowerCase().trim();
        var status = filterSelect ? filterSelect.value : '';
        var rows = document.querySelectorAll('.te-claims-row');
        var visible = 0;
        rows.forEach(function (row) {
            var searchText = row.dataset.search || '';
            var rowStatus = row.dataset.status || '';
            var matchSearch = !query || searchText.indexOf(query) !== -1;
            var matchStatus = !status || rowStatus === status;
            if (matchSearch && matchStatus) {
                row.style.display = '';
                visible++;
            } else {
                row.style.display = 'none';
            }
        });
        var emptyEl = document.getElementById('te-claims-empty');
        if (emptyEl) {
            emptyEl.style.display = visible === 0 && rows.length > 0 ? 'block' : 'none';
        }
    };

    if (searchInput) searchInput.addEventListener('input', doFilter);
    if (filterSelect) filterSelect.addEventListener('change', doFilter);
}

function openOfferModal(offer) {
    var isNew = !offer;
    var data = normaliseSignupOfferData(offer || {
        name: '', description: '', server_name_template: '{username} Server', server_description: '',
        nest_id: '', egg_id: '', location_ids: [], dedicated_ip: false,
        memory: 1024, swap: 0, disk: 5120, io: 500, cpu: 100, threads: '',
        oom_disabled: true, database_limit: 0, allocation_limit: 0, backup_limit: 0,
        startup: '', image: '', environment: {}, start_on_completion: true,
        availability_type: 'register', target_type: 'all', target_users: [], claim_expiry_days: '', server_expiry_days: '', enabled: true
    });

    offerModalSelectedUsers = [];
    if (data.target_type === 'specific' && Array.isArray(data.target_users)) {
        data.target_users.forEach(function (uid) {
            offerModalSelectedUsers.push({ id: uid, username: 'User #' + uid });
        });
    }

    var nestOptionsHtml = '';
    nests.forEach(function (nest) {
        nestOptionsHtml += '<option value="' + nest.id + '"' + (parseInt(nest.id) === data.nest_id ? ' selected' : '') + '>' + esc(nest.name) + '</option>';
    });

    var eggOptionsHtml = '';
    if (data.nest_id) {
        var selectedNest = nests.find(function (n) { return parseInt(n.id) === data.nest_id; });
        if (selectedNest && selectedNest.eggs) {
            selectedNest.eggs.forEach(function (egg) {
                eggOptionsHtml += '<option value="' + egg.id + '"' + (parseInt(egg.id) === data.egg_id ? ' selected' : '') + '>' + esc(egg.name) + '</option>';
            });
        }
    }

    var locationOptionsHtml = '';
    var locationTemplate = getTemplate('te-offer-location-checkbox');
    var selectedLocationIds = data.location_ids.map(function (id) { return String(id); });
    locations.forEach(function (loc) {
        locationOptionsHtml += replaceAll(locationTemplate, {
            'LOCATION_ID': loc.id,
            'LOCATION_NAME': esc(loc.short + (loc.long ? ' (' + loc.long + ')' : ''))
        });
    });

    var selectedUsersHtml = '';
    var userTagTemplate = getTemplate('te-offer-selected-user');
    offerModalSelectedUsers.forEach(function (u) {
        selectedUsersHtml += replaceAll(userTagTemplate, {
            'USER_ID': u.id,
            'USER_NAME': esc(u.username || u.email || 'User #' + u.id)
        });
    });

    var template = getTemplate('te-offer-modal');
    var modalHtml = replaceAll(template, {
        'MODAL_TITLE': isNew ? 'New Offer' : 'Edit Offer',
        'OFFER_ID': isNew ? 'new' : data.id,
        'OFFER_NAME': esc(data.name || ''),
        'OFFER_DESCRIPTION': esc(data.description || ''),
        'SERVER_NAME_TEMPLATE': esc(data.server_name_template || '{username} Server'),
        'SERVER_DESCRIPTION': esc(data.server_description || ''),
        'NEST_OPTIONS': nestOptionsHtml,
        'EGG_OPTIONS': eggOptionsHtml,
        'LOCATION_OPTIONS': locationOptionsHtml,
        'IMAGE_VALUE': esc(data.image || ''),
        'STARTUP_VALUE': esc(data.startup || ''),
        'MEMORY_VALUE': data.memory || 1024,
        'SWAP_VALUE': data.swap !== undefined ? data.swap : 0,
        'DISK_VALUE': data.disk || 5120,
        'CPU_VALUE': data.cpu !== undefined ? data.cpu : 100,
        'IO_VALUE': data.io || 500,
        'THREADS_VALUE': esc(data.threads || ''),
        'DATABASE_LIMIT': data.database_limit || 0,
        'ALLOCATION_LIMIT': data.allocation_limit || 0,
        'BACKUP_LIMIT': data.backup_limit || 0,
        'SELECTED_USERS_HTML': selectedUsersHtml,
        'CLAIM_EXPIRY_DAYS': data.claim_expiry_days || '',
        'SERVER_EXPIRY_DAYS': data.server_expiry_days || '',
        'SAVE_BUTTON_TEXT': isNew ? 'Create Offer' : 'Save Offer'
    });

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    var modal = document.querySelector('.te-modal-overlay[data-modal="offer-config"]');
    if (!modal) return;

    modal.querySelector('[data-field="dedicated_ip"]').checked = data.dedicated_ip;
    modal.querySelector('[data-field="oom_disabled"]').checked = data.oom_disabled;
    modal.querySelector('[data-field="start_on_completion"]').checked = data.start_on_completion;
    modal.querySelector('[data-field="enabled"]').checked = data.enabled;
    modal.querySelector('[data-field="availability_type"]').value = data.availability_type;
    modal.querySelector('[data-field="target_type"]').value = data.target_type;
    var targetUsersWrap = modal.querySelector('#te-offer-target-users-wrap');
    if (targetUsersWrap) targetUsersWrap.hidden = data.target_type !== 'specific';
    modal.querySelectorAll('[data-location-id]').forEach(function (cb) {
        cb.checked = selectedLocationIds.indexOf(String(cb.dataset.locationId)) !== -1;
    });

    setTimeout(function () { modal.classList.add('visible'); }, 10);

    var nestSelect = modal.querySelector('[data-field="nest_id"]');
    var eggSelect = modal.querySelector('[data-field="egg_id"]');

    if (nestSelect) {
        nestSelect.addEventListener('change', function () {
            var nestId = parseInt(this.value);
            var nest = nests.find(function (n) { return n.id === nestId; });
            eggSelect.innerHTML = '<option value="">Select an egg...</option>';
            if (nest && nest.eggs) {
                nest.eggs.forEach(function (egg) {
                    var opt = document.createElement('option');
                    opt.value = egg.id;
                    opt.textContent = egg.name;
                    eggSelect.appendChild(opt);
                });
            }
            renderOfferEnvFields(modal, null, {});
        });
    }

    if (eggSelect) {
        eggSelect.addEventListener('change', function () {
            var eggId = parseInt(this.value);
            if (eggId) {
                fetchEggVariables(eggId, function (vars) {
                    renderOfferEnvFields(modal, vars, data.environment || {});
                });
            } else {
                renderOfferEnvFields(modal, null, {});
            }
        });
    }

    var targetSelect = modal.querySelector('[data-field="target_type"]');
    var targetUsersWrap = modal.querySelector('#te-offer-target-users-wrap');
    if (targetSelect && targetUsersWrap) {
        targetSelect.addEventListener('change', function () {
            if (this.value === 'specific') {
                targetUsersWrap.removeAttribute('hidden');
            } else {
                targetUsersWrap.setAttribute('hidden', '');
            }
        });
    }

    var userSearchInput = modal.querySelector('#te-offer-user-search');
    var userResultsDiv = modal.querySelector('#te-offer-user-results');
    var searchTimeout = null;
    if (userSearchInput && userResultsDiv) {
        userSearchInput.addEventListener('input', function () {
            var q = this.value.trim();
            clearTimeout(searchTimeout);
            if (q.length < 2) {
                userResultsDiv.style.display = 'none';
                userResultsDiv.innerHTML = '';
                return;
            }
            searchTimeout = setTimeout(function () {
                fetch(routes.freeServersSearchUsers + '?q=' + encodeURIComponent(q), {
                    headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken }
                })
                .then(function (r) { return r.json(); })
                .then(function (users) {
                    userResultsDiv.innerHTML = '';
                    if (users.length === 0) {
                        userResultsDiv.innerHTML = '<div class="te-offer-user-result-item" style="color: var(--te-muted);">No users found</div>';
                    } else {
                        users.forEach(function (u) {
                            var alreadySelected = offerModalSelectedUsers.some(function (s) { return s.id === u.id; });
                            if (!alreadySelected) {
                                var item = document.createElement('div');
                                item.className = 'te-offer-user-result-item';
                                item.textContent = u.username + ' (' + u.email + ')';
                                item.addEventListener('click', function () {
                                    offerModalSelectedUsers.push(u);
                                    renderSelectedUsers();
                                    userResultsDiv.style.display = 'none';
                                    userSearchInput.value = '';
                                });
                                userResultsDiv.appendChild(item);
                            }
                        });
                    }
                    userResultsDiv.style.display = 'block';
                })
                .catch(function () {
                    userResultsDiv.style.display = 'none';
                });
            }, 300);
        });
    }

    var saveBtn = modal.querySelector('[data-action="save-offer"]');
    if (saveBtn) {
        saveBtn.addEventListener('click', function () {
            saveOffer(this.dataset.offerId);
        });
    }

    var closeBtns = modal.querySelectorAll('[data-action="close-offer-modal"]');
    closeBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            closeOfferModal();
        });
    });

    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeOfferModal();
    });

    if (data.egg_id) {
        fetchEggVariables(data.egg_id, function (vars) {
            renderOfferEnvFields(modal, vars, data.environment || {});
        });
    }
}

function renderSelectedUsers() {
    var container = document.querySelector('#te-offer-selected-users');
    if (!container) return;
    var userTagTemplate = getTemplate('te-offer-selected-user');
    var html = '';
    offerModalSelectedUsers.forEach(function (u) {
        html += replaceAll(userTagTemplate, {
            'USER_ID': u.id,
            'USER_NAME': esc(u.username || u.email || 'User #' + u.id)
        });
    });
    container.innerHTML = html;
}

function fetchEggVariables(eggId, callback) {
    if (offerEggVariablesCache[eggId]) {
        callback(offerEggVariablesCache[eggId]);
        return;
    }
    fetch(routes.freeServersEggVariables + eggId, {
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken }
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        offerEggVariablesCache[eggId] = data;
        callback(data);
    })
    .catch(function () {
        callback(null);
    });
}

function renderOfferEnvFields(modal, eggData, existingEnv) {
    var container = modal.querySelector('#te-offer-env-container');
    if (!container) return;

    if (!eggData || !eggData.variables || eggData.variables.length === 0) {
        container.innerHTML = '<p class="te-help-text">Select an egg to load its environment variables</p>';
        return;
    }

    var envTemplate = getTemplate('te-offer-env-field');
    var html = '';
    eggData.variables.forEach(function (v) {
        var existingVal = existingEnv && existingEnv[v.env_variable] !== undefined ? existingEnv[v.env_variable] : '';
        html += replaceAll(envTemplate, {
            'VAR_NAME': esc(v.name),
            'VAR_ENV_KEY': esc(v.env_variable),
            'VAR_DEFAULT': esc(v.default_value || ''),
            'VAR_VALUE': esc(existingVal),
            'VAR_DESCRIPTION': esc(v.description || '')
        });
    });
    container.innerHTML = html;
}

function closeOfferModal() {
    var modal = document.querySelector('.te-modal-overlay[data-modal="offer-config"]');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(function () { modal.remove(); }, 200);
    }
}

function saveOffer(offerId) {
    var modal = document.querySelector('.te-modal-overlay[data-modal="offer-config"]');
    if (!modal) return;
    if (offerSaveInFlight) return;

    var isNew = offerId === 'new';

    var name = (modal.querySelector('[data-field="name"]').value || '').trim();
    if (!name) {
        toast('Please enter an offer name', 'error');
        return;
    }

    var nestId = parseInt(modal.querySelector('[data-field="nest_id"]').value);
    var eggId = parseInt(modal.querySelector('[data-field="egg_id"]').value);
    if (!nestId || !eggId) {
        toast('Please select a nest and egg', 'error');
        return;
    }

    var locationCheckboxes = modal.querySelectorAll('[data-location-id]:checked');
    var locationIds = [];
    locationCheckboxes.forEach(function (cb) { locationIds.push(parseInt(cb.dataset.locationId)); });
    if (locationIds.length === 0) {
        toast('Please select at least one location', 'error');
        return;
    }

    var environment = {};
    var envFields = modal.querySelectorAll('[data-env-key]');
    envFields.forEach(function (field) {
        environment[field.dataset.envKey] = field.value;
    });

    var targetType = modal.querySelector('[data-field="target_type"]').value;
    var availabilityType = modal.querySelector('[data-field="availability_type"]').value;
    var targetUsers = null;
    if (targetType === 'specific') {
        targetUsers = offerModalSelectedUsers.map(function (u) { return u.id; });
    }

    var payload = {
        name: name,
        description: (modal.querySelector('[data-field="description"]').value || '').trim() || null,
        server_name_template: (modal.querySelector('[data-field="server_name_template"]').value || '').trim() || '{username} Server',
        server_description: (modal.querySelector('[data-field="server_description"]').value || '').trim() || null,
        nest_id: nestId,
        egg_id: eggId,
        location_ids: locationIds,
        dedicated_ip: modal.querySelector('[data-field="dedicated_ip"]').checked,
        memory: parseInt(modal.querySelector('[data-field="memory"]').value) || 0,
        swap: parseInt(modal.querySelector('[data-field="swap"]').value) || 0,
        disk: parseInt(modal.querySelector('[data-field="disk"]').value) || 0,
        io: parseInt(modal.querySelector('[data-field="io"]').value) || 500,
        cpu: parseInt(modal.querySelector('[data-field="cpu"]').value) || 0,
        threads: (modal.querySelector('[data-field="threads"]').value || '').trim() || null,
        oom_disabled: modal.querySelector('[data-field="oom_disabled"]').checked,
        database_limit: parseInt(modal.querySelector('[data-field="database_limit"]').value) || 0,
        allocation_limit: parseInt(modal.querySelector('[data-field="allocation_limit"]').value) || 0,
        backup_limit: parseInt(modal.querySelector('[data-field="backup_limit"]').value) || 0,
        startup: (modal.querySelector('[data-field="startup"]').value || '').trim() || null,
        image: (modal.querySelector('[data-field="image"]').value || '').trim() || null,
        environment: environment,
        start_on_completion: modal.querySelector('[data-field="start_on_completion"]').checked,
        availability_type: availabilityType,
        target_type: targetType,
        target_users: targetUsers,
        claim_expiry_days: parseInt(modal.querySelector('[data-field="claim_expiry_days"]').value) || null,
        server_expiry_days: parseInt(modal.querySelector('[data-field="server_expiry_days"]').value) || null,
        enabled: modal.querySelector('[data-field="enabled"]').checked
    };

    var url = isNew ? routes.freeServers : routes.freeServers + '/' + offerId;
    var method = isNew ? 'POST' : 'PATCH';

    offerSaveInFlight = true;
    showLoading(true);
    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        offerSaveInFlight = false;
        showLoading(false);
        if (data.success) {
            closeOfferModal();
            loadSignupOffers(function () {
                refreshAddonSettingsPanel();
                toast(isNew ? 'Offer created' : 'Offer updated', 'success');
            });
        } else if (data.errors) {
            var saveAllErrors = [];
            Object.keys(data.errors).forEach(function (key) {
                if (Array.isArray(data.errors[key])) {
                    saveAllErrors = saveAllErrors.concat(data.errors[key]);
                }
            });
            toast(saveAllErrors[0] || data.message || 'Validation error', 'error');
        } else {
            toast(data.error || data.message || 'Failed to save', 'error');
        }
    })
    .catch(function () {
        offerSaveInFlight = false;
        showLoading(false);
        toast('Failed to save offer', 'error');
    });
}

function removeOffer(offerId) {
    var offer = signupOffers.find(function (o) { return o.id === offerId; });
    if (!offer) return;
    if (!confirm('Delete offer "' + offer.name + '"? This cannot be undone.')) return;

    showLoading(true);
    fetch(routes.freeServers + '/' + offerId, {
        method: 'DELETE',
        headers: { 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' }
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        showLoading(false);
        if (data.success) {
            loadSignupOffers(function () {
                refreshAddonSettingsPanel();
                toast('Offer deleted', 'success');
            });
        } else {
            toast(data.error || 'Failed to delete', 'error');
        }
    })
    .catch(function () {
        showLoading(false);
        toast('Failed to delete offer', 'error');
    });
}

function openIssueOfferModal() {
    if (signupOffers.length === 0) {
        toast('No offers available. Create an offer first.', 'error');
        return;
    }

    issueModalSelectedUsers = [];

    var offerOptionsHtml = '';
    signupOffers.forEach(function (offer) {
        offerOptionsHtml += '<option value="' + offer.id + '">' + esc(offer.name) + ' (' + esc(offer.egg_name || 'Unknown') + ')</option>';
    });

    var template = getTemplate('te-issue-offer-modal');
    var modalHtml = replaceAll(template, {
        'OFFER_SELECT_OPTIONS': offerOptionsHtml
    });

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    var modal = document.querySelector('.te-modal-overlay[data-modal="issue-offer"]');
    if (!modal) return;

    setTimeout(function () { modal.classList.add('visible'); }, 10);

    var userSearchInput = modal.querySelector('#te-issue-user-search');
    var userResultsDiv = modal.querySelector('#te-issue-user-results');
    var searchTimeout = null;

    if (userSearchInput && userResultsDiv) {
        userSearchInput.addEventListener('input', function () {
            var q = this.value.trim();
            clearTimeout(searchTimeout);
            if (q.length < 2) {
                userResultsDiv.style.display = 'none';
                userResultsDiv.innerHTML = '';
                return;
            }
            searchTimeout = setTimeout(function () {
                fetch(routes.freeServersSearchUsers + '?q=' + encodeURIComponent(q), {
                    headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken }
                })
                .then(function (r) { return r.json(); })
                .then(function (users) {
                    userResultsDiv.innerHTML = '';
                    if (users.length === 0) {
                        userResultsDiv.innerHTML = '<div class="te-offer-user-result-item" style="color: var(--te-muted);">No users found</div>';
                    } else {
                        users.forEach(function (u) {
                            var alreadySelected = issueModalSelectedUsers.some(function (s) { return s.id === u.id; });
                            if (!alreadySelected) {
                                var item = document.createElement('div');
                                item.className = 'te-offer-user-result-item';
                                item.textContent = u.username + ' (' + u.email + ')';
                                item.addEventListener('click', function () {
                                    issueModalSelectedUsers.push(u);
                                    renderIssueSelectedUsers();
                                    userResultsDiv.style.display = 'none';
                                    userSearchInput.value = '';
                                });
                                userResultsDiv.appendChild(item);
                            }
                        });
                    }
                    userResultsDiv.style.display = 'block';
                })
                .catch(function () {
                    userResultsDiv.style.display = 'none';
                });
            }, 300);
        });
    }

    var submitBtn = modal.querySelector('[data-action="submit-issue-offer"]');
    if (submitBtn) {
        submitBtn.addEventListener('click', function () {
            submitIssueOffer();
        });
    }

    var issueCloseBtns = modal.querySelectorAll('[data-action="close-issue-modal"]');
    issueCloseBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            closeIssueOfferModal();
        });
    });

    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeIssueOfferModal();
    });
}

function renderIssueSelectedUsers() {
    var container = document.querySelector('#te-issue-selected-users');
    if (!container) return;
    var userTagTemplate = getTemplate('te-offer-selected-user');
    var html = '';
    issueModalSelectedUsers.forEach(function (u) {
        html += replaceAll(userTagTemplate, {
            'USER_ID': u.id,
            'USER_NAME': esc(u.username || u.email || 'User #' + u.id)
        });
    });
    container.innerHTML = html;
}

function closeIssueOfferModal() {
    var modal = document.querySelector('.te-modal-overlay[data-modal="issue-offer"]');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(function () { modal.remove(); }, 200);
    }
}

function submitIssueOffer() {
    var modal = document.querySelector('.te-modal-overlay[data-modal="issue-offer"]');
    if (!modal) return;

    var offerId = parseInt(modal.querySelector('[data-field="issue_offer_id"]').value);
    if (!offerId) {
        toast('Please select an offer', 'error');
        return;
    }

    if (issueModalSelectedUsers.length === 0) {
        toast('Please select at least one user', 'error');
        return;
    }

    var claimExpiry = parseInt(modal.querySelector('[data-field="issue_claim_expiry_days"]').value) || null;
    var serverExpiry = parseInt(modal.querySelector('[data-field="issue_server_expiry_days"]').value) || null;

    var payload = {
        offer_id: offerId,
        user_ids: issueModalSelectedUsers.map(function (u) { return u.id; })
    };
    if (claimExpiry) payload.claim_expiry_days = claimExpiry;
    if (serverExpiry) payload.server_expiry_days = serverExpiry;

    showLoading(true);
    fetch(routes.freeServersIssue, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
        showLoading(false);
        if (data.success) {
            closeIssueOfferModal();
            var msg = 'Issued to ' + data.issued + ' user(s)';
            if (data.skipped > 0) msg += ', ' + data.skipped + ' skipped (already have pending/active claim)';
            toast(msg, 'success');
            signupOfferClaimsLoaded = false;
            loadSignupOffers(function () { refreshAddonSettingsPanel(); });
        } else if (data.errors) {
            var allErrors = [];
            Object.keys(data.errors).forEach(function (key) {
                if (Array.isArray(data.errors[key])) {
                    allErrors = allErrors.concat(data.errors[key]);
                }
            });
            toast(allErrors[0] || data.message || 'Validation error', 'error');
        } else {
            toast(data.error || data.message || 'Failed to issue', 'error');
        }
    })
    .catch(function () {
        showLoading(false);
        toast('Failed to issue offer', 'error');
    });
}

function openEggConfigModal(addonId, settingId, eggId) {
    var eggConfigMap = getConfigValue('addons.' + addonId + '.settings.' + settingId, {});
    if (typeof eggConfigMap !== 'object' || Array.isArray(eggConfigMap)) eggConfigMap = {};

    var eggConf = eggConfigMap[String(eggId)] || {};
    var allowedTargets = Array.isArray(eggConf.allowed_targets) ? eggConf.allowed_targets : [];
    var srvService = eggConf.srv_service || '';
    var srvProtocol = eggConf.srv_protocol || '';
    var connectionDisplayMode = eggConf.connection_display_mode || 'srv';

    var egg = eggs.find(function (e) { return e.id === parseInt(eggId); });
    var eggName = egg ? egg.name : 'Egg #' + eggId;

    var availableEggIds = getConfigValue('addons.' + addonId + '.settings.available_eggs', []);
    var targetOptionsHtml = '';

    if (Array.isArray(availableEggIds)) {
        availableEggIds.forEach(function (targetEggId) {
            if (String(targetEggId) === String(eggId)) return;
            var targetEgg = eggs.find(function (e) { return e.id === targetEggId; });
            if (!targetEgg) return;
            var isSelected = allowedTargets.indexOf(targetEggId) !== -1;
            targetOptionsHtml += '<label class="te-egg-selector-item' + (isSelected ? ' selected' : '') + '">';
            targetOptionsHtml += '<input type="checkbox" data-target-egg-id="' + targetEggId + '"' + (isSelected ? ' checked' : '') + '>';
            targetOptionsHtml += '<span class="te-egg-selector-name">' + esc(targetEgg.name) + '</span>';
            targetOptionsHtml += '<span class="te-egg-selector-nest">' + esc(targetEgg.nest_name) + '</span>';
            targetOptionsHtml += '</label>';
        });
    }

    if (!targetOptionsHtml) {
        targetOptionsHtml = '<div class="te-egg-selector-empty">No other available eggs to configure as targets</div>';
    }

    var template = getTemplate('te-egg-config-modal');
    var modalHtml = replaceAll(template, {
        'ADDON_ID': addonId,
        'SETTING_ID': settingId,
        'EGG_ID': String(eggId),
        'EGG_NAME': esc(eggName),
        'SRV_SERVICE_VALUE': esc(srvService),
        'SRV_NONE_SELECTED': !srvProtocol ? 'selected' : '',
        'SRV_TCP_SELECTED': srvProtocol === '_tcp' ? 'selected' : '',
        'SRV_UDP_SELECTED': srvProtocol === '_udp' ? 'selected' : '',
        'CONNECTION_DISPLAY_SRV_SELECTED': connectionDisplayMode === 'srv' ? 'selected' : '',
        'CONNECTION_DISPLAY_IP_PORT_SELECTED': connectionDisplayMode === 'ip_port' ? 'selected' : '',
        'TARGET_COUNT': allowedTargets.length,
        'TARGET_EGG_OPTIONS': targetOptionsHtml
    });

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    var modal = document.querySelector('.te-modal-overlay[data-modal="egg-config"]');
    if (modal) {
        setTimeout(function () { modal.classList.add('visible'); }, 10);

        var searchInput = modal.querySelector('.te-egg-config-target-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                var term = this.value.toLowerCase();
                var items = modal.querySelectorAll('.te-egg-selector-item');
                items.forEach(function (item) {
                    var name = item.querySelector('.te-egg-selector-name');
                    var nest = item.querySelector('.te-egg-selector-nest');
                    var text = ((name ? name.textContent : '') + ' ' + (nest ? nest.textContent : '')).toLowerCase();
                    item.style.display = (!term || text.indexOf(term) !== -1) ? '' : 'none';
                });
            });
        }

        modal.querySelectorAll('.te-egg-selector-item input[type="checkbox"]').forEach(function (cb) {
            cb.addEventListener('change', function () {
                var item = this.closest('.te-egg-selector-item');
                if (item) {
                    if (this.checked) item.classList.add('selected');
                    else item.classList.remove('selected');
                }
                var count = modal.querySelectorAll('.te-egg-selector-item input[type="checkbox"]:checked').length;
                var countEl = modal.querySelector('[data-target-count]');
                if (countEl) countEl.textContent = count + ' selected';
            });
        });

        var saveBtn = modal.querySelector('[data-action="save-egg-config"]');
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                saveEggConfig(this.dataset.addonId, this.dataset.settingId, this.dataset.eggId);
            });
        }

        var cancelBtns = modal.querySelectorAll('[data-action="close-egg-config-modal"]');
        cancelBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                closeEggConfigModal();
            });
        });

        modal.addEventListener('click', function (e) {
            if (e.target === modal) closeEggConfigModal();
        });
    }
}

function closeEggConfigModal() {
    var modal = document.querySelector('.te-modal-overlay[data-modal="egg-config"]');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(function () { modal.remove(); }, 200);
    }
}

function saveEggConfig(addonId, settingId, eggId) {
    var modal = document.querySelector('.te-modal-overlay[data-modal="egg-config"]');
    if (!modal) return;

    var srvService = (modal.querySelector('[data-field="srv_service"]').value || '').trim();
    var srvProtocol = modal.querySelector('[data-field="srv_protocol"]').value || '';
    var connectionDisplayMode = modal.querySelector('[data-field="connection_display_mode"]').value || 'srv';

    var allowedTargets = [];
    modal.querySelectorAll('[data-target-egg-id]').forEach(function (cb) {
        if (cb.checked) {
            allowedTargets.push(parseInt(cb.dataset.targetEggId));
        }
    });

    var eggConfigMap = getConfigValue('addons.' + addonId + '.settings.' + settingId, {});
    if (typeof eggConfigMap !== 'object' || Array.isArray(eggConfigMap)) eggConfigMap = {};

    eggConfigMap[String(eggId)] = {
        srv_service: srvService,
        srv_protocol: srvProtocol,
        connection_display_mode: connectionDisplayMode,
        allowed_targets: allowedTargets
    };

    setConfig('addons.' + addonId + '.settings.' + settingId, eggConfigMap);

    closeEggConfigModal();

    setTimeout(function () {
        refreshAddonSettingsPanel();
        toast('Egg configuration saved', 'success');
    }, 250);
}

function resetEggConfig(addonId, settingId, eggId) {
    var eggConfigMap = getConfigValue('addons.' + addonId + '.settings.' + settingId, {});
    if (typeof eggConfigMap !== 'object' || Array.isArray(eggConfigMap)) eggConfigMap = {};

    delete eggConfigMap[String(eggId)];

    setConfig('addons.' + addonId + '.settings.' + settingId, eggConfigMap);
    refreshAddonSettingsPanel();
    toast('Egg configuration reset', 'success');
}

function refreshAddonSettingsPanel() {
    if (activeAddonSettings) {
        openAddonSettings(activeAddonSettings);
    }
}

function normaliseNavLinksForSave() {
    var categories = getConfigValue('layout.nav_links.categories', []);

    if (!Array.isArray(categories)) {
        return;
    }

    categories.sort(function (a, b) {
        var orderA = a && (a.order === 0 || a.order) ? a.order : 999;
        var orderB = b && (b.order === 0 || b.order) ? b.order : 999;
        return orderA - orderB;
    });

    categories.forEach(function (category, categoryIndex) {
        category.order = categoryIndex;

        var links = category && Array.isArray(category.links) ? category.links : [];

        if (!Array.isArray(links)) {
            links = [];
        }

        links.sort(function (a, b) {
            var orderA = a && (a.order === 0 || a.order) ? a.order : 999;
            var orderB = b && (b.order === 0 || b.order) ? b.order : 999;
            return orderA - orderB;
        });

        links.forEach(function (link, linkIndex) {
            if (link && typeof link === 'object') {
                link.order = linkIndex;
            }
        });

        category.links = links;
    });

    setConfig('layout.nav_links.categories', categories);
}

function normaliseSubdomainDomainsForSave() {
    var domains = getConfigValue('addons.subdomains_manager.settings.domains', []);
    setConfig('addons.subdomains_manager.settings.domains', normaliseDomainConfigs(domains));
}

function markUnsaved() {
    unsavedChanges = true;
}

function updateBillingPlatformFields(platform) {
    var resolvedPlatform = platform === 'paymenter' ? 'paymenter' : 'whmcs';

    document.querySelectorAll('[data-billing-platform-field]').forEach(function (field) {
        if (field.getAttribute('data-billing-platform-field') === resolvedPlatform) {
            field.removeAttribute('hidden');
        } else {
            field.setAttribute('hidden', '');
        }
    });
}

function refreshPanel() {
    var panel = document.getElementById('panelContent');
    if (panel) {
        panel.innerHTML = renderTabContent();
        processDataChecked(panel);
        if (activeTab === 'advanced') {
            updateBillingPlatformFields(getConfigValue('advanced.billing_integration.platform', 'whmcs'));
        }
        if (activeTab === 'announcements') {
            initAnnouncementsTab();
        }
        if (activeTab === 'layout' || activeTab === 'links') {
            setTimeout(initDragAndDrop, 0);
        }
        return;
    }

    if (activeTab === 'import-eggs') {
        render();
    }
}

var sortableInstances = [];

function initDragAndDrop() {
    sortableInstances.forEach(function(instance) {
        if (instance && instance.destroy) {
            instance.destroy();
        }
    });
    sortableInstances = [];

    if (typeof Sortable === 'undefined') {
        return;
    }

    var navCategoriesContainer = document.querySelector('[data-sortable="nav-categories"]');
    if (navCategoriesContainer) {
        var sortable = Sortable.create(navCategoriesContainer, {
            animation: 150,
            handle: '.te-nav-category-card',
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                if (evt.oldIndex === evt.newIndex) return;
                
                var categories = getConfigValue('layout.nav_links.categories', []);
                if (!Array.isArray(categories)) return;
                
                categories.forEach(function(c, i) {
                    if (c && typeof c === 'object') {
                        c.order = i;
                    }
                });
                
                var sortedCategories = categories.map(function(cat, i) {
                    return { category: cat, originalIndex: i };
                }).sort(function(a, b) {
                    var orderA = a.category && (a.category.order === 0 || a.category.order) ? a.category.order : a.originalIndex;
                    var orderB = b.category && (b.category.order === 0 || b.category.order) ? b.category.order : b.originalIndex;
                    return orderA - orderB;
                });
                
                var movedItem = sortedCategories.splice(evt.oldIndex, 1)[0];
                sortedCategories.splice(evt.newIndex, 0, movedItem);
                
                sortedCategories.forEach(function(item, newOrder) {
                    item.category.order = newOrder;
                });
                
                setConfig('layout.nav_links.categories', categories);
            }
        });
        sortableInstances.push(sortable);
    }

    document.querySelectorAll('[data-sortable-links]').forEach(function(container) {
        var catIndex = parseInt(container.dataset.sortableLinks, 10);
        if (isNaN(catIndex)) return;
        
        var sortable = Sortable.create(container, {
            animation: 150,
            handle: '.te-nav-link-card',
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                if (evt.oldIndex === evt.newIndex) return;
                
                var catPath = 'layout.nav_links.categories.' + catIndex;
                var linksPath = catPath + '.links';
                var links = getConfigValue(linksPath, []);
                if (!Array.isArray(links)) return;
                
                var movedLink = links.splice(evt.oldIndex, 1)[0];
                links.splice(evt.newIndex, 0, movedLink);
                
                links.forEach(function(l, i) {
                    if (l && typeof l === 'object') {
                        l.order = i;
                    }
                });
                
                setConfig(linksPath, links);
            }
        });
        sortableInstances.push(sortable);
    });

    var dashboardLinksContainer = document.querySelector('[data-sortable="dashboard-custom-links"]');
    if (dashboardLinksContainer) {
        var sortable = Sortable.create(dashboardLinksContainer, {
            animation: 150,
            handle: '.te-custom-link-item',
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                if (evt.oldIndex === evt.newIndex) return;
                
                var links = getConfigValue('layout.dashboard_custom_links', []);
                if (!Array.isArray(links)) return;
                
                var movedLink = links.splice(evt.oldIndex, 1)[0];
                links.splice(evt.newIndex, 0, movedLink);
                
                setConfig('layout.dashboard_custom_links', links);
            }
        });
        sortableInstances.push(sortable);
    }

    var accountLinksContainer = document.querySelector('[data-sortable="account-custom-links"]');
    if (accountLinksContainer) {
        var sortable = Sortable.create(accountLinksContainer, {
            animation: 150,
            handle: '.te-custom-link-item',
            ghostClass: 'sortable-ghost',
            onEnd: function(evt) {
                if (evt.oldIndex === evt.newIndex) return;
                
                var links = getConfigValue('layout.account_custom_links', []);
                if (!Array.isArray(links)) return;
                
                var movedLink = links.splice(evt.oldIndex, 1)[0];
                links.splice(evt.newIndex, 0, movedLink);
                
                setConfig('layout.account_custom_links', links);
            }
        });
        sortableInstances.push(sortable);
    }
}

function processDataChecked(container) {
    if (!container) return;

    container.querySelectorAll('input[type="checkbox"][data-checked]').forEach(function (checkbox) {
        var value = checkbox.getAttribute('data-checked');
        if (!value || value.indexOf('{{') !== -1) return;
        checkbox.checked = value === 'true';
    });
}

function setDevice(device) {
    if (device === 'tablet') previewWidth = 768;
    else if (device === 'mobile') previewWidth = 375;
    else previewWidth = null;

    var container = document.getElementById('previewContainer');
    var sizeLabel = document.getElementById('viewportSize');

    container.style.width = previewWidth ? previewWidth + 'px' : '100%';
    sizeLabel.textContent = previewWidth ? previewWidth + 'px' : 'Responsive';

    document.querySelectorAll('.te-device-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.device === device);
    });
}

function startResize(e, direction) {
    e.preventDefault();
    var overlay = document.getElementById('resizeOverlay');
    var container = document.getElementById('previewContainer');
    var startX = e.clientX;
    var startWidth = container.offsetWidth;

    overlay.classList.add('active');
    container.classList.add('resizing');

    function onMove(e) {
        var diff = direction === 'right' ? e.clientX - startX : startX - e.clientX;
        var newWidth = Math.max(320, Math.min(startWidth + diff * 2, window.innerWidth - 500));
        previewWidth = Math.round(newWidth);
        container.style.width = newWidth + 'px';
        document.getElementById('viewportSize').textContent = Math.round(newWidth) + 'px';
        document.querySelectorAll('.te-device-btn').forEach(function (b) { b.classList.remove('active'); });
    }

    function onUp() {
        overlay.classList.remove('active');
        container.classList.remove('resizing');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function exportConfigFile() {
    if (!routes.themeExport) {
        toast('Export route is unavailable', 'error');
        return;
    }

    setConfigMenuState(false);
    showLoading(true);
    var exportUrl = appendActiveAccessPayloadToUrl(new URL(routes.themeExport, window.location.origin));
    fetch(exportUrl.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json', 'X-CSRF-TOKEN': csrfToken }
    })
        .then(function (response) {
            if (!response.ok) {
                throw new Error('Failed to export configuration');
            }

            var contentDisposition = response.headers.get('Content-Disposition') || '';
            var filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
            var filename = filenameMatch && filenameMatch[1] ? filenameMatch[1] : 'theme-config.json';

            return response.blob().then(function (blob) {
                return { blob: blob, filename: filename };
            });
        })
        .then(function (data) {
            showLoading(false);
            var url = window.URL.createObjectURL(data.blob);
            var link = document.createElement('a');
            link.href = url;
            link.download = data.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast('Configuration exported', 'success');
        })
        .catch(function () {
            showLoading(false);
            toast('Failed to export configuration', 'error');
        });
}

function importConfigFile(input) {
    if (!routes.themeImport) {
        toast('Import route is unavailable', 'error');
        input.value = '';
        return;
    }

    var file = input.files && input.files[0];
    if (!file) {
        return;
    }

    var formData = new FormData();
    formData.append('config', file);
    appendActiveAccessPayloadToForm(formData);

    setConfigMenuState(false);
    showLoading(true);
    fetch(routes.themeImport, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' },
        body: formData
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            showLoading(false);
            if (data.success) {
                if (data.config) {
                    config = data.config;
                }
                unsavedChanges = false;
                refreshPanel();
                reloadPreviewWithUrl();
                toast('Configuration imported', 'success');
            } else {
                toast(data.error || 'Failed to import configuration', 'error');
            }
            input.value = '';
        })
        .catch(function () {
            showLoading(false);
            toast('Failed to import configuration', 'error');
            input.value = '';
        });
}

function save() {
    normaliseNavLinksForSave();
    normaliseSubdomainDomainsForSave();
    showLoading(true);
    var payload = getActiveAccessPayload();
    payload.config = config;
    fetch(routes.theme, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' },
        body: JSON.stringify(payload)
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            showLoading(false);
            if (data.success) {
                if (data.config) {
                    config = data.config;
                }
                unsavedChanges = false;
                refreshPanel();
                toast('Saved!', 'success');
                reloadPreviewWithUrl();
            } else {
                toast(data.error || 'Failed to save', 'error');
            }
        })
        .catch(function () {
            showLoading(false);
            toast('Failed to save', 'error');
        });
}


function doReset() {
    showLoading(true);
    fetch(routes.themeReset, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' },
        body: JSON.stringify(getActiveAccessPayload())
    })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            showLoading(false);
            if (data.success) {
                config = data.config;
                var navLinks = config.layout && config.layout.nav_links;
                if (navLinks && navLinks.categories) {
                    navLinks.categories.forEach(function (cat) {
                        if (cat) {
                            cat.enabled = true;
                            var links = Array.isArray(cat.links) ? cat.links : [];
                            links.forEach(function (link) {
                                if (link) link.enabled = true;
                            });
                        }
                    });
                }
                unsavedChanges = false;
                refreshPanel();
                toast('Reset complete', 'success');
                reloadPreviewWithUrl();
            } else {
                toast('Reset failed', 'error');
            }
        })
        .catch(function () {
            showLoading(false);
            toast('Reset failed', 'error');
        });
}

var confirmCallback = null;

function showConfirm(title, message, callback) {
    var modal = document.getElementById('confirmModal');
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalMessage').textContent = message;
    confirmCallback = callback;
    modal.classList.add('visible');
}

function hideConfirm() {
    document.getElementById('confirmModal').classList.remove('visible');
    confirmCallback = null;
}

var serverPermissions = [
    { value: '', label: 'None (visible to all)', category: '' },
    { value: 'websocket.connect', label: 'Websocket Connect', category: 'websocket' },
    { value: 'control.console', label: 'Console', category: 'control' },
    { value: 'control.start', label: 'Start', category: 'control' },
    { value: 'control.stop', label: 'Stop', category: 'control' },
    { value: 'control.restart', label: 'Restart', category: 'control' },
    { value: 'user.create', label: 'Create', category: 'user' },
    { value: 'user.read', label: 'Read', category: 'user' },
    { value: 'user.update', label: 'Update', category: 'user' },
    { value: 'user.delete', label: 'Delete', category: 'user' },
    { value: 'file.create', label: 'Create', category: 'file' },
    { value: 'file.read', label: 'Read', category: 'file' },
    { value: 'file.read-content', label: 'Read Content', category: 'file' },
    { value: 'file.update', label: 'Update', category: 'file' },
    { value: 'file.delete', label: 'Delete', category: 'file' },
    { value: 'file.archive', label: 'Archive', category: 'file' },
    { value: 'file.sftp', label: 'SFTP', category: 'file' },
    { value: 'backup.create', label: 'Create', category: 'backup' },
    { value: 'backup.read', label: 'Read', category: 'backup' },
    { value: 'backup.delete', label: 'Delete', category: 'backup' },
    { value: 'backup.download', label: 'Download', category: 'backup' },
    { value: 'backup.restore', label: 'Restore', category: 'backup' },
    { value: 'allocation.read', label: 'Read', category: 'allocation' },
    { value: 'allocation.create', label: 'Create', category: 'allocation' },
    { value: 'allocation.update', label: 'Update', category: 'allocation' },
    { value: 'allocation.delete', label: 'Delete', category: 'allocation' },
    { value: 'startup.read', label: 'Read', category: 'startup' },
    { value: 'startup.update', label: 'Update', category: 'startup' },
    { value: 'startup.docker-image', label: 'Docker Image', category: 'startup' },
    { value: 'database.create', label: 'Create', category: 'database' },
    { value: 'database.read', label: 'Read', category: 'database' },
    { value: 'database.update', label: 'Update', category: 'database' },
    { value: 'database.delete', label: 'Delete', category: 'database' },
    { value: 'database.view_password', label: 'View Password', category: 'database' },
    { value: 'schedule.create', label: 'Create', category: 'schedule' },
    { value: 'schedule.read', label: 'Read', category: 'schedule' },
    { value: 'schedule.update', label: 'Update', category: 'schedule' },
    { value: 'schedule.delete', label: 'Delete', category: 'schedule' },
    { value: 'settings.rename', label: 'Rename', category: 'settings' },
    { value: 'settings.reinstall', label: 'Reinstall', category: 'settings' },
    { value: 'activity.read', label: 'Read Activity', category: 'activity' }
];

var faIcons = [
    "address-book",
    "address-card",
    "adjust",
    "align-center",
    "align-justify",
    "align-left",
    "align-right",
    "anchor",
    "archive",
    "area-chart",
    "arrow-circle-down",
    "arrow-circle-left",
    "arrow-circle-right",
    "arrow-circle-up",
    "arrow-down",
    "arrow-left",
    "arrow-right",
    "arrow-up",
    "asterisk",
    "at",
    "balance-scale",
    "ban",
    "bar-chart",
    "barcode",
    "bars",
    "bell",
    "bell-slash",
    "binoculars",
    "birthday-cake",
    "bold",
    "bolt",
    "bomb",
    "book",
    "bookmark",
    "briefcase",
    "bug",
    "building",
    "bullhorn",
    "bullseye",
    "calculator",
    "calendar",
    "camera",
    "car",
    "caret-down",
    "caret-left",
    "caret-right",
    "caret-up",
    "certificate",
    "check",
    "check-circle",
    "chevron-circle-down",
    "chevron-circle-left",
    "chevron-circle-right",
    "chevron-circle-up",
    "chevron-down",
    "chevron-left",
    "chevron-right",
    "chevron-up",
    "circle",
    "clipboard",
    "clock-o",
    "clone",
    "cloud",
    "cloud-download",
    "cloud-upload",
    "code",
    "coffee",
    "cog",
    "cogs",
    "columns",
    "comment",
    "comments",
    "compass",
    "compress",
    "copy",
    "copyright",
    "credit-card",
    "crosshairs",
    "cube",
    "cubes",
    "database",
    "desktop",
    "download",
    "edit",
    "ellipsis-h",
    "ellipsis-v",
    "envelope",
    "eraser",
    "exchange",
    "exclamation",
    "exclamation-circle",
    "exclamation-triangle",
    "expand",
    "external-link",
    "eye",
    "eye-slash",
    "fighter-jet",
    "file",
    "file-text",
    "film",
    "filter",
    "fire",
    "flag",
    "flask",
    "folder",
    "folder-open",
    "font",
    "gamepad",
    "gavel",
    "gem",
    "gift",
    "globe",
    "graduation-cap",
    "handshake-o",
    "hashtag",
    "hdd-o",
    "headphones",
    "heart",
    "history",
    "home",
    "hourglass",
    "hourglass-half",
    "id-badge",
    "id-card",
    "image",
    "inbox",
    "industry",
    "info",
    "info-circle",
    "italic",
    "key",
    "keyboard-o",
    "laptop",
    "leaf",
    "lightbulb-o",
    "line-chart",
    "link",
    "list",
    "list-alt",
    "list-ol",
    "list-ul",
    "location-arrow",
    "lock",
    "magic",
    "magnet",
    "map",
    "map-marker",
    "microphone",
    "minus",
    "minus-circle",
    "mobile",
    "money",
    "moon-o",
    "music",
    "newspaper-o",
    "paint-brush",
    "paper-plane",
    "paperclip",
    "paste",
    "paw",
    "pencil",
    "percent",
    "phone",
    "pie-chart",
    "plane",
    "play",
    "play-circle",
    "plug",
    "plus",
    "plus-circle",
    "power-off",
    "print",
    "puzzle-piece",
    "qrcode",
    "question",
    "question-circle",
    "quote-left",
    "quote-right",
    "random",
    "recycle",
    "refresh",
    "reply",
    "road",
    "rocket",
    "rss",
    "save",
    "search",
    "server",
    "share-alt",
    "shield",
    "ship",
    "shopping-bag",
    "shopping-cart",
    "signal",
    "sitemap",
    "sliders",
    "snowflake-o",
    "sort",
    "spinner",
    "square",
    "star",
    "star-half",
    "sticky-note",
    "stop",
    "suitcase",
    "sun-o",
    "table",
    "tachometer",
    "tag",
    "tags",
    "tasks",
    "terminal",
    "thumbs-down",
    "thumbs-up",
    "times",
    "times-circle",
    "toggle-off",
    "toggle-on",
    "toolbox",
    "trash",
    "trophy",
    "truck",
    "umbrella",
    "undo",
    "unlock",
    "upload",
    "user",
    "user-circle",
    "user-plus",
    "user-secret",
    "users",
    "video-camera",
    "volume-up",
    "wifi",
    "wrench"
];

var activeIconPicker = null;

function setupIconPicker(picker, onSelect) {
    if (!picker) return;

    picker._iconSelectCallback = typeof onSelect === 'function' ? onSelect : null;

    var iconName = picker.dataset.value || 'bullhorn';
    picker.dataset.value = iconName;

    var trigger = picker.querySelector('.te-icon-picker-trigger');
    if (trigger) {
        trigger.innerHTML = '<i class="fa fa-' + iconName + '"></i><span>' + iconName + '</span><i class="fa fa-chevron-down te-icon-picker-arrow"></i>';
    }
}

function setupIconPickers() {
    document.addEventListener('click', function (e) {
        var trigger = e.target.closest('.te-icon-picker-trigger');
        if (trigger) {
            e.preventDefault();
            e.stopPropagation();
            var picker = trigger.closest('.te-icon-picker');
            if (picker === activeIconPicker) {
                closeIconPicker();
            } else {
                openIconPicker(picker);
            }
            return;
        }

        var iconItem = e.target.closest('.te-icon-picker-item');
        if (iconItem && activeIconPicker) {
            var iconName = iconItem.dataset.icon;
            selectIcon(activeIconPicker, iconName);
            return;
        }

        if (activeIconPicker && !e.target.closest('.te-icon-picker-dropdown') && !e.target.closest('.te-icon-picker-portal')) {
            closeIconPicker();
        }
    });
}

var iconPickerPortal = null;

function openIconPicker(picker) {
    closeIconPicker();
    activeIconPicker = picker;
    picker.classList.add('open');

    var dropdown = picker.querySelector('.te-icon-picker-dropdown');
    dropdown.style.display = 'block';

    if (!iconPickerPortal) {
        iconPickerPortal = document.createElement('div');
        iconPickerPortal.className = 'te-icon-picker-portal';
        document.body.appendChild(iconPickerPortal);
    }

    iconPickerPortal.innerHTML = '';
    iconPickerPortal.appendChild(dropdown);
    iconPickerPortal.style.display = 'block';

    var trigger = picker.querySelector('.te-icon-picker-trigger');
    var rect = trigger.getBoundingClientRect();
    var dropdownHeight = 280;
    var spaceBelow = window.innerHeight - rect.bottom;
    var top;
    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        top = rect.top - dropdownHeight - 4;
    } else {
        top = rect.bottom + 4;
    }
    iconPickerPortal.style.position = 'fixed';
    iconPickerPortal.style.left = rect.left + 'px';
    iconPickerPortal.style.top = top + 'px';
    iconPickerPortal.style.zIndex = '99999';

    var list = dropdown.querySelector('.te-icon-picker-list');
    var search = dropdown.querySelector('.te-icon-picker-search');
    var currentValue = picker.dataset.value || '';

    renderIconList(list, '', currentValue);
    search.value = '';
    search.focus();

    search.oninput = function () {
        renderIconList(list, search.value.toLowerCase(), currentValue);
    };
}

function closeIconPicker() {
    if (activeIconPicker) {
        var dropdown = iconPickerPortal ? iconPickerPortal.querySelector('.te-icon-picker-dropdown') : null;
        if (dropdown) {
            dropdown.style.display = '';
            activeIconPicker.appendChild(dropdown);
        }
        activeIconPicker.classList.remove('open');
        activeIconPicker = null;
    }
    if (iconPickerPortal) {
        iconPickerPortal.style.display = 'none';
        iconPickerPortal.innerHTML = '';
    }
}

function renderIconList(list, filter, selectedIcon) {
    var html = '';
    var count = 0;
    for (var i = 0; i < faIcons.length && count < 100; i++) {
        var icon = faIcons[i];
        if (!filter || icon.indexOf(filter) !== -1) {
            var selected = icon === selectedIcon ? ' selected' : '';
            html += '<div class="te-icon-picker-item' + selected + '" data-icon="' + icon + '"><i class="fa fa-' + icon + '"></i><span>' + icon + '</span></div>';
            count++;
        }
    }
    if (count === 0) {
        html = '<div class="te-icon-picker-empty">No icons found</div>';
    }
    list.innerHTML = html;
}

function selectIcon(picker, iconName) {
    var path = picker.dataset.path;
    picker.dataset.value = iconName;

    var trigger = picker.querySelector('.te-icon-picker-trigger');
    trigger.innerHTML = '<i class="fa fa-' + iconName + '"></i><span>' + iconName + '</span><i class="fa fa-chevron-down te-icon-picker-arrow"></i>';

    if (typeof picker._iconSelectCallback === 'function') {
        picker._iconSelectCallback(iconName);
    } else if (path) {
        setConfig(path, iconName);
    }

    var navLinkItem = picker.closest('.te-nav-link-item');
    if (navLinkItem) {
        var preview = navLinkItem.querySelector('.te-nav-link-icon-preview i');
        if (preview) {
            preview.className = 'fa fa-' + iconName;
        }
        updateLinksPreview();
    }

    var customLinkItem = picker.closest('.te-custom-link-item');
    if (customLinkItem) {
        var preview = customLinkItem.querySelector('.te-custom-link-icon-preview i');
        if (preview) {
            preview.className = 'fa fa-' + iconName;
        }
        updateLinksPreview();
    }

    closeIconPicker();
}

var activePermissionPicker = null;

function setupPermissionPickers() {
    document.addEventListener('click', function (e) {
        var trigger = e.target.closest('.te-permission-picker-trigger');
        if (trigger) {
            e.preventDefault();
            e.stopPropagation();
            var picker = trigger.closest('.te-permission-picker');
            if (picker === activePermissionPicker) {
                closePermissionPicker();
            } else {
                openPermissionPicker(picker);
            }
            return;
        }

        var permItem = e.target.closest('.te-permission-picker-item');
        if (permItem && activePermissionPicker) {
            var permValue = permItem.dataset.permission;
            selectPermission(activePermissionPicker, permValue);
            return;
        }

        if (activePermissionPicker && !e.target.closest('.te-permission-picker-dropdown') && !e.target.closest('.te-permission-picker-portal')) {
            closePermissionPicker();
        }
    });
}

var permissionPickerPortal = null;

function openPermissionPicker(picker) {
    closePermissionPicker();
    closeIconPicker();
    activePermissionPicker = picker;
    picker.classList.add('open');

    var dropdown = picker.querySelector('.te-permission-picker-dropdown');
    dropdown.style.display = 'block';

    if (!permissionPickerPortal) {
        permissionPickerPortal = document.createElement('div');
        permissionPickerPortal.className = 'te-permission-picker-portal';
        document.body.appendChild(permissionPickerPortal);
    }

    permissionPickerPortal.innerHTML = '';
    permissionPickerPortal.appendChild(dropdown);
    permissionPickerPortal.style.display = 'block';

    var trigger = picker.querySelector('.te-permission-picker-trigger');
    var rect = trigger.getBoundingClientRect();
    var dropdownHeight = 280;
    var spaceBelow = window.innerHeight - rect.bottom;
    var top;
    if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
        top = rect.top - dropdownHeight - 4;
    } else {
        top = rect.bottom + 4;
    }
    permissionPickerPortal.style.position = 'fixed';
    permissionPickerPortal.style.left = rect.left + 'px';
    permissionPickerPortal.style.top = top + 'px';
    permissionPickerPortal.style.zIndex = '99999';

    var list = dropdown.querySelector('.te-permission-picker-list');
    var search = dropdown.querySelector('.te-permission-picker-search');
    var currentValue = picker.dataset.value || '';

    renderPermissionList(list, '', currentValue);
    search.value = '';
    search.focus();

    search.oninput = function () {
        renderPermissionList(list, search.value.toLowerCase(), currentValue);
    };
}

function closePermissionPicker() {
    if (activePermissionPicker) {
        var dropdown = permissionPickerPortal ? permissionPickerPortal.querySelector('.te-permission-picker-dropdown') : null;
        if (dropdown) {
            dropdown.style.display = '';
            activePermissionPicker.appendChild(dropdown);
        }
        activePermissionPicker.classList.remove('open');
        activePermissionPicker = null;
    }
    if (permissionPickerPortal) {
        permissionPickerPortal.style.display = 'none';
        permissionPickerPortal.innerHTML = '';
    }
}

function renderPermissionList(list, filter, selectedValue) {
    var html = '';
    var lastCategory = '';

    for (var i = 0; i < serverPermissions.length; i++) {
        var perm = serverPermissions[i];
        var matchesFilter = !filter || perm.value.indexOf(filter) !== -1 || perm.label.toLowerCase().indexOf(filter) !== -1;

        if (!matchesFilter) continue;

        if (perm.category && perm.category !== lastCategory) {
            lastCategory = perm.category;
            html += '<div class="te-permission-picker-category">' + perm.category + '</div>';
        }

        var selected = perm.value === selectedValue ? ' selected' : '';
        html += '<div class="te-permission-picker-item' + selected + '" data-permission="' + perm.value + '">';
        html += '<span class="te-permission-picker-value">' + (perm.value || 'None') + '</span>';
        html += '</div>';
    }

    if (!html) {
        html = '<div class="te-permission-picker-empty">No permissions found</div>';
    }
    list.innerHTML = html;
}

function selectPermission(picker, permValue) {
    var path = picker.dataset.path;
    picker.dataset.value = permValue;

    var label = permValue || 'None (visible to all)';
    var trigger = picker.querySelector('.te-permission-picker-trigger');
    trigger.innerHTML = '<span>' + label + '</span><i class="fa fa-chevron-down te-permission-picker-arrow"></i>';

    setConfig(path, permValue);
    closePermissionPicker();
}

function setupModal() {
    document.getElementById('confirmModalCancel').onclick = hideConfirm;
    document.getElementById('confirmModalConfirm').onclick = function () {
        var callback = confirmCallback;
        hideConfirm();
        if (callback) callback();
    };
    document.getElementById('confirmModal').onclick = function (e) {
        if (e.target === this) hideConfirm();
    };
}

function uploadFile(input, path) {
    var file = input.files[0];
    if (!file) return;

    var form = new FormData();
    form.append('image', file);
    form.append('path', 'theme');
    appendActiveAccessPayloadToForm(form);

    showLoading(true);
    fetch(routes.themeUpload, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' },
        body: form
    })
        .then(readJsonResponse)
        .then(function (data) {
            showLoading(false);
            if (data.success) {
                setConfig(path, data.url);
                refreshPanel();
                toast('Uploaded', 'success');
            } else {
                toast(data.error || data.message || 'Upload failed', 'error');
            }
        })
        .catch(function (error) {
            showLoading(false);
            toast(error && error.message ? error.message : 'Upload failed', 'error');
        });
}

function uploadEggImage(input, eggId) {
    var file = input.files[0];
    if (!file) return;

    var form = new FormData();
    form.append('image', file);
    form.append('path', 'theme/eggs');
    form.append('active_tab', 'eggs');

    showLoading(true);
    fetch(routes.themeUpload, {
        method: 'POST',
        headers: { 'X-CSRF-TOKEN': csrfToken, 'Accept': 'application/json' },
        body: form
    })
        .then(readJsonResponse)
        .then(function (data) {
            showLoading(false);
            if (data.success) {
                if (!config.eggs) config.eggs = {};
                config.eggs[eggId] = data.url;
                markUnsaved();
                refreshPanel();
                toast('Uploaded', 'success');
            } else {
                toast(data.error || data.message || 'Upload failed', 'error');
            }
        })
        .catch(function (error) {
            showLoading(false);
            toast(error && error.message ? error.message : 'Upload failed', 'error');
        });
}

function readJsonResponse(response) {
    return response.text().then(function (text) {
        var data = {};

        if (text) {
            try {
                data = JSON.parse(text);
            } catch (error) {
                data = {};
            }
        }

        if (!response.ok) {
            var message = data.error || data.message || 'Upload failed';

            if (data.errors && data.errors.image && data.errors.image.length) {
                message = data.errors.image[0];
            }

            throw new Error(message);
        }

        return data;
    });
}

function toast(msg, type) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'te-toast ' + type + ' visible';
    setTimeout(function () { el.classList.remove('visible'); }, 3000);
}

function showLoading(show) {
    document.getElementById('loading').classList.toggle('visible', show);
}

function getIcon(name) {
    var template = document.getElementById('te-icon-' + name);
    return template ? template.innerHTML : '';
}

function esc(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// buzz: maybe we should change this just always use hex so its easier?
function hslToHex(hsl) {
    var m = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (!m) return hsl.startsWith('#') ? hsl : '#6366f1';

    var h = m[1] / 360, s = m[2] / 100, l = m[3] / 100;
    var r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return '#' + toHex(r) + toHex(g) + toHex(b);
}

function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

function toHex(x) {
    var hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
}

function hexToHsl(hex) {
    var r = parseInt(hex.slice(1, 3), 16) / 255;
    var g = parseInt(hex.slice(3, 5), 16) / 255;
    var b = parseInt(hex.slice(5, 7), 16) / 255;

    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        else if (max === g) h = ((b - r) / d + 2) / 6;
        else h = ((r - g) / d + 4) / 6;
    }

    return 'hsl(' + Math.round(h * 360) + ', ' + Math.round(s * 100) + '%, ' + Math.round(l * 100) + '%)';
}

window.ThemeEditor = { init: init };
