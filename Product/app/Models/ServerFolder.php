<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property int $id
 * @property int $user_id
 * @property int|null $parent_id
 * @property string $name
 * @property string|null $slug
 * @property string $color
 * @property int $sort_order
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property \Pterodactyl\Models\User $user
 * @property \Pterodactyl\Models\ServerFolder|null $parent
 * @property \Illuminate\Database\Eloquent\Collection|\Pterodactyl\Models\ServerFolder[] $children
 * @property \Illuminate\Database\Eloquent\Collection|\Pterodactyl\Models\Server[] $servers
 */
class ServerFolder extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'server_folders';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_id',
        'parent_id',
        'name',
        'slug',
        'color',
        'sort_order',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'user_id' => 'integer',
        'parent_id' => 'integer',
        'sort_order' => 'integer',
    ];

    /**
     * Validation rules for the model.
     */
    public static array $validationRules = [
        'user_id' => 'required|exists:users,id',
        'parent_id' => 'nullable|exists:server_folders,id',
        'name' => 'required|string|max:100',
        'slug' => 'nullable|string|max:100|regex:/^[a-z0-9-]+$/',
        'color' => 'required|string|max:7|regex:/^#[0-9A-Fa-f]{6}$/',
        'sort_order' => 'integer|min:0',
    ];

    /**
     * Get the user that owns the folder.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the parent folder.
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(ServerFolder::class, 'parent_id');
    }

    /**
     * Get the child folders.
     */
    public function children(): HasMany
    {
        return $this->hasMany(ServerFolder::class, 'parent_id')->orderBy('sort_order');
    }

    /**
     * Get all descendant folders recursively.
     */
    public function descendants(): HasMany
    {
        return $this->children()->with('descendants');
    }

    /**
     * Get the servers in this folder.
     */
    public function servers(): BelongsToMany
    {
        return $this->belongsToMany(Server::class, 'server_folder_servers', 'folder_id', 'server_id')
            ->withPivot('sort_order')
            ->withTimestamps()
            ->orderBy('server_folder_servers.sort_order');
    }

    /**
     * Get the count of servers in this folder (including nested).
     */
    public function getTotalServerCountAttribute(): int
    {
        $count = $this->servers()->count();
        
        foreach ($this->children as $child) {
            $count += $child->total_server_count;
        }
        
        return $count;
    }
}
