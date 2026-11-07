<?php

namespace Likyly\Laravel\Http;

use Closure;
use Illuminate\Http\Request;
use Likyly\Laravel\Likyly;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gives every visitor an anonymous LIKYLY id, kept one year in a first-party cookie, so their
 * recommendations follow what they look at - no login needed. Added to the "web" group by the package.
 */
class EnsureLikylySession
{
    public function __construct(private readonly Likyly $likyly)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $name = $this->likyly->config('cookie', 'likyly_sid');
        $current = $request->cookie($name);
        $valid = is_string($current) && preg_match('/^[A-Za-z0-9_-]{8,64}$/', $current);
        $id = $valid ? $current : Likyly::newSessionId();
        $request->attributes->set('likyly_session_id', $id);

        $response = $next($request);
        if (! $valid) {
            $response->headers->setCookie(Cookie::create($name, $id, now()->addYear(), '/', null, $request->isSecure(), true, false, Cookie::SAMESITE_LAX));
        }

        return $response;
    }
}
