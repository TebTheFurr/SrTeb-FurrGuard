@verbatim
<template id="te-fullpage-panel">
    <div class="te-fullpage-panel">
        <div class="te-fullpage-header">
            <div>
                <div class="te-panel-title">{{TAB_LABEL}}</div>
                <div class="te-panel-subtitle">{{TAB_DESCRIPTION}}</div>
            </div>
            <div class="te-fullpage-actions">
                <button class="te-btn te-btn-danger te-btn-icon-only" data-action="reset" title="Reset"><i class="fa fa-undo"></i></button>
                {{CONFIG_ACTIONS_MENU}}
                <button class="te-btn te-btn-primary" data-action="save"><i class="fa fa-save"></i> Save Changes</button>
            </div>
        </div>
        <div class="te-fullpage-content" id="panelContent">{{TAB_CONTENT}}</div>
    </div>
</template>
@endverbatim
