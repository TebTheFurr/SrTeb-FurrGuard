<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServerSplit extends Model
{
    protected $table = 'server_splits';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected $casts = [
        'parent_server_id' => 'integer',
        'split_server_id' => 'integer',
        'user_id' => 'integer',
        'memory' => 'integer',
        'cpu' => 'integer',
        'disk' => 'integer',
        'allocations' => 'integer',
        'database_limit' => 'integer',
        'backup_limit' => 'integer',
        'allocation_limit' => 'integer',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Server::class, 'parent_server_id');
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class, 'split_server_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
