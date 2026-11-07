<?php

namespace Likyly\Laravel\Console;

use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Model;
use Symfony\Component\Process\Process;

class InstallCommand extends Command
{
    protected $signature = 'likyly:install
        {--key= : Public key (pk_...), if the wizard did not write LIKYLY_KEY yet}
        {--secret= : Secret key (sk_...), to send the catalog}
        {--catalog= : The LIKYLY catalog the products go to}
        {--model=* : The Eloquent model(s) of your products, e.g. Product or App\\Models\\Product}
        {--no-sync : Do not send the catalog now}';

    protected $description = 'Set up LIKYLY: keys, config, your product model and the first catalog sync';

    public function handle(): int
    {
        $env = base_path('.env');
        $this->components->info('LIKYLY for Laravel');

        // 1. Keys
        $key = $this->option('key') ?: Files::readEnv($env, 'LIKYLY_KEY') ?: ($this->input->isInteractive() ? $this->ask('Public key (pk_..., from your LIKYLY console)') : null);
        if (! $key) {
            $this->components->error('No public key: run npx @likyly/wizard, or pass --key=pk_...');

            return self::FAILURE;
        }
        Files::setEnv($env, 'LIKYLY_KEY', $key);
        $secret = $this->option('secret') ?: Files::readEnv($env, 'LIKYLY_SECRET_KEY') ?: ($this->input->isInteractive() ? $this->secret('Secret key (sk_..., to send your catalog; leave empty to skip)') : null);
        if ($secret) {
            Files::setEnv($env, 'LIKYLY_SECRET_KEY', $secret);
        }
        if ($catalog = $this->option('catalog')) {
            Files::setEnv($env, 'LIKYLY_CATALOG', $catalog);
        }
        $this->components->task('Keys in .env', fn () => true);

        // 2. Config
        $config = config_path('likyly.php');
        if (! is_file($config)) {
            copy(__DIR__.'/../../config/likyly.php', $config);
        }
        $this->components->task('config/likyly.php', fn () => true);

        // 3. Product model(s)
        $models = $this->chooseModels();
        foreach ($models as $class) {
            $file = (new \ReflectionClass($class))->getFileName();
            $this->components->task("Recommendable on {$class}", function () use ($file, $config, $class) {
                Files::addTrait($file);
                Files::addModelToConfig($config, $class);

                return true;
            });
        }
        if ($models === []) {
            $this->components->warn('No product model chosen: add `use Likyly\Laravel\Recommendable;` to it, then list it in config/likyly.php.');
        }

        // 4. First catalog sync, in a new process: this one loaded the models before the trait was added.
        if ($secret && $models && ! $this->option('no-sync')) {
            $sync = new Process([PHP_BINARY, base_path('artisan'), 'likyly:sync'], base_path());
            $sync->setTimeout(null)->run(fn ($type, $out) => $this->output->write($out));
            if (! $sync->isSuccessful()) {
                $this->components->error('The catalog was not sent: fix the error above, then run php artisan likyly:sync');

                return self::FAILURE;
            }
        } elseif (! $secret) {
            $this->components->warn('No secret key: the catalog is not sent from Laravel (connect it from the LIKYLY console instead).');
        }

        $this->newLine();
        $this->line('  Show a block in any Blade view:');
        $this->line('    <x-likyly-recommendations placement="pdp-similar" :item="$product" title="You may also like" />');
        $this->line('    <x-likyly-recommendations placement="home-trending" title="Trending now" />');
        $this->line('  Record a sale:  Likyly::purchase($product, $order->id, $quantity);');
        $this->line('  Check everything:  php artisan likyly:status');

        return self::SUCCESS;
    }

    /** @return array<class-string<Model>> */
    private function chooseModels(): array
    {
        $given = array_map(fn ($m) => str_contains($m, '\\') ? ltrim($m, '\\') : "App\\Models\\{$m}", $this->option('model'));
        if ($given) {
            foreach ($given as $class) {
                if (! is_subclass_of($class, Model::class)) {
                    throw new \InvalidArgumentException("{$class} is not an Eloquent model");
                }
            }

            return $given;
        }
        $candidates = [];
        foreach (glob(app_path('Models/*.php')) ?: [] as $file) {
            $class = 'App\\Models\\'.basename($file, '.php');
            if ($class !== 'App\\Models\\User' && class_exists($class) && is_subclass_of($class, Model::class)) {
                $candidates[] = $class;
            }
        }
        if ($candidates === []) {
            return [];
        }
        $likely = collect($candidates)->first(fn ($c) => preg_match('/(Product|Item|Article|Book|Course|Listing|Offer|Post)$/', $c)) ?? $candidates[0];
        if (! $this->input->isInteractive()) {
            return [$likely];
        }

        return [$this->choice('Which model holds your products?', $candidates, array_search($likely, $candidates, true))];
    }
}
