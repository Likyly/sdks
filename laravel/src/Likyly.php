<?php

namespace Likyly\Laravel;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Likyly\LikylyClient;

/**
 * Everything the package does with LIKYLY, behind the Likyly facade. Recommendations and events use
 * the public key; the catalog (items) uses the secret key. A LIKYLY error never breaks a page: it is
 * logged and the block is left out.
 */
class Likyly
{
    private ?LikylyClient $public = null;
    private ?LikylyClient $secret = null;
    private ?string $sessionId = null;

    /** @param \Closure(string $apiKey): LikylyClient|null $makeClient (tests inject a fake HTTP client) */
    public function __construct(private readonly array $config, private readonly ?\Closure $makeClient = null)
    {
    }

    public function client(): LikylyClient
    {
        return $this->public ??= $this->make($this->config['key'] ?? null, 'LIKYLY_KEY');
    }

    /** The client for the catalog: needs the secret key. */
    public function catalogClient(): LikylyClient
    {
        return $this->secret ??= $this->make($this->config['secret'] ?? null, 'LIKYLY_SECRET_KEY');
    }

    /** The anonymous visitor's id (cookie set by the EnsureLikylySession middleware). */
    public function sessionId(?Request $request = null): string
    {
        $request ??= request();
        if ($id = $request->attributes->get('likyly_session_id')) {
            return $id;
        }
        $cookie = $request->cookie($this->config['cookie'] ?? 'likyly_sid');

        return $this->sessionId ??= is_string($cookie) && preg_match('/^[A-Za-z0-9_-]{8,64}$/', $cookie) ? $cookie : self::newSessionId();
    }

    public static function newSessionId(): string
    {
        return 'sess_'.bin2hex(random_bytes(12));
    }

    /**
     * Recommendations of a placement for the current visitor, or null when LIKYLY cannot answer.
     *
     * @param  array<string, mixed>  $context  extra context: userId, categoryId, cartItemIds...
     */
    public function recommend(string $placement, Model|string|null $item = null, array $context = [], ?int $limit = null): ?\Likyly\Model\PlacementRecommendation
    {
        $itemId = $item instanceof Model ? self::itemId($item) : $item;
        $userId = auth()->check() ? (string) auth()->id() : null;
        try {
            return $this->client()->placements()->recommend($placement, context: array_filter([
                'itemId' => $itemId,
                'sessionId' => $this->sessionId(),
                'userId' => $userId,
                ...$context,
            ], fn ($v) => $v !== null && $v !== []), limit: $limit);
        } catch (\Throwable $e) {
            Log::warning("LIKYLY: placement {$placement} unavailable: {$e->getMessage()}");

            return null;
        }
    }

    /** Records that these recommended items were displayed. */
    public function impressions(string $placement, string $recommendationId, array $itemIds): void
    {
        if ($itemIds === []) {
            return;
        }
        $base = ['type' => 'impression', 'sessionId' => $this->sessionId(), 'userId' => auth()->check() ? (string) auth()->id() : null, 'recommendationId' => $recommendationId, 'placement' => $placement];
        $this->safely(fn () => $this->client()->events()->trackMany(array_map(fn ($id) => [...$base, 'itemId' => (string) $id], array_values($itemIds))));
    }

    public function click(string $itemId, ?string $recommendationId = null, ?string $placement = null): void
    {
        $this->safely(fn () => $this->client()->events()->click(itemId: $itemId, sessionId: $this->sessionId(), userId: auth()->check() ? (string) auth()->id() : null, recommendationId: $recommendationId, placement: $placement));
    }

    public function view(Model|string $item): void
    {
        $this->track('view', $item);
    }

    public function addToCart(Model|string $item, int $quantity = 1): void
    {
        $this->track('add_to_cart', $item, ['quantity' => $quantity]);
    }

    /**
     * A purchased line. Replaying it with the same order id never counts it twice.
     */
    public function purchase(Model|string $item, string|int $orderId, int $quantity = 1, ?float $price = null, ?string $currency = null): void
    {
        $itemId = $item instanceof Model ? self::itemId($item) : $item;
        $this->track('purchase', $itemId, [
            'quantity' => $quantity,
            'eventId' => "purchase_{$orderId}_{$itemId}",
            'properties' => array_filter(['orderId' => (string) $orderId, 'price' => $price, 'currency' => $currency], fn ($v) => $v !== null),
        ]);
    }

    /** Any event type (view, add_to_cart, favorite, share...). */
    public function track(string $type, Model|string $item, array $fields = []): void
    {
        $itemId = $item instanceof Model ? self::itemId($item) : $item;
        $userId = auth()->check() ? (string) auth()->id() : null;
        $this->safely(fn () => $this->client()->events()->trackMany([[
            'type' => $type, 'itemId' => $itemId, 'sessionId' => $this->sessionId(), 'userId' => $userId, ...$fields,
        ]]));
    }

    /**
     * Sends models to the catalog (create or update), 1000 at a time.
     *
     * @param  iterable<Model>  $models
     * @return int how many were sent
     */
    public function syncModels(iterable $models): int
    {
        $batch = [];
        $sent = 0;
        foreach ($models as $model) {
            if (method_exists($model, 'shouldSyncToLikyly') && ! $model->shouldSyncToLikyly()) {
                continue;
            }
            $batch[] = $model->toLikylyItem();
            if (count($batch) === 1000) {
                $this->catalogClient()->items()->upsertMany($batch);
                $sent += 1000;
                $batch = [];
            }
        }
        if ($batch !== []) {
            $this->catalogClient()->items()->upsertMany($batch);
            $sent += count($batch);
        }

        return $sent;
    }

    /** @param  array<string>  $itemIds */
    public function removeItems(array $itemIds): void
    {
        if ($itemIds !== []) {
            $this->catalogClient()->items()->deleteMany(array_values($itemIds));
        }
    }

    /** The models of the catalog, from config('likyly.models'). @return array<class-string<Model>> */
    public function models(): array
    {
        return array_values(array_filter($this->config['models'] ?? [], 'class_exists'));
    }

    public function config(string $key, mixed $default = null): mixed
    {
        return $this->config[$key] ?? $default;
    }

    public static function itemId(Model $model): string
    {
        return method_exists($model, 'likylyId') ? $model->likylyId() : (string) $model->getKey();
    }

    private function make(?string $key, string $envName): LikylyClient
    {
        if (! $key) {
            throw new \RuntimeException("LIKYLY: {$envName} is not set (php artisan likyly:install).");
        }
        if ($this->makeClient) {
            return ($this->makeClient)($key);
        }

        return new LikylyClient(apiKey: $key, baseUrl: $this->config['base_url'] ?: null, catalog: $this->config['catalog'] ?: null, timeout: (float) ($this->config['timeout'] ?? 3.0), userAgent: 'likyly-laravel');
    }

    private function safely(\Closure $call): void
    {
        try {
            $call();
        } catch (\Throwable $e) {
            Log::warning("LIKYLY: event not sent: {$e->getMessage()}");
        }
    }
}
