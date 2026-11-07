<?php

namespace Likyly\Laravel\Tests;

use Illuminate\Support\Facades\Artisan;

class CatalogTest extends TestCase
{
    public function test_a_saved_model_is_sent_with_its_page_and_picture(): void
    {
        $this->reply(200, ['received' => 1, 'succeeded' => 1, 'failed' => 0]);
        Shoe::create(['id' => 'RUN-009', 'name' => 'Pacer', 'description' => 'Daily trainer', 'category' => 'road', 'price' => 120, 'image' => 'https://cdn.example/RUN-009.jpg']);

        $call = $this->calls()[0];
        $this->assertSame('POST', $call['method']);
        $this->assertSame('/items/import', $call['path']);
        $item = $call['body']['items'][0];
        $this->assertSame('RUN-009', $item['item_id']);
        $this->assertSame('Pacer', $item['title']);
        $this->assertSame('Daily trainer', $item['description']);
        $this->assertSame('road', $item['properties']['category']);
        $this->assertSame('https://cdn.example/RUN-009.jpg', $item['properties']['image']);
        $this->assertStringEndsWith('/shoes/RUN-009', $item['properties']['url']);
    }

    public function test_a_deleted_model_leaves_the_catalog(): void
    {
        $this->reply(200, ['received' => 1, 'succeeded' => 1, 'failed' => 0]);
        $shoe = Shoe::create(['id' => 'RUN-010', 'name' => 'Old']);
        $this->reply(200, ['received' => 1, 'succeeded' => 1, 'failed' => 0]);
        $shoe->delete();
        $this->assertStringContainsString('items', $this->calls()[1]['path']);
        $this->assertContains($this->calls()[1]['method'], ['POST', 'DELETE']);
    }

    public function test_a_likyly_outage_never_breaks_a_save(): void
    {
        $this->reply(503, ['detail' => 'down']);
        Shoe::create(['id' => 'RUN-011', 'name' => 'Still saved']);
        $this->assertNotNull(Shoe::find('RUN-011'));
    }

    public function test_sync_sends_the_whole_catalog(): void
    {
        config(['likyly.secret' => null]);
        foreach (range(1, 3) as $i) {
            Shoe::create(['id' => "RUN-10{$i}", 'name' => "Shoe {$i}"]);
        }
        config(['likyly.secret' => 'sk_test']);
        $this->app->forgetInstance(\Likyly\Laravel\Likyly::class);
        $this->reply(200, ['received' => 3, 'succeeded' => 3, 'failed' => 0]);

        $this->assertSame(0, Artisan::call('likyly:sync'));
        $this->assertCount(3, $this->calls()[0]['body']['items']);
    }
}
