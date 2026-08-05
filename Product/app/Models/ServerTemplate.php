<?php

namespace Pterodactyl\Models;

class ServerTemplate extends Model
{
    protected $table = 'server_templates';

    protected $fillable = [
        'name',
        'description',
        'nest_id',
        'egg_id',
        'cpu',
        'threads',
        'memory',
        'swap',
        'disk',
        'io',
        'oom_disabled',
        'database_limit',
        'allocation_limit',
        'backup_limit',
        'order',
    ];

    protected $casts = [
        'nest_id' => 'integer',
        'egg_id' => 'integer',
        'cpu' => 'integer',
        'memory' => 'integer',
        'swap' => 'integer',
        'disk' => 'integer',
        'io' => 'integer',
        'oom_disabled' => 'boolean',
        'database_limit' => 'integer',
        'allocation_limit' => 'integer',
        'backup_limit' => 'integer',
        'order' => 'integer',
    ];

    protected $attributes = [
        'cpu' => 0,
        'swap' => 0,
        'io' => 500,
        'oom_disabled' => true,
        'database_limit' => 0,
        'allocation_limit' => 0,
        'backup_limit' => 0,
        'order' => 0,
    ];

    public static array $validationRules = [
        'name' => 'required|string|max:191',
        'description' => 'nullable|string|max:1000',
        'nest_id' => 'nullable|integer|exists:nests,id',
        'egg_id' => 'nullable|integer|exists:eggs,id',
        'cpu' => 'required|integer|min:0',
        'threads' => 'nullable|regex:/^[0-9-,]+$/',
        'memory' => 'required|integer|min:0',
        'swap' => 'required|integer|min:-1',
        'disk' => 'required|integer|min:0',
        'io' => 'required|integer|between:10,1000',
        'oom_disabled' => 'boolean',
        'database_limit' => 'nullable|integer|min:-1',
        'allocation_limit' => 'nullable|integer|min:-1',
        'backup_limit' => 'nullable|integer|min:-1',
        'order' => 'integer',
    ];

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'nest_id' => $this->nest_id,
            'egg_id' => $this->egg_id,
            'cpu' => $this->cpu,
            'threads' => $this->threads,
            'memory' => $this->memory,
            'swap' => $this->swap,
            'disk' => $this->disk,
            'io' => $this->io,
            'oom_disabled' => $this->oom_disabled,
            'database_limit' => $this->database_limit,
            'allocation_limit' => $this->allocation_limit,
            'backup_limit' => $this->backup_limit,
            'order' => $this->order,
        ];
    }

    public function applyToServerData(array $data): array
    {
        if ($this->nest_id) {
            $data['nest_id'] = $this->nest_id;
        }
        
        if ($this->egg_id) {
            $data['egg_id'] = $this->egg_id;
        }
        
        $data['cpu'] = $this->cpu;
        $data['threads'] = $this->threads;
        $data['memory'] = $this->memory;
        $data['swap'] = $this->swap;
        $data['disk'] = $this->disk;
        $data['io'] = $this->io;
        $data['oom_disabled'] = $this->oom_disabled;
        $data['database_limit'] = $this->database_limit;
        $data['allocation_limit'] = $this->allocation_limit;
        $data['backup_limit'] = $this->backup_limit;

        return $data;
    }
}
