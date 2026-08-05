<?php

namespace Pterodactyl\Notifications;

use Pterodactyl\Models\User;
use Pterodactyl\Models\Server;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

class FreeServiceExpired extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private Server $server,
        private string $offerName,
    ) {
    }

    public function via(): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        return (new MailMessage())
            ->subject('Your Free Server Has Expired')
            ->greeting('Hello ' . $notifiable->username . ',')
            ->line('Your free server **' . $this->server->name . '** from the "' . $this->offerName . '" offer has expired and has been suspended.')
            ->line('If you would like to continue using this server, please contact an administrator to discuss upgrade options.')
            ->line('Server Name: ' . $this->server->name)
            ->action('View Your Servers', route('index'));
    }
}
