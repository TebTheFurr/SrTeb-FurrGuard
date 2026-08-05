@extends('layouts.admin')
@include('partials/admin.settings.nav', ['activeTab' => 'theme'])

@section('title')
    Theme Settings
@endsection

@section('content-header')
    <h1>Theme Settings<small>Customise the appearance of your panel.</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li class="active">Settings</li>
    </ol>
@endsection

@section('content')
    @yield('settings::nav')
    <div class="row">
        <div class="col-xs-12">
            <form action="{{ route('admin.settings.theme') }}" method="POST">
                <div class="box">
                    <div class="box-header with-border">
                        <h3 class="box-title">Theme Colours</h3>
                    </div>
                    <div class="box-body">
                        <p class="text-muted">Customise the colours used throughout the panel. Changes will apply to all users.</p>
                        <div class="row" style="margin-top: 20px;">
                            @foreach($colors as $color)
                                @php
                                    $settingKey = 'settings::theme:' . $color['name'];
                                    $currentValue = old('theme:' . $color['name'], app(\Pterodactyl\Contracts\Repository\SettingsRepositoryInterface::class)->get($settingKey, $color['default']));
                                @endphp
                                <div class="form-group col-md-6">
                                    <label class="control-label">{{ $color['label'] }}</label>
                                    <div class="input-group">
                                        <input type="color" 
                                               class="form-control color-picker" 
                                               id="picker-{{ $color['name'] }}"
                                               data-target="{{ $color['name'] }}"
                                               style="width: 50px; padding: 2px; cursor: pointer;">
                                        <input type="text" 
                                               class="form-control color-input" 
                                               name="theme:{{ $color['name'] }}" 
                                               id="input-{{ $color['name'] }}"
                                               value="{{ $currentValue }}"
                                               placeholder="{{ $color['default'] }}">
                                        <span class="input-group-btn">
                                            <button type="button" 
                                                    class="btn btn-default reset-color" 
                                                    data-default="{{ $color['default'] }}"
                                                    data-target="{{ $color['name'] }}"
                                                    title="Reset to default">
                                                <i class="fa fa-undo"></i>
                                            </button>
                                        </span>
                                    </div>
                                    <p class="text-muted"><small>{{ $color['description'] }}</small></p>
                                </div>
                            @endforeach
                        </div>
                    </div>
                </div>
                <div class="box">
                    <div class="box-header with-border">
                        <h3 class="box-title">Layout Settings</h3>
                    </div>
                    <div class="box-body">
                        <div class="row">
                            <div class="form-group col-md-6">
                                <label class="control-label">Card Border Radius</label>
                                <div class="input-group">
                                    <input type="number" 
                                           class="form-control" 
                                           name="theme:border-radius" 
                                           id="input-border-radius"
                                           value="{{ $borderRadius }}"
                                           min="0"
                                           max="50"
                                           step="1">
                                    <span class="input-group-addon">px</span>
                                    <span class="input-group-btn">
                                        <button type="button" 
                                                class="btn btn-default" 
                                                id="reset-border-radius"
                                                title="Reset to default">
                                            <i class="fa fa-undo"></i>
                                        </button>
                                    </span>
                                </div>
                                <p class="text-muted"><small>Border radius for cards, modals, and panels (0-50px).</small></p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="box">
                    <div class="box-header with-border">
                        <h3 class="box-title">Preview</h3>
                    </div>
                    <div class="box-body">
                        <div id="theme-preview" style="padding: 20px; transition: all 0.3s ease;">
                            <div style="margin-bottom: 15px;">
                                <span class="preview-text-base" style="font-size: 18px; font-weight: 600;">Sample Heading Text</span>
                            </div>
                            <div style="margin-bottom: 15px;">
                                <span class="preview-text-muted">This is some muted description text that provides additional context.</span>
                            </div>
                            <div style="margin-bottom: 15px;">
                                <button type="button" class="btn preview-btn-primary" style="margin-right: 10px;">Primary Button</button>
                                <button type="button" class="btn preview-btn-secondary">Secondary Button</button>
                            </div>
                            <div class="preview-card" style="padding: 15px; margin-top: 15px;">
                                <span class="preview-text-base">Card Content</span>
                                <p class="preview-text-inverted" style="margin: 5px 0 0 0; font-size: 12px;">Inverted text example</p>
                            </div>
                            <div class="preview-modal" style="padding: 20px; margin-top: 15px;">
                                <span class="preview-text-base" style="font-size: 16px; font-weight: 600;">Modal Example</span>
                                <p class="preview-text-muted" style="margin: 8px 0 0 0; font-size: 13px;">This shows how modals will appear with the current border radius.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="box box-primary">
                    <div class="box-footer">
                        {{ csrf_field() }}
                        <button type="submit" name="_method" value="PATCH" class="btn btn-sm btn-primary pull-right">Save</button>
                    </div>
                </div>
            </form>
        </div>
    </div>
