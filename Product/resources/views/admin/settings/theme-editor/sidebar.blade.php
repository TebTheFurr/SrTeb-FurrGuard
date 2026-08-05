<div class="te-icon-sidebar">
    <div class="te-sidebar-top">
        @foreach($tabs as $tab)
            @if($tab['id'] !== 'components')
                <button class="te-tab-btn" data-tab="{{ $tab['id'] }}" data-tooltip="{{ $tab['label'] }}">
                    @switch($tab['id'])
                        @case('general')
                            <i class="fa fa-cog"></i>
                            @break
                        @case('theme')
                            <i class="fa fa-paint-brush"></i>
                            @break
                        @case('layout')
                            <i class="fa fa-th-large"></i>
                            @break
                        @case('links')
                            <i class="fa fa-link"></i>
                            @break
                        @case('announcements')
                            <i class="fa fa-bullhorn"></i>
                            @break
                        @case('seo')
                            <i class="fa fa-search"></i>
                            @break
                        @case('eggs')
                            <i class="fa fa-server"></i>
                            @break
                        @case('templates')
                            <i class="fa fa-clone"></i>
                            @break
                        @case('advanced')
                            <i class="fa fa-code"></i>
                            @break
                        @case('oauth')
                            <i class="fa fa-key"></i>
                            @break
                        @case('addons')
                            <i class="fa fa-puzzle-piece"></i>
                            @break
                        @case('import-eggs')
                            <i class="fa fa-download"></i>
                            @break
                        @case('environment')
                            <i class="fa fa-terminal"></i>
                            @break
                        @default
                            <i class="fa fa-cog"></i>
                    @endswitch
                </button>
            @endif
        @endforeach
    </div>
    <div class="te-sidebar-bottom">
        <button class="te-tab-btn" data-action="back" data-tooltip="Back to Admin">
            <i class="fa fa-arrow-left"></i>
        </button>
    </div>
</div>
