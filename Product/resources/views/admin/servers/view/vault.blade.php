@extends('layouts.admin')

@section('title')
    Server — {{ $server->name }}: Vault
@endsection

@section('content-header')
    <h1>{{ $server->name }}<small>{{ __('vault.admin.subtitle') }}</small></h1>
    <ol class="breadcrumb">
        <li><a href="{{ route('admin.index') }}">Admin</a></li>
        <li><a href="{{ route('admin.servers') }}">Servers</a></li>
        <li><a href="{{ route('admin.servers.view', $server->id) }}">{{ $server->name }}</a></li>
        <li class="active">Vault</li>
    </ol>
@endsection

@section('content')
    @include('admin.servers.partials.navigation')

    @php
        $formatBytes = function ($bytes) {
            $value = is_numeric($bytes) ? max(0.0, (float) $bytes) : 0.0;
            $units = ['B', 'KB', 'MB', 'GB', 'TB'];
            $unit = 0;
            while ($value >= 1024 && $unit < count($units) - 1) {
                $value /= 1024;
                $unit++;
            }

            return ($unit === 0 ? (string) (int) $value : number_format($value, 1)) . ' ' . $units[$unit];
        };
        $formatTs = fn ($ts) => is_numeric($ts) && $ts > 0 ? date('Y-m-d H:i', (int) $ts) : __('vault.admin.never');
        $stateLabel = fn ($estado) => match ($estado) {
            'ok' => 'label-success',
            'fallo' => 'label-danger',
            'cancelado' => 'label-default',
            'en_cola', 'despachado' => 'label-warning',
            default => 'label-info',
        };
        $confirmJs = fn (string $key) => json_encode(__($key));

        $cuota = is_array($servidor['cuota'] ?? null) ? $servidor['cuota'] : null;
        $accesos = is_array($servidor['accesos'] ?? null) ? $servidor['accesos'] : [];
        $trabajoActivo = is_array($servidor['trabajo_activo'] ?? null) ? $servidor['trabajo_activo'] : null;
        $ultimaDiaria = is_array($servidor['ultima_diaria'] ?? null) ? $servidor['ultima_diaria'] : null;
        $exclusiones = is_array($servidor['exclusiones'] ?? null) ? array_filter($servidor['exclusiones'], 'is_string') : [];
        $mundosExtra = is_array($servidor['mundos_extra'] ?? null) ? array_filter($servidor['mundos_extra'], 'is_string') : [];
        $mundos = is_array($servidor['mundos'] ?? null) ? array_filter($servidor['mundos'], 'is_string') : [];
        $cuotaGb = '';
        if ($cuota && empty($cuota['defecto']) && is_numeric($cuota['total'] ?? null)) {
            $cuotaGb = rtrim(rtrim(number_format((float) $cuota['total'] / 1073741824, 2, '.', ''), '0'), '.');
        }
    @endphp

    @unless($configured)
        <div class="row">
            <div class="col-xs-12">
                <div class="callout callout-warning">
                    <h4>{{ __('vault.admin.not_configured_title') }}</h4>
                    <p>{{ __('vault.admin.not_configured_body') }}</p>
                </div>
            </div>
        </div>
    @endunless

    @if($vaultError)
        <div class="row">
            <div class="col-xs-12">
                <div class="alert alert-danger">
                    <strong>{{ __('vault.admin.unreachable_title') }}:</strong> {{ $vaultError }}
                </div>
            </div>
        </div>
    @endif

    <div class="row">
        <div class="{{ $servidor ? 'col-md-6' : 'col-xs-12' }}">
            <div class="box {{ $enabled ? 'box-success' : 'box-primary' }}">
                <div class="box-header with-border">
                    <h3 class="box-title">{{ __('vault.admin.activation.title') }}</h3>
                </div>
                <div class="box-body">
                    <p>
                        @if($enabled)
                            <span class="label label-success">{{ __('vault.admin.activation.status_on') }}</span>
                            @if($vaultServer?->enabled_at)
                                <small class="text-muted">&nbsp;{{ __('vault.admin.activation.enabled_since', ['date' => $vaultServer->enabled_at->format('Y-m-d H:i')]) }}</small>
                            @endif
                        @else
                            <span class="label label-default">{{ __('vault.admin.activation.status_off') }}</span>
                        @endif
                    </p>
                    <p class="text-muted small">{{ __('vault.admin.activation.description') }}</p>
                    @if($enabled && $servidor && $pendingCount > 0)
                        <p>{{ __('vault.admin.activation.import_pending', ['count' => $pendingCount]) }}</p>
                    @endif
                </div>
                <div class="box-footer">
                    @if(!$enabled)
                        <form action="{{ route('admin.servers.view.vault.activation', $server->id) }}" method="POST">
                            {!! csrf_field() !!}
                            <input type="hidden" name="activo" value="1">
                            @if($eligibleCount > 0)
                                <div class="checkbox checkbox-primary no-margin-bottom">
                                    <input id="vaultImportar" type="checkbox" name="importar" value="1">
                                    <label for="vaultImportar">{{ __('vault.admin.activation.import_existing', ['count' => $eligibleCount]) }}</label>
                                </div>
                                <div class="checkbox checkbox-primary">
                                    <input id="vaultBorrarOriginales" type="checkbox" name="borrar_originales" value="1">
                                    <label for="vaultBorrarOriginales">{{ __('vault.admin.activation.delete_originals') }}</label>
                                </div>
                            @endif
                            <button type="submit" class="btn btn-success" @unless($configured) disabled @endunless>
                                {{ __('vault.admin.activation.enable') }}
                            </button>
                        </form>
                    @else
                        @if($servidor && $pendingCount > 0)
                            <form action="{{ route('admin.servers.view.vault.import', $server->id) }}" method="POST" style="display: inline-block;">
                                {!! csrf_field() !!}
                                <div class="checkbox checkbox-primary no-margin-top">
                                    <input id="vaultImportBorrar" type="checkbox" name="borrar_originales" value="1">
                                    <label for="vaultImportBorrar">{{ __('vault.admin.activation.delete_originals') }}</label>
                                </div>
                                <button type="submit" class="btn btn-primary btn-sm">{{ __('vault.admin.activation.import_button') }}</button>
                            </form>
                        @endif
                        <form action="{{ route('admin.servers.view.vault.activation', $server->id) }}" method="POST" class="pull-right"
                              onsubmit="return confirm({{ $confirmJs('vault.admin.activation.disable_confirm') }});">
                            {!! csrf_field() !!}
                            <input type="hidden" name="activo" value="0">
                            <button type="submit" class="btn btn-danger btn-sm">{{ __('vault.admin.activation.disable') }}</button>
                        </form>
                    @endif
                </div>
            </div>
        </div>

        @if($servidor)
            <div class="col-md-6">
                <div class="box box-primary">
                    <div class="box-header with-border">
                        <h3 class="box-title">{{ __('vault.admin.status.title') }}</h3>
                    </div>
                    <div class="box-body table-responsive no-padding">
                        <table class="table table-hover">
                            <tr>
                                <td>{{ __('vault.admin.status.usage') }}</td>
                                <td>
                                    @if($cuota)
                                        {{ $formatBytes($cuota['usado'] ?? 0) }} /
                                        {{ is_numeric($cuota['total'] ?? null) && $cuota['total'] > 0 ? $formatBytes($cuota['total']) : __('vault.admin.status.unlimited') }}
                                        @if(!empty($cuota['defecto']))
                                            <small class="text-muted">({{ __('vault.admin.status.quota_default') }})</small>
                                        @endif
                                        @if(!empty($cuota['superada']))
                                            <span class="label label-danger">{{ __('vault.admin.status.exceeded') }}</span>
                                        @endif
                                    @else
                                        —
                                    @endif
                                </td>
                            </tr>
                            <tr>
                                <td>{{ __('vault.admin.status.last_sync') }}</td>
                                <td>{{ $formatTs($servidor['ultima_sync_ts'] ?? null) }}</td>
                            </tr>
                            <tr>
                                <td>{{ __('vault.admin.status.last_daily') }}</td>
                                <td>
                                    @if($ultimaDiaria)
                                        <code>{{ $ultimaDiaria['nombre'] ?? '' }}</code>
                                        <small class="text-muted">{{ $formatTs($ultimaDiaria['creado_ts'] ?? null) }}</small>
                                    @else
                                        {{ __('vault.admin.never') }}
                                    @endif
                                </td>
                            </tr>
                            <tr>
                                <td>{{ __('vault.admin.status.active_job') }}</td>
                                <td>
                                    @if($trabajoActivo)
                                        <span class="label {{ $stateLabel($trabajoActivo['estado'] ?? '') }}">{{ $trabajoActivo['estado'] ?? '' }}</span>
                                        {{ $trabajoActivo['resumen'] ?? ($trabajoActivo['tipo'] ?? '') }}
                                        @if(!empty($trabajoActivo['progreso']['fase']))
                                            <small class="text-muted">({{ $trabajoActivo['progreso']['fase'] }})</small>
                                        @endif
                                    @else
                                        {{ __('vault.admin.none') }}
                                    @endif
                                </td>
                            </tr>
                            <tr>
                                <td>{{ __('vault.admin.status.worlds') }}</td>
                                <td>{{ $mundos === [] ? __('vault.admin.none') : implode(', ', $mundos) }}</td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
        @endif
    </div>

    @if($servidor)
        <div class="row">
            <div class="col-md-6">
                <div class="box box-primary">
                    <div class="box-header with-border">
                        <h3 class="box-title">{{ __('vault.admin.access.title') }}</h3>
                    </div>
                    <div class="box-body table-responsive no-padding">
                        <table class="table table-hover">
                            <tr>
                                <th>{{ __('vault.admin.access.discord_id') }}</th>
                                <th>{{ __('vault.admin.access.name') }}</th>
                                <th>{{ __('vault.admin.access.level') }}</th>
                                <th>{{ __('vault.admin.access.note') }}</th>
                                <th></th>
                            </tr>
                            @forelse($accesos as $acceso)
                                @continue(!is_array($acceso))
                                <tr>
                                    <td class="middle"><code>{{ $acceso['discord_id'] ?? '' }}</code></td>
                                    <td class="middle">
                                        {{ $acceso['nombre'] ?? '' }}
                                        @if(empty($acceso['registrado']))
                                            <small class="text-muted">({{ __('vault.admin.access.unregistered') }})</small>
                                        @endif
                                    </td>
                                    <td class="middle">
                                        <span class="label label-primary">{{ __('vault.admin.access.levels.' . (in_array($acceso['nivel'] ?? '', $niveles, true) ? $acceso['nivel'] : 'ver')) }}</span>
                                    </td>
                                    <td class="middle">{{ $acceso['nota'] ?? '' }}</td>
                                    <td class="middle text-right">
                                        <form action="{{ route('admin.servers.view.vault.access', $server->id) }}" method="POST"
                                              onsubmit="return confirm({{ $confirmJs('vault.admin.access.remove_confirm') }});">
                                            {!! csrf_field() !!}
                                            <input type="hidden" name="accion" value="remove">
                                            <input type="hidden" name="discord_id" value="{{ $acceso['discord_id'] ?? '' }}">
                                            <button type="submit" class="btn btn-xs btn-danger" title="{{ __('vault.admin.access.remove') }}"><i class="fa fa-times"></i></button>
                                        </form>
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="5" class="text-center text-muted">{{ __('vault.admin.access.empty') }}</td>
                                </tr>
                            @endforelse
                        </table>
                    </div>
                    <div class="box-footer">
                        <form action="{{ route('admin.servers.view.vault.access', $server->id) }}" method="POST">
                            {!! csrf_field() !!}
                            <input type="hidden" name="accion" value="add">
                            <div class="row">
                                <div class="form-group col-sm-4">
                                    <label for="vaultDiscordId" class="control-label">{{ __('vault.admin.access.discord_id') }}</label>
                                    <input id="vaultDiscordId" type="text" name="discord_id" class="form-control" pattern="[0-9]{17,20}" required value="{{ old('discord_id') }}">
                                </div>
                                <div class="form-group col-sm-3">
                                    <label for="vaultNivel" class="control-label">{{ __('vault.admin.access.level') }}</label>
                                    <select id="vaultNivel" name="nivel" class="form-control">
                                        @foreach($niveles as $nivel)
                                            <option value="{{ $nivel }}">{{ __('vault.admin.access.levels.' . $nivel) }}</option>
                                        @endforeach
                                    </select>
                                </div>
                                <div class="form-group col-sm-5">
                                    <label for="vaultNota" class="control-label">{{ __('vault.admin.access.note') }}</label>
                                    <input id="vaultNota" type="text" name="nota" class="form-control" maxlength="200" value="{{ old('nota') }}">
                                </div>
                            </div>
                            <button type="submit" class="btn btn-success btn-sm">{{ __('vault.admin.access.add') }}</button>
                        </form>
                    </div>
                </div>
            </div>

            <div class="col-md-6">
                <div class="box box-primary">
                    <div class="box-header with-border">
                        <h3 class="box-title">{{ __('vault.admin.settings.title') }}</h3>
                    </div>
                    <form action="{{ route('admin.servers.view.vault.settings', $server->id) }}" method="POST">
                        <div class="box-body">
                            {!! csrf_field() !!}
                            <div class="form-group">
                                <label for="vaultCuota" class="control-label">{{ __('vault.admin.settings.quota_gb') }}</label>
                                <input id="vaultCuota" type="number" name="cuota_gb" class="form-control" min="0" step="0.01" value="{{ $cuotaGb }}">
                                <p class="text-muted small">{{ __('vault.admin.settings.quota_help') }}</p>
                            </div>
                            <div class="form-group">
                                <label for="vaultExclusiones" class="control-label">{{ __('vault.admin.settings.exclusions') }}</label>
                                <textarea id="vaultExclusiones" name="exclusiones" class="form-control" rows="6" spellcheck="false">{{ implode("\n", $exclusiones) }}</textarea>
                                <p class="text-muted small">{{ __('vault.admin.settings.exclusions_help') }}</p>
                                <p>
                                    <small>{{ __('vault.admin.settings.presets') }}:</small>
                                    @foreach($presets as $preset)
                                        <button type="button" class="btn btn-xs btn-default" data-vault-exclusion="{{ $preset }}"><code>{{ $preset }}</code></button>
                                    @endforeach
                                </p>
                            </div>
                            <div class="form-group">
                                <div class="checkbox checkbox-primary no-margin-bottom">
                                    <input id="vaultConsistencia" type="checkbox" name="consistencia" value="1" @if(!empty($servidor['consistencia'])) checked @endif>
                                    <label for="vaultConsistencia">{{ __('vault.admin.settings.consistency') }}</label>
                                </div>
                                <p class="text-muted small">{{ __('vault.admin.settings.consistency_help') }}</p>
                            </div>
                            <div class="form-group">
                                <label for="vaultMundosExtra" class="control-label">{{ __('vault.admin.settings.extra_worlds') }}</label>
                                <textarea id="vaultMundosExtra" name="mundos_extra" class="form-control" rows="3" spellcheck="false">{{ implode("\n", $mundosExtra) }}</textarea>
                                <p class="text-muted small">{{ __('vault.admin.settings.extra_worlds_help') }}</p>
                            </div>
                        </div>
                        <div class="box-footer">
                            <button type="submit" class="btn btn-primary btn-sm">{{ __('vault.admin.settings.save') }}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-xs-12">
                <div class="box box-primary">
                    <div class="box-header with-border">
                        <h3 class="box-title">{{ __('vault.admin.backups.title') }}</h3>
                    </div>
                    <div class="box-body table-responsive no-padding">
                        <table class="table table-hover">
                            <tr>
                                <th>{{ __('vault.admin.backups.folder') }}</th>
                                <th>{{ __('vault.admin.backups.name') }}</th>
                                <th>{{ __('vault.admin.backups.type') }}</th>
                                <th>{{ __('vault.admin.backups.scope') }}</th>
                                <th>{{ __('vault.admin.backups.files') }}</th>
                                <th>{{ __('vault.admin.backups.size') }}</th>
                                <th>{{ __('vault.admin.backups.created') }}</th>
                                <th>{{ __('vault.admin.backups.note') }}</th>
                                <th></th>
                            </tr>
                            @forelse($backups as $backup)
                                @continue(!is_array($backup))
                                <tr>
                                    <td class="middle">{{ $backup['carpeta'] ?? '' }}</td>
                                    <td class="middle">
                                        <code>{{ $backup['nombre'] ?? '' }}</code>
                                        @if(!empty($backup['fijada']))
                                            <span class="label label-warning"><i class="fa fa-thumb-tack"></i> {{ __('vault.admin.backups.pinned') }}</span>
                                        @endif
                                    </td>
                                    <td class="middle">{{ $backup['tipo'] ?? '' }}</td>
                                    <td class="middle">{{ $backup['alcance'] ?? '' }}</td>
                                    <td class="middle">{{ is_numeric($backup['archivos'] ?? null) ? number_format((int) $backup['archivos']) : '' }}</td>
                                    <td class="middle">{{ $formatBytes($backup['bytes'] ?? 0) }}</td>
                                    <td class="middle">{{ $formatTs($backup['creado_ts'] ?? null) }}</td>
                                    <td class="middle">{{ $backup['nota'] ?? '' }}</td>
                                    <td class="middle text-right" style="white-space: nowrap;">
                                        <form action="{{ route('admin.servers.view.vault.backups.pin', $server->id) }}" method="POST" style="display: inline-block;">
                                            {!! csrf_field() !!}
                                            <input type="hidden" name="carpeta" value="{{ $backup['carpeta'] ?? '' }}">
                                            <input type="hidden" name="nombre" value="{{ $backup['nombre'] ?? '' }}">
                                            <input type="hidden" name="fijada" value="{{ empty($backup['fijada']) ? '1' : '0' }}">
                                            <button type="submit" class="btn btn-xs btn-default">
                                                {{ empty($backup['fijada']) ? __('vault.admin.backups.pin') : __('vault.admin.backups.unpin') }}
                                            </button>
                                        </form>
                                        @if(empty($backup['fijada']))
                                            <form action="{{ route('admin.servers.view.vault.backups.delete', $server->id) }}" method="POST" style="display: inline-block;"
                                                  onsubmit="return confirm({{ $confirmJs('vault.admin.backups.delete_confirm') }});">
                                                {!! csrf_field() !!}
                                                <input type="hidden" name="carpeta" value="{{ $backup['carpeta'] ?? '' }}">
                                                <input type="hidden" name="nombre" value="{{ $backup['nombre'] ?? '' }}">
                                                <button type="submit" class="btn btn-xs btn-danger" title="{{ __('vault.admin.backups.delete') }}"><i class="fa fa-trash-o"></i></button>
                                            </form>
                                        @endif
                                    </td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="9" class="text-center text-muted">{{ __('vault.admin.backups.empty') }}</td>
                                </tr>
                            @endforelse
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-xs-12">
                <div class="box box-primary">
                    <div class="box-header with-border">
                        <h3 class="box-title">{{ __('vault.admin.jobs.title') }}</h3>
                    </div>
                    <div class="box-body table-responsive no-padding">
                        <table class="table table-hover">
                            <tr>
                                <th>{{ __('vault.admin.jobs.type') }}</th>
                                <th>{{ __('vault.admin.jobs.state') }}</th>
                                <th>{{ __('vault.admin.jobs.created') }}</th>
                                <th>{{ __('vault.admin.jobs.actor') }}</th>
                                <th>{{ __('vault.admin.jobs.summary') }}</th>
                                <th>{{ __('vault.admin.jobs.error') }}</th>
                            </tr>
                            @forelse($trabajos as $trabajo)
                                @continue(!is_array($trabajo))
                                <tr>
                                    <td class="middle">{{ $trabajo['tipo'] ?? '' }}</td>
                                    <td class="middle"><span class="label {{ $stateLabel($trabajo['estado'] ?? '') }}">{{ $trabajo['estado'] ?? '' }}</span></td>
                                    <td class="middle">{{ $formatTs($trabajo['creado_ts'] ?? null) }}</td>
                                    <td class="middle">{{ is_array($trabajo['actor'] ?? null) ? ($trabajo['actor']['nombre'] ?? '') : __('vault.admin.jobs.system') }}</td>
                                    <td class="middle">{{ $trabajo['resumen'] ?? '' }}</td>
                                    <td class="middle text-danger">{{ $trabajo['error'] ?? '' }}</td>
                                </tr>
                            @empty
                                <tr>
                                    <td colspan="6" class="text-center text-muted">{{ __('vault.admin.jobs.empty') }}</td>
                                </tr>
                            @endforelse
                        </table>
                    </div>
                </div>
            </div>
        </div>
    @endif
@endsection

@section('footer-scripts')
    @parent
    <script>
        document.querySelectorAll('[data-vault-exclusion]').forEach(function (button) {
            button.addEventListener('click', function () {
                var textarea = document.getElementById('vaultExclusiones');
                if (!textarea) {
                    return;
                }

                var pattern = button.getAttribute('data-vault-exclusion');
                var lines = textarea.value.split(/\r?\n/).map(function (line) {
                    return line.trim();
                }).filter(function (line) {
                    return line.length > 0;
                });

                if (lines.indexOf(pattern) === -1) {
                    lines.push(pattern);
                    textarea.value = lines.join('\n');
                }
            });
        });
    </script>
@endsection
