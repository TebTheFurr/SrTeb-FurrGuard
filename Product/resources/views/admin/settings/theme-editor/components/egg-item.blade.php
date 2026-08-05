@verbatim
<template id="te-egg-item">
    <div class="te-egg-item">
        <div class="te-egg-image">{{EGG_IMAGE}}</div>
        <div class="te-egg-info">
            <div class="te-egg-name">{{EGG_NAME}}</div>
            <div class="te-egg-nest">{{EGG_NEST}}</div>
        </div>
        <div class="te-egg-actions">
            <button class="te-egg-btn" data-egg-upload-btn="{{EGG_ID}}">Upload</button>
            <input type="file" accept="image/*" data-egg-upload="{{EGG_ID}}" style="display:none">
        </div>
    </div>
</template>

<template id="te-egg-image-placeholder">{{ICON_PHOTO}}</template>

<template id="te-egg-image-preview">
    <img src="{{VALUE}}">
    <button class="te-egg-image-remove" data-egg-remove="{{EGG_ID}}" title="Remove image">{{ICON_TRASH}}</button>
</template>
@endverbatim