@endsection

@section('footer-scripts')
    @parent
    <script>
        function hslToHex(hsl) {
            const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
            if (!match) return hsl;
            
            let h = parseInt(match[1]) / 360;
            let s = parseInt(match[2]) / 100;
            let l = parseInt(match[3]) / 100;
            
            let r, g, b;
            if (s === 0) {
                r = g = b = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }
            
            const toHex = x => {
                const hex = Math.round(x * 255).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            };
            
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        }
        
        function hexToHsl(hex) {
            let r = parseInt(hex.slice(1, 3), 16) / 255;
            let g = parseInt(hex.slice(3, 5), 16) / 255;
            let b = parseInt(hex.slice(5, 7), 16) / 255;
            
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            let h, s, l = (max + min) / 2;
            
            if (max === min) {
                h = s = 0;
            } else {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                    case g: h = ((b - r) / d + 2) / 6; break;
                    case b: h = ((r - g) / d + 4) / 6; break;
                }
            }
            
            return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
        }
        
        function updatePreview() {
            const preview = document.getElementById('theme-preview');
            const primary = document.getElementById('input-dark-primary').value;
            const secondary = document.getElementById('input-dark-secondary').value;
            const neutral = document.getElementById('input-dark-neutral').value;
            const base = document.getElementById('input-dark-base').value;
            const muted = document.getElementById('input-dark-muted').value;
            const inverted = document.getElementById('input-dark-inverted').value;
            const background = document.getElementById('input-dark-background').value;
            const backgroundSecondary = document.getElementById('input-dark-background-secondary').value;
            const borderRadius = document.getElementById('input-border-radius').value + 'px';
            
            preview.style.backgroundColor = background;
            preview.style.border = `1px solid ${neutral}`;
            preview.style.borderRadius = borderRadius;
            
            preview.querySelectorAll('.preview-text-base').forEach(el => {
                el.style.color = base;
            });
            
            preview.querySelectorAll('.preview-text-muted').forEach(el => {
                el.style.color = muted;
            });
            
            preview.querySelectorAll('.preview-text-inverted').forEach(el => {
                el.style.color = inverted;
            });
            
            preview.querySelectorAll('.preview-btn-primary').forEach(el => {
                el.style.backgroundColor = primary;
                el.style.borderColor = primary;
                el.style.color = base;
                el.style.borderRadius = borderRadius;
            });
            
            preview.querySelectorAll('.preview-btn-secondary').forEach(el => {
                el.style.backgroundColor = 'transparent';
                el.style.borderColor = secondary;
                el.style.color = secondary;
                el.style.borderRadius = borderRadius;
            });
            
            preview.querySelectorAll('.preview-card').forEach(el => {
                el.style.backgroundColor = backgroundSecondary;
                el.style.border = `1px solid ${neutral}`;
                el.style.borderRadius = borderRadius;
            });
            
            preview.querySelectorAll('.preview-modal').forEach(el => {
                el.style.backgroundColor = backgroundSecondary;
                el.style.border = `1px solid ${neutral}`;
                el.style.borderRadius = borderRadius;
            });
        }
        
        document.querySelectorAll('.color-picker').forEach(picker => {
            const target = picker.dataset.target;
            const input = document.getElementById('input-' + target);
            
            picker.value = hslToHex(input.value);
            
            picker.addEventListener('input', function() {
                input.value = hexToHsl(this.value);
                updatePreview();
            });
        });
        
        document.querySelectorAll('.color-input').forEach(input => {
            const name = input.name.replace('theme:', '');
            const picker = document.getElementById('picker-' + name);
            
            input.addEventListener('input', function() {
                const hexValue = hslToHex(this.value);
                if (hexValue.startsWith('#')) {
                    picker.value = hexValue;
                }
                updatePreview();
            });
        });
        
        document.querySelectorAll('.reset-color').forEach(btn => {
            btn.addEventListener('click', function() {
                const target = this.dataset.target;
                const defaultValue = this.dataset.default;
                const input = document.getElementById('input-' + target);
                const picker = document.getElementById('picker-' + target);
                
                input.value = defaultValue;
                picker.value = hslToHex(defaultValue);
                updatePreview();
            });
        });
        
        document.getElementById('input-border-radius').addEventListener('input', updatePreview);
        
        document.getElementById('reset-border-radius').addEventListener('click', function() {
            document.getElementById('input-border-radius').value = '12';
            updatePreview();
        });
        
        updatePreview();
    </script>
@endsection
