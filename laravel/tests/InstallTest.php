<?php

namespace Likyly\Laravel\Tests;

use Likyly\Laravel\Console\Files;
use PHPUnit\Framework\TestCase;

class InstallTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir().'/likyly-install-'.uniqid();
        mkdir($this->dir);
    }

    public function test_the_trait_is_added_once_and_removed_cleanly(): void
    {
        $original = <<<'PHP'
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $guarded = [];
}
PHP;
        file_put_contents($file = $this->dir.'/Product.php', $original);
        $this->assertTrue(Files::addTrait($file));
        $this->assertFalse(Files::addTrait($file));
        $code = file_get_contents($file);
        $this->assertStringContainsString("use Illuminate\\Database\\Eloquent\\Model;\nuse Likyly\\Laravel\\Recommendable;", $code);
        $this->assertStringContainsString("{\n    use Recommendable;\n\n    protected", $code);
        exec('php -l '.escapeshellarg($file), $out, $status);
        $this->assertSame(0, $status);

        Files::removeTrait($file);
        $this->assertSame($original, file_get_contents($file));
    }

    public function test_an_existing_trait_list_gets_recommendable_appended(): void
    {
        file_put_contents($file = $this->dir.'/Product.php', "<?php\n\nnamespace App\\Models;\n\nuse Illuminate\\Database\\Eloquent\\Model;\nuse Illuminate\\Database\\Eloquent\\Factories\\HasFactory;\n\nclass Product extends Model\n{\n    use HasFactory;\n}\n");
        Files::addTrait($file);
        $this->assertStringContainsString('use HasFactory, Recommendable;', file_get_contents($file));
    }

    public function test_env_lines_are_set_replaced_and_removed(): void
    {
        file_put_contents($env = $this->dir.'/.env', "APP_NAME=Shop\nLIKYLY_KEY=pk_old\n");
        Files::setEnv($env, 'LIKYLY_KEY', 'pk_new');
        Files::setEnv($env, 'LIKYLY_SECRET_KEY', 'sk_1');
        $this->assertSame("APP_NAME=Shop\nLIKYLY_KEY=pk_new\nLIKYLY_SECRET_KEY=sk_1\n", file_get_contents($env));
        $this->assertSame('pk_new', Files::readEnv($env, 'LIKYLY_KEY'));
        Files::removeEnv($env, ['LIKYLY_KEY', 'LIKYLY_SECRET_KEY']);
        $this->assertSame("APP_NAME=Shop\n", file_get_contents($env));
    }

    public function test_models_are_listed_in_the_config(): void
    {
        copy(__DIR__.'/../config/likyly.php', $config = $this->dir.'/likyly.php');
        Files::addModelToConfig($config, 'App\\Models\\Product');
        Files::addModelToConfig($config, 'App\\Models\\Product');
        $text = file_get_contents($config);
        $this->assertSame(1, substr_count($text, '\\App\\Models\\Product::class,'));
        $this->assertStringContainsString('// likyly:models', $text);
        exec('php -l '.escapeshellarg($config), $out, $status);
        $this->assertSame(0, $status);
    }
}
