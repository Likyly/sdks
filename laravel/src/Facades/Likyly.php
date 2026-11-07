<?php

namespace Likyly\Laravel\Facades;

use Illuminate\Support\Facades\Facade;

/**
 * @method static \Likyly\Model\PlacementRecommendation|null recommend(string $placement, \Illuminate\Database\Eloquent\Model|string|null $item = null, array $context = [], ?int $limit = null)
 * @method static void view(\Illuminate\Database\Eloquent\Model|string $item)
 * @method static void addToCart(\Illuminate\Database\Eloquent\Model|string $item, int $quantity = 1)
 * @method static void purchase(\Illuminate\Database\Eloquent\Model|string $item, string|int $orderId, int $quantity = 1, ?float $price = null, ?string $currency = null)
 * @method static void track(string $type, \Illuminate\Database\Eloquent\Model|string $item, array $fields = [])
 * @method static int syncModels(iterable $models)
 * @method static string sessionId()
 * @method static \Likyly\LikylyClient client()
 *
 * @see \Likyly\Laravel\Likyly
 */
class Likyly extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return \Likyly\Laravel\Likyly::class;
    }
}
