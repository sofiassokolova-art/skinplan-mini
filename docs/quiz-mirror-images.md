# Фото для экрана ai_comparison («Зеркало»)

Экран — полноэкранное фото, поверх которого сверху идёт заголовок в две-три строки,
а снизу белая карточка с объяснением. Значит, кадр обязан иметь **пустые зоны сверху
и снизу**, а сюжет жить в средней трети.

## РЕШЕНИЕ: одна общая картинка на все цели

Вместо девяти фото под каждую цель — **один editorial-кадр на все `focus_key`**.
Персонализацию несёт текст (заголовок, объяснение — остаются под цель в БД), а картинка
даёт общий бренд-образ. Так проще художественно вывести один сильный кадр, чем девять
ровных, и дешевле поддерживать.

Концепт (по референсу пользователя): **размытое лицо крупным планом, а в органической
прорези в центре — резкий фрагмент настоящей кожи** с порами и текстурой. Внешнее лицо
не в фокусе и потому не читается как конкретный человек («это не я» не срабатывает), а в
прорези — «посмотри на свою реальную кожу». Метафора «изучи себя, прежде чем покупать»
одинаково работает на любую цель.

Палитра — **холодная под бренд** (не тёплый беж референса): серо-тауп, офф-вайт `#FCFCFB`,
чтобы кадр сел рядом с лаймовой кнопкой и холодной канвой соседних экранов.

### Промт (один, на все цели)

```
Vertical 9:19.5 editorial beauty poster. A woman's face in extreme soft focus
filling the frame, hazy and out of focus so no individual is recognisable,
turned slightly. In the middle third an organic torn-paper cutout window
reveals the same skin in crisp sharp focus — real skin texture with visible
pores, fine vellus hair and light freckles. Fine film grain over the whole
image, matte finish. Cool neutral palette of soft grey-taupe and off-white,
no warm beige, no orange. Generous calm empty space in the top 30% and bottom
25% of the frame for text overlay. No text, no lettering, no logo, no
watermark, no makeup.
```

Требования, которые ломаются молча, если их не держать:
- **Никакого вшитого текста** — заголовок и карточку рисует само приложение поверх.
  Референс с надписью «Research your skin…» — это его текст, у нас его быть не должно.
- Прорезь и лицо — в средней трети; верхние 30% и нижние 25% пустые под оверлей.
- `no warm beige, no orange` в промте обязательны: генератор тянет портрет в тёплый тон
  по умолчанию, а нам нужен холодный.

### Как подключить одну картинку

Кладём файл, например, `/quiz/mirror/hero.jpg`, и проставляем его во все строки:

```sql
UPDATE quiz_screen_variants SET image_url = '/quiz/mirror/hero.jpg'
WHERE screen_id = 'ai_comparison';
```

Архитектура «картинка на строку» сохраняется — если позже захочется вернуть отдельные
кадры под цели, достаточно снова развести `image_url`. Промты под этот сценарий лежат
ниже как **альтернатива (сейчас не выбрана)**.

---

## Альтернатива: отдельная картинка под каждую цель (не выбрана)

Оставлено на случай, если общий кадр не зайдёт и мы вернёмся к per-goal.

| focus_key | текущее фото (временное) | целевой файл |
|---|---|---|
| acne | `/acne6.webp` | `/quiz/mirror/acne.jpg` |
| pores | `/pores6.webp` | `/quiz/mirror/pores.jpg` |
| wrinkles | `/wrinkles6.webp` | `/quiz/mirror/wrinkles.jpg` |
| pigmentation | `/pigmentation6.webp` | `/quiz/mirror/pigmentation.jpg` |
| dehydration | `/dry.webp` | `/quiz/mirror/dehydration.jpg` |
| barrier | `/tone6.webp` | `/quiz/mirror/barrier.jpg` |
| oiliness | `/oily.webp` | `/quiz/mirror/oiliness.jpg` |
| dark_circles | `/puff6.webp` | `/quiz/mirror/dark-circles.jpg` |
| default | `/onboarding/welcome.jpg` | `/quiz/mirror/default.jpg` |

