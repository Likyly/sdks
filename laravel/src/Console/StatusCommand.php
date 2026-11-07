<?php

namespace Likyly\Laravel\Console;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Route;
use Likyly\Laravel\Likyly;
use Likyly\Laravel\Recommendable;

class StatusCommand extends Command
{
    protected $signature = 'likyly:status';

    protected $description = 'Check the LIKYLY setup: keys, API, catalog, blocks';

    public function handle(Likyly $likyly): int
    {
        $ok = true;
        $check = function (bool $pass, string $label, string $fix = '') use (&$ok) {
            $ok = $ok && $pass;
            $this->line(($pass ? '  <fg=green>✓</> ' : '  <fg=red>✗</> ').$label.(! $pass && $fix ? "  <fg=gray>→ {$fix}</>" : ''));
        };

        $this->components->info('LIKYLY status');
        $key = (string) $likyly->config('key');
        $check(str_starts_with($key, 'pk_'), 'Public key (LIKYLY_KEY)', 'npx @likyly/wizard, or php artisan likyly:install --key=pk_...');
        $secret = (string) $likyly->config('secret');
        $check($secret === '' || str_starts_with($secret, 'sk_'), $secret === '' ? 'Secret key: not set (catalog not sent from Laravel)' : 'Secret key (LIKYLY_SECRET_KEY)', 'it starts with sk_');

        if ($key) {
            try {
                $likyly->client()->recommendations()->get(limit: 1);
                $check(true, 'LIKYLY API answers'.($likyly->config('base_url') ? ' ('.$likyly->config('base_url').')' : ''));
            } catch (\Throwable $e) {
                $check(false, 'LIKYLY API: '.$e->getMessage(), 'check the key and LIKYLY_BASE_URL');
            }
        }

        foreach ($likyly->models() as $class) {
            $local = $class::query()->count();
            $check(in_array(Recommendable::class, class_uses_recursive($class), true), "{$class}: {$local} item(s), Recommendable", 'add `use Recommendable;` to the model');
        }
        if ($likyly->models() === []) {
            $check(false, 'No product model in config/likyly.php', 'php artisan likyly:install');
        }
        if ($secret) {
            try {
                $total = $likyly->catalogClient()->items()->list(limit: 1)->total;
                $check($total > 0, "LIKYLY catalog: {$total} item(s)".($likyly->config('catalog') ? ' in '.$likyly->config('catalog') : ''), 'php artisan likyly:sync');
            } catch (\Throwable $e) {
                $check(false, 'LIKYLY catalog: '.$e->getMessage());
            }
        }
        $check(Route::has('likyly.click'), 'Click tracking route ('.config('likyly.click_path').')');

        $this->newLine();
        $this->line($ok ? '  Ready. Blocks: <x-likyly-recommendations placement="..." />' : '  Fix the lines marked ✗, then run likyly:status again.');

        return $ok ? self::SUCCESS : self::FAILURE;
    }
}
