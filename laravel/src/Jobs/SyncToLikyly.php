<?php

namespace Likyly\Laravel\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;
use Likyly\Laravel\Likyly;

/** Sends changed models to the LIKYLY catalog, or removes deleted ones. Queued when likyly.queue is true. */
class SyncToLikyly implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public int $backoff = 30;

    /** @param array<string> $ids */
    public function __construct(public string $model, public array $ids, public bool $delete = false)
    {
    }

    /** Runs now, or on the queue when likyly.queue is true. Never throws into the request. */
    public static function send(string $model, array $ids, bool $delete = false): void
    {
        $likyly = app(Likyly::class);
        if (! $likyly->config('secret')) {
            return; // no secret key: catalog sync is off (likyly:status says so)
        }
        $job = new self($model, $ids, $delete);
        if ($likyly->config('queue')) {
            dispatch($job);

            return;
        }
        try {
            $job->handle($likyly);
        } catch (\Throwable $e) {
            Log::warning("LIKYLY: catalog not updated for {$model} ".implode(', ', $ids).": {$e->getMessage()}");
        }
    }

    public function handle(Likyly $likyly): void
    {
        if ($this->delete) {
            $likyly->removeItems($this->ids);

            return;
        }
        $model = $this->model;
        $instance = new $model;
        $likyly->syncModels($model::query()->whereIn($instance->getKeyName(), $this->ids)->get());
    }
}
