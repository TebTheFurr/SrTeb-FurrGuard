@verbatim
<template id="te-tab-addons">
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Installed Addons</span>
        </div>
        <div class="te-section-content">
            <p class="te-help-text" style="margin-bottom: 16px;">Below are a list of Luna-exclusive addons available in the Luna ecosystem. Other addons may work with Luna, but only official ones are listed below.</p>
            <div class="te-addons-list">
                {{INSTALLED_ADDONS_LIST}}
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Available to Purchase</span>
        </div>
        <div class="te-section-content">
            <p class="te-help-text" style="margin-bottom: 16px;">Expand your panel's functionality with these official Luna addons.</p>
            <div class="te-addons-search">
                <i class="fa fa-search"></i>
                <input type="text" id="addonsSearch" placeholder="Search addons..." data-addon-search>
            </div>
            <div class="te-addons-list" id="availableAddonsList">
                {{AVAILABLE_ADDONS_LIST}}
            </div>
        </div>
    </div>
</template>

<template id="te-addon-item-installed">
    <div class="te-addon-card te-addon-installed" data-addon-id="{{ADDON_ID}}">
        <div class="te-addon-header">
            <div class="te-addon-info">
                <span class="te-addon-name">{{ADDON_NAME}}</span>
            </div>
            <div class="te-addon-status {{STATUS_CLASS}}">{{STATUS_TEXT}}</div>
        </div>
        <p class="te-addon-description">{{ADDON_DESCRIPTION}}</p>
        <div class="te-addon-footer">
            <span class="te-addon-author">by {{ADDON_AUTHOR}}</span>
            <div class="te-addon-actions">
                {{ADDON_OPTIONS}}
                {{ADDON_PURCHASE_LINK}}
                {{ADDON_TOGGLE}}
            </div>
        </div>
    </div>
</template>

<template id="te-addon-options-button">
    <button class="te-addon-icon-btn te-addon-options-btn" data-addon-settings="{{ADDON_ID}}" title="Options">
        <i class="fa fa-cog"></i>
    </button>
</template>

<template id="te-addon-purchase-link">
    <a href="{{ADDON_PURCHASE_URL}}" target="_blank" rel="noopener noreferrer" class="te-addon-icon-btn te-addon-purchase-link" title="View on store">
        <i class="fa fa-external-link"></i>
    </a>
</template>

<template id="te-addon-item-available">
    <div class="te-addon-card te-addon-available" data-addon-id="{{ADDON_ID}}">
        <div class="te-addon-header">
            <div class="te-addon-info">
                <span class="te-addon-name">{{ADDON_NAME}}</span>
            </div>
        </div>
        <p class="te-addon-description">{{ADDON_DESCRIPTION}}</p>
        <div class="te-addon-footer">
            <span class="te-addon-author">by {{ADDON_AUTHOR}}</span>
            <a href="{{ADDON_PURCHASE_URL}}" target="_blank" class="te-addon-purchase-btn">
                <i class="fa fa-shopping-cart"></i>
                Purchase
            </a>
        </div>
    </div>
</template>

<template id="te-addon-toggle-enabled">
    <label class="te-toggle te-addon-toggle">
        <input type="checkbox" data-addon-toggle="{{ADDON_ID}}" checked>
        <span class="te-toggle-slider"></span>
    </label>
</template>

<template id="te-addon-toggle-disabled">
    <label class="te-toggle te-addon-toggle">
        <input type="checkbox" data-addon-toggle="{{ADDON_ID}}">
        <span class="te-toggle-slider"></span>
    </label>
</template>

<template id="te-addons-empty">
    <div class="te-addons-empty">
        <i class="fa fa-cube"></i>
        <p>{{EMPTY_MESSAGE}}</p>
    </div>
</template>
@endverbatim
