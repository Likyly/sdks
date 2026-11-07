<?php

namespace Likyly\Laravel\Console;

/** The few file edits the artisan commands make: .env lines, the trait in a model, the models list. */
final class Files
{
    public static function setEnv(string $path, string $name, string $value): void
    {
        $text = is_file($path) ? file_get_contents($path) : '';
        $line = $name.'='.(preg_match('/[\s#"]/', $value) ? '"'.addslashes($value).'"' : $value);
        if (preg_match("/^{$name}=.*$/m", $text)) {
            $text = preg_replace("/^{$name}=.*$/m", $line, $text);
        } else {
            $text = rtrim($text, "\n").($text === '' ? '' : "\n").$line."\n";
        }
        file_put_contents($path, $text);
    }

    public static function removeEnv(string $path, array $names): void
    {
        if (! is_file($path)) {
            return;
        }
        $text = file_get_contents($path);
        foreach ($names as $name) {
            $text = preg_replace("/^{$name}=.*\n?/m", '', $text);
        }
        file_put_contents($path, $text);
    }

    public static function readEnv(string $path, string $name): ?string
    {
        if (is_file($path) && preg_match("/^{$name}=(.*)$/m", file_get_contents($path), $m)) {
            $value = trim($m[1], " \"'");

            return $value === '' ? null : $value;
        }

        return null;
    }

    /** Adds the Recommendable trait to a model class file. Returns false when it was already there. */
    public static function addTrait(string $file): bool
    {
        $code = file_get_contents($file);
        if (str_contains($code, 'Recommendable;')) {
            return false;
        }
        $import = "use Likyly\\Laravel\\Recommendable;\n";
        if (preg_match_all('/^use [^;]+;\n/m', $code, $m, PREG_OFFSET_CAPTURE)) {
            $last = end($m[0]);
            $code = substr_replace($code, $import, $last[1] + strlen($last[0]), 0);
        } else {
            $code = preg_replace('/^(namespace [^;]+;\n)/m', "$1\n".$import, $code, 1);
        }
        // First line of the class body: existing "use A, B;" gets Recommendable appended, else a new line.
        if (preg_match('/(class\s+\w+[^{]*\{\s*\n)(\s*)use\s+([^;]+);/', $code, $m) && ! str_contains($m[3], '\\')) {
            $code = str_replace($m[0], $m[1].$m[2].'use '.$m[3].', Recommendable;', $code);
        } else {
            $code = preg_replace('/(class\s+\w+[^{]*\{\s*\n)/', "$1    use Recommendable;\n\n", $code, 1);
        }
        file_put_contents($file, $code);

        return true;
    }

    public static function removeTrait(string $file): void
    {
        $code = file_get_contents($file);
        $code = str_replace("use Likyly\\Laravel\\Recommendable;\n", '', $code);
        $code = preg_replace('/,\s*Recommendable;/', ';', $code);
        $code = preg_replace('/^\s*use Recommendable;\n\n?/m', '', $code);
        file_put_contents($file, $code);
    }

    /** Lists a model class in config/likyly.php (before the "// likyly:models" marker). */
    public static function addModelToConfig(string $configFile, string $class): void
    {
        $text = file_get_contents($configFile);
        if (str_contains($text, "\\{$class}::class")) {
            return;
        }
        $text = preg_replace('#^(\s*)// likyly:models#m', "$1\\\\{$class}::class,\n$1// likyly:models", $text, 1);
        file_put_contents($configFile, $text);
    }
}
