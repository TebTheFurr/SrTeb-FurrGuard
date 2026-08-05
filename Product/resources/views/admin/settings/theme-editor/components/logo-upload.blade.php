@verbatim
<template id="te-logo-upload-with-preview">
    <div class="te-logo-preview-wrapper">
        <div class="te-logo-preview-container">
            <img src="{{VALUE}}" class="te-logo-preview-image">
            <div class="te-logo-preview-actions">
                <button class="te-logo-action-btn" data-logo-replace="{{PATH}}" title="Replace logo">{{ICON_UPLOAD_LOGO}}</button>
                <button class="te-logo-action-btn te-logo-action-delete" data-remove-file="{{PATH}}" title="Remove logo">{{ICON_CLOSE}}</button>
            </div>
        </div>
        <input type="file" accept="image/*" data-upload-path="{{PATH}}" style="display:none">
        <input type="hidden" data-path="{{PATH}}" value="{{VALUE}}">
    </div>
</template>

<template id="te-logo-upload-empty">
    <div class="te-file-upload-wrapper">
        <div class="te-file-upload">
            <input type="file" accept="image/*" data-upload-path="{{PATH}}">
            <div class="te-file-upload-icon">{{ICON_UPLOAD}}</div>
            <span class="te-file-upload-text">Click to upload</span>
        </div>
        <input type="hidden" data-path="{{PATH}}" value="{{VALUE}}">
    </div>
</template>
@endverbatim
