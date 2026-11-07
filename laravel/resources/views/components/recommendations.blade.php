<section class="likyly-block" {{ $attributes }}>
    @if ($title)
        <h2 class="likyly-block__title">{{ $title }}</h2>
    @endif
    <ul class="likyly-block__items" data-likyly-placement="{{ $placement }}" data-likyly-recommendation-id="{{ $recommendationId }}">
        @foreach ($cards as $card)
            <li class="likyly-block__item" data-likyly-item-id="{{ $card['id'] }}">
                <a href="{{ $card['url'] }}">
                    @if ($card['image'])
                        <img src="{{ $card['image'] }}" alt="" loading="lazy">
                    @endif
                    <span>{{ $card['name'] }}</span>
                </a>
            </li>
        @endforeach
    </ul>
</section>
@once
<style>
    .likyly-block { margin: 48px 0; }
    .likyly-block__items { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; list-style: none; padding: 0; }
    .likyly-block__item a { color: inherit; text-decoration: none; display: block; }
    .likyly-block__item img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; }
</style>
@endonce
