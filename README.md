# MW LED Line Element

`custom:mw-led-line-element` — a **fita LED** na planta do `picture-elements`.

Substitui o bloco de `custom:button-card` com JavaScript embutido nos `styles`
(borda + halo + tinta calculados a cada estado) por **uma linha de tipo e uma
lista de pontos** — e, de quebra, a fita passa a poder **contornar quantas
paredes forem precisas**.

```yaml
type: custom:mw-led-line-element
entity: light.led_da_cama_da_suite
points: 67 96, 67 81, 91 81, 91 96
```

## Duas formas, o mesmo elemento

| `shape` | o que desenha |
|---|---|
| `box` | o retângulo brilhante do YAML original — borda, halo externo em duas camadas e halo interno, pixel a pixel |
| `line` | a fita de verdade: um traço que segue N pontos, com quantos segmentos você quiser |
| `auto` (padrão) | `line` se houver `points`/`segments`, senão `box` |

Os pontos são **porcentagem da planta** (`x y, x y, …`), então a fita acompanha
o redimensionamento da tela. Aceita também `[[67,96],[67,81]]` e
`[{x: 67, y: 96}, …]`.

### Vários segmentos

```yaml
segments:
  - 8 92, 8 60          # parede da esquerda
  - 8 60, 52 60, 52 92  # fundo + parede da direita
  - points: 60 20, 92 20, 92 48, 60 48
    closed: true        # volta ao primeiro ponto
    color: "#7cf"       # cor só deste trecho
    thickness: 1.6%
```

## Cores

Por padrão a fita usa a **cor real da luz**: `rgb_color`, `rgbw_color`,
`rgbww_color`, `hs_color` ou a temperatura (`color_temp_kelvin` / mireds
convertidos por aproximação de corpo negro — branco 2700 K sai âmbar de
verdade, 6500 K sai azulado). Sem nenhum desses atributos, cai em
`color_fallback` (`255, 200, 120`, o mesmo default do YAML original).

Fita de cor fixa (RGB ou branca)? `color_on: "#ffcc88"` e pronto.

## Efeitos

`animation: auto` (padrão) lê o atributo `effect` da luz e escolhe o desenho:

| efeito reportado pela luz | animação |
|---|---|
| Rainbow, Colorloop, Spectrum | `rainbow` (matiz girando) |
| Theater Chase, Run, Marquee | `chase` (brilho correndo pela fita) |
| Comet, Meteor, Larson | `comet` |
| Scan, Bounce, Ping-Pong | `scan` (vaivém) |
| Twinkle, Sparkle, Glitter, Snow | `twinkle` |
| Strobe, Flash, Blink, Police | `strobe` |
| Fire, Flame, Candle, Lava | `fire` |
| Flicker | `flicker` |
| Wave, Ocean, Aurora | `wave` |
| Music, Sound, Beat, Pulse | `pulse` |
| Breathe, Fade, Smooth | `breathe` |
| sem efeito / "None" / "Solid" | `animation_idle` (padrão: nenhuma) |
| desconhecido | `animation_other` (padrão: `breathe`) |

`effect_map: {"Festa da Cris": twinkle}` ensina os nomes do seu driver.
`animation: chase` força uma animação e ignora a luz.
`animation_speed: 1.4` acelera tudo.

Tudo anima só `opacity`, `filter` e `stroke-dashoffset` — composição na GPU,
sem redesenhar a planta. `prefers-reduced-motion` desliga as animações.

## Opções

| chave | padrão | o que faz |
|---|---|---|
| `entity` | — | obrigatória (light, switch, input_boolean, fan) |
| `name` | | tooltip; vazio = `friendly_name` |
| `shape` | `auto` | `auto` · `line` · `box` |
| `points` / `segments` | | traçado da fita |
| `closed` | `false` | fecha o traço |
| `thickness` / `thickness_off` | `3px` / `2px` | espessura; `%` acompanha a planta |
| `cap` | `round` | ponta do traço |
| `hit_width` | `18px` | largura da área de toque (modo `line`) |
| `use_light_color` | `true` | usar a cor real da luz |
| `color_on` | | cor fixa (vence a luz) |
| `color_fallback` | `255, 200, 120` | quando a luz não informa cor |
| `color_off` | `rgba(255,255,255,0.18)` | apagada |
| `color_unavailable` / `color_unknown` | `rgba(255,60,60,0.9)` | quebrada |
| `dash_unavailable` | `3 3` | o tracejado vermelho do original |
| `dash_on` / `dash_off` | | tracejado nos outros estados |
| `glow` | `true` | halo |
| `glow_scale` / `glow_opacity` | `1` / `1` | multiplicam raios e alfas do original |
| `inner_glow` | `true` | o `inset` do box-shadow (modo `box`) |
| `fill` / `fill_opacity` | `true` / `0.15` | tinta interna |
| `soft_edge` | `0` | traço largo e translúcido sob a fita (modo `line`) |
| `dim_by_brightness` | `false` | halo obedece o `brightness` |
| `opacity` | `1` | opacidade geral |
| `border_radius` | `16px` | canto do `box` |
| `spark_color` | `rgba(255,255,255,0.92)` | cor do brilho que corre |
| `invert` | `false` | entidade invertida |
| `hide_on/off/unavailable/unknown` | `false` | some por estado |
| `tap_action` / `hold_action` / `double_tap_action` | `toggle` / `more-info` / `none` | ações |
| `lock_when_broken` | `true` | indisponível não aceita toque |
| `optimistic` | `true` | acende no dedo, sem esperar o HA |
| `haptic` | `true` | vibração |
| `left` / `top` / `width` / `height` | | geometria do `box` (o `style:` do YAML também serve) |

## Editor visual

O `picture-elements` resolve `getConfigElement()` do elemento custom: editar a
fita no editor visual do card mostra **formulário**, não YAML cru — entidade,
forma, pontos, espessura, efeito, cores, halo, geometria e ações.

## Instalação

HACS → Repositórios personalizados → `visaodeempresa/mw-ha-led-line-element`,
categoria **Lovelace**. Ou copie `dist/mw-led-line-element.js` para
`/config/www/` e adicione o recurso como módulo JavaScript.

## Desempenho

O elemento monta o DOM **uma vez** e depois só escreve custom properties; a
folha de estilo é compartilhada entre todas as instâncias
(`adoptedStyleSheets`); e o `set hass` sai em O(1) quando a mudança foi de
outra entidade — o Home Assistant empurra o objeto `hass` a **cada** mudança
de **qualquer** entidade, e é aí que planta cheia costuma engasgar.

No modo `line` a área clicável é só o traço: o resto da planta continua
recebendo os toques dos outros elementos.

## Bancada

`tools/preview.html` abre no navegador, sem Home Assistant: compara o `box`
com uma réplica do `button-card` original e mostra fitas de vários segmentos,
cores e efeitos.

## Licença

MIT · MAYCON WILLIAN OLIVEIRA
