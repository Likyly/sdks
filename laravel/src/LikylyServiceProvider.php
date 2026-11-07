<?php

namespace Likyly\Laravel;

use Illuminate\Contracts\Http\Kernel;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider;
use Likyly\Laravel\Http\EnsureLikylySession;
use Likyly\Laravel\View\Components\Recommendations;

class LikylyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__.'/../config/likyly.php', 'likyly');
        $this->app->singleton(Likyly::class, fn ($app) => new Likyly($app['config']->get('likyly', [])));
    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__.'/../resources/views', 'likyly');
        $this->loadRoutesFrom(__DIR__.'/../routes/likyly.php');
        Blade::component('likyly-recommendations', Recommendations::class);

        // Every page of the "web" group gets the anonymous visitor id.
        // (on the HTTP kernel: it rewrites the router's groups when it handles a request).
        $kernel = $this->app->make(Kernel::class);
        if (method_exists($kernel, 'appendMiddlewareToGroup')) {
            $kernel->appendMiddlewareToGroup('web', EnsureLikylySession::class);
        }
        $this->app->make(Router::class)->pushMiddlewareToGroup('web', EnsureLikylySession::class);
        // The cookie is a random id, not a secret: kept readable so it survives an APP_KEY rotation.
        if (class_exists(\Illuminate\Cookie\Middleware\EncryptCookies::class)) {
            \Illuminate\Cookie\Middleware\EncryptCookies::except([config('likyly.cookie', 'likyly_sid')]);
        }

        if ($this->app->runningInConsole()) {
            $this->publishes([__DIR__.'/../config/likyly.php' => config_path('likyly.php')], 'likyly-config');
            $this->publishes([__DIR__.'/../resources/views' => resource_path('views/vendor/likyly')], 'likyly-views');
            $this->commands([
                Console\InstallCommand::class,
                Console\SyncCommand::class,
                Console\StatusCommand::class,
                Console\UninstallCommand::class,
            ]);
        }
    }
}
