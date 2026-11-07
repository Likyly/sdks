<?php

namespace Likyly\Laravel\View\Components;

use Illuminate\Database\Eloquent\Model;
use Illuminate\View\Component;
use Likyly\Laravel\Likyly;

/**
 * <x-likyly-recommendations placement="pdp-similar" :item="$product" title="You may also like" />
 *
 * Asks LIKYLY for the placement's items, renders them from your own models (name, picture, link),
 * records the impressions, and routes clicks through likyly/click. Renders nothing when LIKYLY has
 * nothing or does not answer. Publish the view to restyle it: php artisan vendor:publish --tag=likyly-views
 */
class Recommendations extends Component
{
    /** @var array<int, array{id: string, name: string, image: ?string, url: string, model: Model}> */
    public array $cards = [];

    public ?string $recommendationId = null;

    public function __construct(
        public string $placement,
        public Model|string|null $item = null,
        public ?string $title = null,
        public ?int $limit = null,
        public ?string $model = null,
        public array $context = [],
    ) {
    }

    public function shouldRender(): bool
    {
        $likyly = app(Likyly::class);
        $rec = $likyly->recommend($this->placement, $this->item, $this->context, $this->limit);
        if (! $rec || $rec->items === []) {
            return false;
        }
        $class = $this->model ?? ($this->item instanceof Model ? $this->item::class : ($likyly->models()[0] ?? null));
        if (! $class) {
            return false;
        }
        $ids = array_map(fn ($i) => $i->itemId, $rec->items);
        $instance = new $class;
        $found = $class::query()->whereIn($instance->getKeyName(), $ids)->get()->keyBy(fn ($m) => Likyly::itemId($m));

        foreach ($ids as $id) {
            $model = $found->get($id);
            if (! $model) {
                continue; // in LIKYLY, no longer in the shop: never show a dead link
            }
            $url = method_exists($model, 'likylyUrl') ? $model->likylyUrl() : null;
            $item = method_exists($model, 'toLikylyItem') ? $model->toLikylyItem() : ['title' => $id];
            $this->cards[] = [
                'id' => $id,
                'name' => $item['title'],
                'image' => method_exists($model, 'likylyImage') ? $model->likylyImage() : null,
                'url' => route('likyly.click', ['item' => $id, 'rec' => $rec->recommendationId, 'placement' => $this->placement, 'to' => $url ? $this->path($url) : '/']),
                'model' => $model,
            ];
        }
        if ($this->cards === []) {
            return false;
        }
        $this->recommendationId = $rec->recommendationId;
        $likyly->impressions($this->placement, $rec->recommendationId, array_column($this->cards, 'id'));

        return true;
    }

    public function render()
    {
        return view('likyly::components.recommendations');
    }

    /** Only same-site paths go through the click redirect. */
    private function path(string $url): string
    {
        $parts = parse_url($url);

        return ($parts['path'] ?? '/').(isset($parts['query']) ? '?'.$parts['query'] : '');
    }
}