### Направление per-goal: метафора, а не кожа

Снимаем не кожу, а **ситуацию, в которой человек живёт со своей проблемой**: запотевшее
зеркало, полка с баночками, смятая подушка. Причины три.

Клоузап акне или купероза показывает человеку его проблему, а не выход из неё, — экран
про узнавание превращается в экран про стыд. Метафора попадает в ту же боль, но
оставляет достоинство.

Метафора не требует попадания в возраст и тон кожи: один кадр работает и на двадцать
лет, и на пятьдесят. Портрет или фрагмент чужой кожи всегда рискует получить «это не я».

И третье: предметная съёмка ложится в один ряд с текстурами пенки и крема на соседних
экранах анкеты, а фотографии лиц из этого ряда выпадают.

**Главное правило: метафора — это осязаемая вещь, а не настроение.** «Женщина задумчиво
смотрит в окно» — пустой сток, который ничего не сообщает. «Одна капля на идеально ровной
поверхности» под заголовком «что вылезло за ночь» — конкретный образ, который человек
считывает. Конкретику формулировки несёт заголовок; фотография отвечает за узнавание.

## Общие требования к кадру

Вертикаль 1080×2340 (9:19.5). Один предмет или одна сцена, без коллажей. Кадр обязан
иметь **спокойные верхние 30% и нижние 25%** — туда лягут заголовок и белая карточка;
объект живёт в средней трети.

Временные картинки не годятся ещё и по геометрии: `acne6.webp`, `dry.webp` и остальные —
**горизонтальные 900×502**, снимались под широкие плитки в вопросе про цели. На экране
375×812 при `object-fit: cover` от них остаётся центральная полоса шириной около трети
кадра, растянутая с 900 px до ~1456 px: композиция рушится, картинка мылится.

### Эстетика: метод Rhode в нашей палитре

Ориентир — **Rhode**: предельная сдержанность, один герой в море воздуха, мягкий
скульптурный свет и тактильная фактура. Но у Rhode палитра тёплая, nude-бежевая — ровно
то, что мы забраковали. Поэтому берём у Rhode **метод, а не цвет**: их минимализм и
осязаемость, но в нашей холодной канве с чёрным и лаймом.

- **Герой — материал, а не бытовой предмет.** Rhode снимает не «полочку в ванной», а
  каплю геля, плёнку глянца, гладкую матовую поверхность. Метафора уходит из интерьера в
  фактуру: «что вылезло за ночь» — это одна капля на идеально ровной поверхности, а не
  прыщ и не зеркало с раковиной. Так снимается и вопрос «неужели опять чужое лицо», и
  прошлая проблема с невозможным отражением.
- **Свет — мягкий скульптурный, обволакивающий.** Это разворот прошлого указания: у
  Rhode нет жёсткой графичной тени, свет большой и рассеянный, тень одна и мягкая,
  переходом. Поверхность лепится светом, а не режется им.
- **Контраст матовое ↔ глянец.** Главный приём Rhode. Матовая молочная поверхность и на
  ней капля воды, купол геля, плёнка блеска — вся драма в этом переходе, а не в цвете.
- **Палитра.** Холодный офф-вайт `#FCFCFB`, белый, светло-серый, чёрный `#0A0A0A`.
  Никакого бежевого, песочного, nude, тёплого дерева — даже несмотря на Rhode.
- **Лайм `#D5FE61`** — максимум одна крошечная деталь (капля, срез, крышка), и то не
  обязательно. Лаймовый фон не берём: по нему не читается белый заголовок.
- Огромное поле воздуха сверху и снизу — это часть эстетики, а не только место под текст.
- Ни людей, ни лиц, ни текста, ни логотипов, ни брендов, ни водяных знаков.

