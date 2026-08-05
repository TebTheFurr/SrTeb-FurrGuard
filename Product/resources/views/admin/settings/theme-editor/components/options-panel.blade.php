@verbatim
<template id="te-options-panel">
    <div class="te-options-panel">
        <div class="te-panel-header">
            <div>
                <div class="te-panel-title">{{TAB_LABEL}}</div>
                <div class="te-panel-subtitle">{{TAB_DESCRIPTION}}</div>
            </div>
        </div>
        <div class="te-panel-content" id="panelContent">{{TAB_CONTENT}}</div>
        <div class="te-panel-footer" style="display: flex; gap: 10px;">
            <button class="te-btn te-btn-danger te-btn-lg te-btn-icon-only" data-action="reset" title="Reset to defaults"><i class="fa fa-undo"></i></button>
            {{CONFIG_ACTIONS_MENU}}
            <button class="te-btn te-btn-primary te-btn-lg" style="flex:1" data-action="save"><i class="fa fa-save"></i> Save Changes</button>
        </div>
    </div>
</template>
@endverbatim
