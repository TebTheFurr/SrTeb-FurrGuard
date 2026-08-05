<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommandHistory extends Model
{
    protected $table = 'command_history';

    protected $fillable = [
        'user_id',
        'server_id',
        'command',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'server_id' => 'integer',
    ];

    public static array $validationRules = [
        'user_id' => 'required|exists:users,id',
        'server_id' => 'required|exists:servers,id',
        'command' => 'required|string|max:1000',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }
}
