<?php

namespace Likyly\Laravel\Console;

use Illuminate\Console\Command;
use Likyly\Laravel\Likyly;

class UninstallCommand extends Command
{
    protected $signature = 'likyly:uninstall {--force : Do not ask}';

    protected $description = 'Remove what likyly:install added (trait, config, keys). Your LIKYLY account is not touched.';

    public function handle(Likyly $likyly): int
    {
        $models = $likyly->models();
        $this->line('  This removes: the Recommendable trait from '.($models ? implode(', ', $models) : 'no model').', config/likyly.php, and the LIKYLY_* lines of .env.');
        $this->line('  The <x-likyly-recommendations> tags in your views stay: remove them before composer remove likyly/laravel.');
        if (! $this->option('force') && ! $this->confirm('Continue?', true)) {
            return self::SUCCESS;
        }
        foreach ($models as $class) {
            Files::removeTrait((new \ReflectionClass($class))->getFileName());
        }
        @unlink(config_path('likyly.php'));
        Files::removeEnv(base_path('.env'), ['LIKYLY_KEY', 'LIKYLY_SECRET_KEY', 'LIKYLY_CATALOG', 'LIKYLY_BASE_URL', 'LIKYLY_QUEUE']);
        $this->components->info('Done. Last step: composer remove likyly/laravel');

        return self::SUCCESS;
    }
}
