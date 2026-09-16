<?php

declare(strict_types=1);

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Activation of the Tebby Vault for a single server.
 *
 * @property int $server_id
 * @property bool $enabled
 * @property \Illuminate\Support\Carbon|null $enabled_at
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property Server $server
 */
class VaultServer extends Model
{
    public const RESOURCE_NAME = 'vault_server';

    public $incrementing = false;

    protected $table = 'vault_servers';

    protected $primaryKey = 'server_id';

    protected $keyType = 'int';

    protected $fillable = ['server_id', 'enabled', 'enabled_at'];

    protected $casts = [
        'server_id' => 'integer',
        'enabled' => 'boolean',
        'enabled_at' => 'datetime',
    ];

    protected $attributes = [
        'enabled' => false,
    ];

    public static array $validationRules = [
        'server_id' => 'required|integer|exists:servers,id',
        'enabled' => 'boolean',
        'enabled_at' => 'nullable|date',
    ];

    /**
     * @return BelongsTo<Server, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }
}
