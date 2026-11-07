<?php

namespace Likyly\Laravel\Tests;

class RecommendationsTest extends TestCase
{
    private function shoes(): void
    {
        config(['likyly.secret' => null]); // no catalog sync while seeding
        foreach (['RUN-001' => 'Swift', 'RUN-002' => 'Glide', 'RUN-003' => 'Tempo'] as $id => $name) {
            Shoe::create(['id' => $id, 'name' => $name, 'image' => "/img/{$id}.jpg"]);
        }
        $this->app->forgetInstance(\Likyly\Laravel\Likyly::class);
        config(['likyly.secret' => 'sk_test']);
    }

    public function test_the_block_renders_the_shop_models_and_records_impressions(): void
    {
        $this->shoes();
        $this->reply(200, $this->recommendation(['RUN-002', 'GONE-404', 'RUN-003']));
        $this->reply(200, ['received' => 2, 'accepted' => 2, 'duplicates' => 0]);

        $html = $this->get('/shoes/RUN-001')->assertOk()->assertCookie('likyly_sid', null, false)->getContent();

        $this->assertStringContainsString('data-likyly-placement="pdp-similar"', $html);
        $this->assertStringContainsString('data-likyly-item-id="RUN-002"', $html);
        $this->assertStringContainsString('data-likyly-item-id="RUN-003"', $html);
        $this->assertStringNotContainsString('GONE-404', $html, 'an item no longer in the shop is never shown');
        $this->assertStringContainsString('/img/RUN-002.jpg', $html);
        $this->assertStringContainsString('likyly/click?item=RUN-002', $html);

        [$recommend, $events] = $this->calls();
        $this->assertSame('/placements/pdp-similar/recommend', $recommend['path']);
        $this->assertSame('RUN-001', $recommend['body']['context']['current_item_id']);
        $this->assertMatchesRegularExpression('/^sess_[a-f0-9]{24}$/', $recommend['body']['context']['session_id']);
        $this->assertSame('/events/batch', $events['path']);
        $this->assertSame(['RUN-002', 'RUN-003'], array_column($events['body']['events'], 'item_id'));
        $this->assertSame('rec_1', $events['body']['events'][0]['recommendation_id']);
    }

    public function test_the_visitor_keeps_the_same_session_id(): void
    {
        $this->shoes();
        $this->reply(200, $this->recommendation(['RUN-002'], 'home-trending'));
        $this->reply(200, ['received' => 1, 'accepted' => 1, 'duplicates' => 0]);
        $this->withUnencryptedCookie('likyly_sid', 'sess_existing_visitor')->get('/')->assertOk();
        $this->assertSame('sess_existing_visitor', $this->calls()[0]['body']['context']['session_id']);
    }

    public function test_nothing_is_rendered_when_likyly_fails(): void
    {
        $this->shoes();
        $this->reply(503, ['detail' => 'down']);
        $html = $this->get('/')->assertOk()->getContent();
        $this->assertStringContainsString('<h1>Home</h1>', $html);
        $this->assertStringNotContainsString('likyly-block', $html);
    }

    public function test_a_click_is_recorded_then_redirected_on_site_only(): void
    {
        $this->reply(200, ['received' => 1, 'accepted' => 1, 'duplicates' => 0]);
        $this->get('/likyly/click?item=RUN-002&rec=rec_1&placement=pdp-similar&to=/shoes/RUN-002')->assertRedirect('/shoes/RUN-002');
        $click = $this->calls()[0];
        $this->assertSame('/events/click', $click['path']);
        $this->assertSame(['RUN-002', 'rec_1', 'pdp-similar'], [$click['body']['item_id'], $click['body']['recommendation_id'], $click['body']['placement']]);

        $this->reply(200, ['received' => 1, 'accepted' => 1, 'duplicates' => 0]);
        $this->get('/likyly/click?item=RUN-002&to=https://evil.example/')->assertRedirect('/');
    }
}
