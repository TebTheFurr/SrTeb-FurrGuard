@verbatim
<template id="te-file-upload">
    <div class="te-file-upload-wrapper">
        <div class="te-file-upload">
            <input type="file" accept="image/*" data-upload-path="{{PATH}}">
            <div class="te-file-upload-icon">{{ICON_UPLOAD}}</div>
            <span class="te-file-upload-text">Click to upload</span>
        </div>
        {{FILE_PREVIEW}}
        <input type="hidden" data-path="{{PATH}}" value="{{VALUE}}">
    </div>
</template>

<template id="te-file-preview">
    <div class="te-file-preview">
        <img src="{{VALUE}}">
        <button class="te-file-preview-remove" data-remove-file="{{PATH}}">{{ICON_CLOSE}}</button>
    </div>
</template>
@endverbatim
