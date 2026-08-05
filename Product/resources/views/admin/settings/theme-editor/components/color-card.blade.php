@verbatim
<template id="te-color-card">
    <div class="te-color-card">
        <span class="te-color-card-label">{{LABEL}}</span>
        <div class="te-color-field">
            <input type="color" class="te-color-picker" data-path="{{PATH_PREFIX}}{{KEY}}" value="{{HEX}}">
            <input type="text" class="te-color-card-input" data-path="{{PATH_PREFIX}}{{KEY}}" value="{{VALUE}}">
        </div>
    </div>
</template>
@endverbatim
