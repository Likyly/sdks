<?php

namespace Likyly\Laravel;

use Likyly\Laravel\Jobs\SyncToLikyly;

/**
 * Add `use Recommendable;` to the Eloquent model of your products: every create, update and delete
 * goes to LIKYLY (through your queue when likyly.queue is true), and <x-likyly-recommendations>
 * can render its items.
 *
 * Override what LIKYLY receives or how a card looks:
 *   public function toLikylyItem(): array   // itemId, title, description, properties
 *   public function likylyUrl(): ?string    // the product page
 *   public function likylyImage(): ?string  // the picture shown in a block
 *   public function shouldSyncToLikyly(): bool
 */
trait Recommendable
{
    public static function bootRecommendable(): void
    {
        static::saved(fn ($model) => SyncToLikyly::send($model::class, [Likyly::itemId($model)]));
        static::deleted(fn ($model) => SyncToLikyly::send($model::class, [Likyly::itemId($model)], delete: true));
    }

    /** What LIKYLY knows about the item: guessed from common column names, override it to choose. */
    public function toLikylyItem(): array
    {
        $a = $this->attributesToArray();
        $properties = [];
        foreach (['category', 'brand', 'price', 'currency', 'stock'] as $field) {
            if (isset($a[$field]) && $a[$field] !== '') {
                $properties[$field] = $a[$field];
            }
        }
        foreach (['image' => $this->likylyImage(), 'url' => $this->likylyUrl()] as $field => $value) {
            if ($value) {
                $properties[$field] = $value;
            }
        }

        return [
            'itemId' => Likyly::itemId($this),
            'title' => (string) ($a['name'] ?? $a['title'] ?? Likyly::itemId($this)),
            'description' => $a['long_description'] ?? $a['description'] ?? $a['summary'] ?? null,
            'properties' => $properties,
        ];
    }

    /** The product page. Default: a route named products.show or product.show, if the app has one. */
    public function likylyUrl(): ?string
    {
        foreach (['products.show', 'product.show'] as $name) {
            if (app('router')->has($name)) {
                return route($name, $this);
            }
        }

        return null;
    }

    public function likylyImage(): ?string
    {
        $a = $this->attributesToArray();
        $image = $a['image'] ?? $a['image_url'] ?? $a['thumbnail'] ?? $a['picture'] ?? null;

        return is_string($image) && $image !== '' ? $image : null;
    }

    public function shouldSyncToLikyly(): bool
    {
        return true;
    }
}
