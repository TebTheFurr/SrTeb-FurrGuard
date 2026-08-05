<?php

namespace Pterodactyl\Notifications;

use Pterodactyl\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Support\Facades\URL;
use Illuminate\Notifications\Notification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

class VerifyEmail extends Notification implements ShouldQueue
{
    use Queueable;

    public function via(): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        $url = URL::temporarySignedRoute(
            'auth.verify-email',
            now()->addHours(48),
            ['id' => $notifiable->id, 'hash' => sha1($notifiable->email)]
        );

        return (new MailMessage())
            ->subject('Verify Your Email Address')
            ->greeting('Hello ' . $notifiable->username . ',')
            ->line('Please verify your email address by clicking the button below.')
            ->action('Verify Email', $url)
            ->line('This link will expire in 48 hours.')
            ->line('If you did not create an account, no further action is required.');
    }
}
