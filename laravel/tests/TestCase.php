<?php

namespace Likyly\Laravel\Tests;

use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Likyly\Laravel\Likyly;
use Likyly\Laravel\LikylyServiceProvider;
use Likyly\Laravel\Recommendable;
use Likyly\LikylyClient;
use Orchestra\Testbench\TestCase as Orchestra;

/** A fake LIKYLY API: queued JSON answers, every request recorded in $this->requests. */
abstract class TestCase extends Orchestra
{
    protected array $requests = [];

    protected MockHandler $api;

    protected function getPackageProviders($app): array
    {
        return [LikylyServiceProvider::class];
    }

    protected function defineEnvironment($app): void
    {
        $app['config']->set('database.default', 'testing');
        $app['config']->set('app.key', 'base64:'.base64_encode(str_repeat('k', 32)));
        $app['config']->set('likyly.key', 'pk_test');
        $app['config']->set('likyly.secret', 'sk_test');
        $app['config']->set('likyly.models', [Shoe::class]);
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->api = new MockHandler;
        $this->requests = [];
        $stack = HandlerStack::create($this->api);
        $stack->push(Middleware::history($this->requests));
        $http = new Client(['handler' => $stack]);
        $this->app->singleton(Likyly::class, fn ($app) => new Likyly($app['config']->get('likyly'), fn (string $key) => new LikylyClient(apiKey: $key, httpClient: $http, maxRetries: 0)));

        Schema::create('shoes', function (Blueprint $t) {
            $t->string('id')->primary();
            $t->string('name');
            $t->string('description')->nullable();
            $t->string('category')->nullable();
            $t->decimal('price')->nullable();
            $t->string('image')->nullable();
            $t->timestamps();
        });
        Route::middleware('web')->get('/shoes/{shoe}', fn (Shoe $shoe) => view('likyly-test::product', ['shoe' => $shoe]))->name('products.show');
        Route::middleware('web')->get('/', fn () => view('likyly-test::home'));
        Route::getRoutes()->refreshNameLookups();
        $this->app['view']->addNamespace('likyly-test', __DIR__.'/views');
    }

    protected function reply(int $status, array $body): void
    {
        $this->api->append(new Response($status, ['Content-Type' => 'application/json'], json_encode($body)));
    }

    /** @return array<int, array{method: string, path: string, query: string, body: mixed}> */
    protected function calls(): array
    {
        return array_map(fn ($t) => [
            'method' => $t['request']->getMethod(),
            'path' => $t['request']->getUri()->getPath(),
            'query' => $t['request']->getUri()->getQuery(),
            'body' => json_decode((string) $t['request']->getBody(), true),
        ], $this->requests);
    }

    protected function recommendation(array $ids, string $placement = 'pdp-similar'): array
    {
        return ['recommendation_id' => 'rec_1', 'placement' => $placement, 'strategy_used' => 'content', 'items' => array_map(fn ($id) => ['item_id' => $id, 'score' => 0.9], $ids)];
    }
}

class Shoe extends Model
{
    use Recommendable;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $guarded = [];
}
