<?php

namespace Pterodactyl\Http\Controllers\Auth;

use Illuminate\Http\Request;
use Pterodactyl\Models\User;
use Illuminate\Http\RedirectResponse;
use Pterodactyl\Http\Controllers\Controller;

class EmailVerificationController extends Controller
{
    public function verify(Request $request, int $id, string $hash): RedirectResponse
    {
        if (!$request->hasValidSignature()) {
            return redirect('/')->with('error', 'Invalid or expired verification link.');
        }

        $user = User::findOrFail($id);

        if (!hash_equals($hash, sha1($user->email))) {
            return redirect('/')->with('error', 'Invalid verification link.');
        }

        if ($user->email_verified_at) {
            return redirect('/');
        }

        $user->email_verified_at = now();
        $user->save();

        return redirect('/');
    }
}
