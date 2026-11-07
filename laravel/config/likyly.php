<?php

return [

    // Public key (pk_...): recommendations and events. Safe anywhere; the wizard writes it.
    'key' => env('LIKYLY_KEY'),

    // Secret key (sk_...): sends your catalog to LIKYLY. Server only, never in a page.
    'secret' => env('LIKYLY_SECRET_KEY'),

    // Which of your LIKYLY catalogs the products go to (leave empty if you have only one).
    'catalog' => env('LIKYLY_CATALOG'),

    // Only to point at another LIKYLY API (a local one, a staging one).
    'base_url' => env('LIKYLY_BASE_URL'),

    // The Eloquent models that are your catalog (each uses the Likyly\Laravel\Recommendable trait).
    // The first one is what <x-likyly-recommendations> shows by default. php artisan likyly:install fills it.
    'models' => [
        // likyly:models
    ],

    // Send catalog changes through your queue instead of during the request (true when you run a worker).
    'queue' => env('LIKYLY_QUEUE', false),

    // How long LIKYLY may take before a block is left out of the page (seconds).
    'timeout' => 3.0,

    // The first-party cookie that keeps an anonymous visitor's id (one year).
    'cookie' => 'likyly_sid',

    // Where clicks on a recommendation go through (recorded, then redirected to the product).
    'click_path' => 'likyly/click',

];
