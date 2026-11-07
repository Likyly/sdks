<?php

namespace Likyly\Laravel\Console;

use Illuminate\Console\Command;
use Likyly\Laravel\Likyly;

class SyncCommand extends Command
{
    protected $signature = 'likyly:sync {--model=* : Only these models}';

    protected $description = 'Send your whole catalog to LIKYLY (models listed in config/likyly.php)';

    public function handle(Likyly $likyly): int
    {
        if (! $likyly->config('secret')) {
            $this->components->error('LIKYLY_SECRET_KEY is not set: the catalog needs the secret key.');

            return self::FAILURE;
        }
        $models = $this->option('model') ?: $likyly->models();
        if ($models === []) {
            $this->components->error('No model in config/likyly.php (models). Run php artisan likyly:install.');

            return self::FAILURE;
        }
        $failed = false;
        foreach ($models as $class) {
            $this->components->task("Catalog: {$class}", function () use ($likyly, $class, &$count, &$failed) {
                try {
                    $count = $likyly->syncModels($class::query()->lazy(500));

                    return true;
                } catch (\Throwable $e) {
                    $this->components->error($e->getMessage());
                    $failed = true;

                    return false;
                }
            });
            if (! $failed) {
                $this->line("    {$count} item(s) sent");
            }
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
