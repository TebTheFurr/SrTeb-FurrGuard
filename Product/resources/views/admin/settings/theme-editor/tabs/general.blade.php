@verbatim
<template id="te-tab-general">
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Branding</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Site Name</label>
                <input type="text" class="te-input" data-path="general.site_name" value="{{SITE_NAME}}">
                <p class="te-help-text">The name displayed in the browser tab and throughout the panel.</p>
            </div>
            <div class="te-field">
                <div style="display: flex; gap: 16px;">
                    <div>
                        <label class="te-label">Dark Mode Logo</label>
                        <div data-component="logo-upload" data-path="general.logo_url_dark" data-value="{{LOGO_URL_DARK}}"></div>
                    </div>
                    <div>
                        <label class="te-label">Light Mode Logo</label>
                        <div data-component="logo-upload" data-path="general.logo_url_light" data-value="{{LOGO_URL_LIGHT}}"></div>
                    </div>
                </div>
                <p class="te-help-text">Recommended size: 200x50px. PNG or SVG preferred.</p>
            </div>
            <div class="te-field">
                <label class="te-label">Copyright Text</label>
                <input type="text" class="te-input" data-path="general.copyright_text" value="{{COPYRIGHT_TEXT}}">
                <p class="te-help-text">The copyright text displayed in the footer of the panel.</p>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Discord Integration</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Discord Invite Link</label>
                <input type="text" class="te-input" data-path="general.discord_invite_link" value="{{DISCORD_INVITE_LINK}}" placeholder="https://discord.gg/yourserver">
                <p class="te-help-text">Your Discord server invite link. Shown in the navigation when enabled.</p>
            </div>
            <div class="te-field">
                <label class="te-label">Show Discord Icon in Navbar</label>
                <div class="te-toggle-field">
                    <label class="te-toggle">
                        <input type="checkbox" data-path="general.show_discord_navbar" data-checked="{{SHOW_DISCORD_CHECKED}}">
                        <span class="te-toggle-slider"></span>
                    </label>
                    <span class="te-toggle-label">Display a Discord icon in the server navbar that links to your Discord server</span>
                </div>
            </div>
        </div>
    </div>
    <div class="te-section">
        <div class="te-section-header">
            <span class="te-section-title">Privacy</span>
        </div>
        <div class="te-section-content">
            <div class="te-field">
                <label class="te-label">Blur server IP until hovered</label>
                <div class="te-toggle-field">
                    <label class="te-toggle">
                        <input type="checkbox" data-path="general.privacy_blur_server_ip" data-checked="{{PRIVACY_BLUR_SERVER_IP_CHECKED}}">
                        <span class="te-toggle-slider"></span>
                    </label>
                    <span class="te-toggle-label">When enabled, connection addresses that show the node IP are blurred until the user hovers over them.</span>
                </div>
            </div>
        </div>
    </div>
</template>
@endverbatim