## Промты

Промты на английском — генераторы точнее держат предметную макросъёмку. Общий хвост
вынесен отдельно, добавляй его к каждому.

**Общий хвост (добавлять к любому промту ниже):**

```
vertical 9:19.5 composition, single subject centered in the middle third with
generous empty negative space in the top 30% and bottom 25%, cold off-white
seamless studio backdrop, palette strictly off-white white light grey and
black, soft sculptural wraparound light, one gentle diffused gradient shadow,
tactile matte-to-glossy surface contrast, dewy minimal beauty campaign macro
still life in the style of Rhode, extremely clean and restrained, sharp focus,
100mm macro, no people, no faces, no beige, no nude, no warm tones, no wood,
no clutter, no text, no logo, no brand names, no watermark
```

### acne — «Утром смотришь в зеркало и ищешь, что вылезло за ночь»

```
A single small glossy raised droplet sitting on an otherwise perfectly smooth
matte off-white surface, the one imperfection catching soft light, macro
```

### pores — «Наносишь тональный, а через час поры видно ещё сильнее»

```
Macro of a matte off-white surface with fine even pinpoint texture, half of it
covered by a thin glossy film that only makes the texture more visible, soft
light
```

### wrinkles — «Смотришь фото годичной давности и видишь разницу»

```
A single soft fold creasing a smooth satin off-white gel sheet, one clean
crease line across an otherwise flawless surface, soft sculptural light
```

### pigmentation — «Пятна не проходят, и без тонального выходить не хочется»

```
A faint soft grey tonal blot diffusing into an otherwise perfectly even
off-white matte surface, a stain that will not lift, soft light
```

### dehydration — «К вечеру кожу стягивает, а крем впитывается за минуту»

```
A smooth off-white surface transitioning from glossy wet on one side to dry
matte with fine hairline cracks on the other, a single water droplet at the
wet edge, soft light
```

### barrier — «Пробуешь новое средство и ждёшь, отреагирует кожа или нет»

```
A single intact smooth glossy clear gel dome resting unbroken on a matte
off-white surface, calm reflective highlight, soft sculptural light
```

### oiliness — «К обеду лицо блестит, хотя утром всё было нормально»

```
A glossy translucent oil sheen pooling and spreading across part of an
otherwise matte off-white surface, excess shine catching soft light, macro
```

### dark_circles — «Выспалась, а по лицу этого не скажешь»

```
A soft cool bluish-grey shadow pooling in a gentle shallow hollow of a smooth
off-white surface, a shadow that stays, quiet tonal macro, soft light
```

### default — «Средств много, а понимания, что коже нужно, всё ещё нет»

```
A cluster of many smooth off-white blobs and forms of different shapes crowded
together on one side of the frame with clean empty space on the other, tonal
and restrained, soft sculptural light
```

## Как подставить готовые файлы

Разложить в `public/quiz/mirror/`, затем обновить строки — деплой не нужен, экран
читает картинку из БД:

```sql
UPDATE quiz_screen_variants SET image_url = '/quiz/mirror/acne.jpg'
WHERE screen_id = 'ai_comparison' AND focus_key = 'acne';
```

Либо поменять `imageUrl` в `scripts/seed-quiz-screen-variants.ts` и перезапустить
`npm run seed:quiz-screens` — сид идемпотентный, перезапишет только контент.

## Юридическое

С предметной съёмкой вопрос закрывается сам: людей в кадре нет, релиз на съёмку не
нужен, персональных данных не возникает. Это ещё один довод за метафору против фото лиц.

Если когда-нибудь захочется вернуть сюда реальные фото пользователей (например, из
отзывов «до/после»), понадобится отдельное письменное согласие на использование
изображения — не то, что человек даёт при регистрации. Кадрирование до фрагмента от
этого требования не освобождает: снимок остаётся сведениями о состоянии здоровья
конкретного человека.
