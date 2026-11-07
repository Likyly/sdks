<?php

namespace Likyly\Laravel\Http;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Likyly\Laravel\Likyly;

/** A click on a recommendation: recorded in LIKYLY, then the visitor goes to the product (a path of this site only). */
class ClickController
{
    public function __invoke(Request $request, Likyly $likyly): RedirectResponse
    {
        $to = (string) $request->query('to', '/');
        $safe = str_starts_with($to, '/') && ! str_starts_with($to, '//') && ! str_contains($to, '\\') ? $to : '/';
        $item = $request->query('item');
        if (is_string($item) && $item !== '') {
            $likyly->click($item, $request->query('rec') ?: null, $request->query('placement') ?: null);
        }

        return redirect($safe);
    }
}
