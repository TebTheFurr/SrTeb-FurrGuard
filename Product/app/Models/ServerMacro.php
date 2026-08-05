<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServerMacro extends Model
{
    protected $table = 'server_macros';

    protected $fillable = [
        'server_id',
        'shortcut',
        'output',
        'arguments',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'arguments' => 'array',
    ];

    public static array $validationRules = [
        'server_id' => 'required|exists:servers,id',
        'shortcut' => 'required|string|max:100',
        'output' => 'required|string|max:5000',
        'arguments' => 'nullable|array',
        'arguments.*.name' => 'required|string|max:50',
    ];

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }
}
