<!-- MW-BRAND:BEGIN — gerado por IA/tools/mw-brand.sh · não editar à mão -->
<p align="center">
  <a href="https://github.com/visaodeempresa">
    <img src="docs/brand/logo.png" alt="Visão de Empresa — MAYCON WILLIAN OLIVEIRA" width="96">
  </a>
  <br>
  <sub><b>Visão de Empresa</b> · componente de Home Assistant por MAYCON WILLIAN OLIVEIRA</sub>
</p>
<!-- MW-BRAND:END -->

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

![Nove exemplos do elemento: o box igual ao YAML original, fitas de vários
segmentos e as variações de cor e efeito](docs/galeria.png)

*Gerado por `tools/preview.html` — o YAML de cada painel está na
[galeria](#galeria).*

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

## Galeria

Os nove painéis da imagem lá de cima, com o YAML que os produz. Todos usam
luzes de mentira (`tools/preview.html` traz o seu próprio `hass` de bolso), mas
a configuração é a mesma que vai para o `picture-elements`.

### 1 · o `box` contra o YAML original

O primeiro painel é uma réplica em CSS puro do `custom:button-card` que este
elemento aposenta; o segundo é o elemento. Mesma posição, mesma borda, mesmo
halo — a comparação existe justamente para provar que nada mudou de aparência.

```yaml
# painel 2 — idêntico ao button-card do YAML original
type: custom:mw-led-line-element
entity: light.led_da_cama_da_suite
shape: box
left: 79%
top: 88%
width: 24%
height: 15%
```

```yaml
# painel 3 — os outros dois estados, sem nenhum ajuste extra:
# apagada = traço fino translúcido · indisponível = tracejado vermelho com halo
type: custom:mw-led-line-element
entity: light.fita_apagada
shape: box
left: 30%
top: 40%
width: 36%
height: 18%
```

### 2 · fita com vários segmentos

```yaml
# painel 1 — a fita da cama contornando três paredes, num traço só
type: custom:mw-led-line-element
entity: light.led_da_cama_da_suite
points: 18 78, 18 32, 62 32, 62 62
```

```yaml
# painel 2 — dois trechos soltos + um contorno fechado, na mesma entidade
type: custom:mw-led-line-element
entity: light.led_da_sala
segments:
  - 12 20, 88 20
  - 12 86, 88 86
  - points: 40 40, 62 40, 62 62, 40 62
    closed: true
```

```yaml
# painel 3 — espessura em % (acompanha a planta) e borda difusa
type: custom:mw-led-line-element
entity: light.led_do_hall
points: 14 70, 50 24, 86 70
thickness: 1.4%
soft_edge: 0.35
```

### 3 · cores e efeitos

```yaml
# painel 1, linha 1 — fita branca: 2700 K vira âmbar de verdade
type: custom:mw-led-line-element
entity: light.fita_branca
points: 10 22, 90 22

# painel 1, linha 2 — fita de cor fixa, sem efeito nenhum
type: custom:mw-led-line-element
entity: light.fita_verde
points: 10 50, 90 50
color_on: "#39ff88"
animation: none

# painel 1, linha 3 — a mesma fita apagada
type: custom:mw-led-line-element
entity: light.fita_apagada
points: 10 78, 90 78
```

```yaml
# painel 2 — efeitos: as duas primeiras seguem sozinhas o `effect` da luz
#   ("Rainbow" → arco-íris, "Theater Chase" → corrida);
#   a terceira força `twinkle` e ignora o que a luz reporta
type: custom:mw-led-line-element
entity: light.led_rgb          # effect: Rainbow
points: 10 22, 90 22

type: custom:mw-led-line-element
entity: light.led_da_sala      # effect: Theater Chase
points: 10 50, 90 50

type: custom:mw-led-line-element
entity: light.led_rgb
points: 10 78, 90 78
animation: twinkle
```

```yaml
# painel 3 — fita indisponível (tracejado) e um `box` animado:
# o halo do retângulo original também obedece aos efeitos
type: custom:mw-led-line-element
entity: light.fita_sumida
points: 10 30, 90 30

type: custom:mw-led-line-element
entity: light.led_da_sala
shape: box
left: 50%
top: 70%
width: 70%
height: 26%
```

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

## Identidade no editor

Na lista de elementos do editor visual do `picture-elements`, este elemento
aparece como **Fita LED** — e não mais como `custom:mw-led-line-element` /
`Unknown type`. A segunda linha é o `title:` da config; sem título, o
`friendly_name` da entidade:

```yaml
type: custom:mw-led-line-element
entity: light.exemplo
title: 🏠 Luz da cozinha      # só o editor lê; não vira tooltip nem desenho
```

O `title:` é opcional e não muda nada na planta — quem faz o tooltip continua
sendo `name:`. O mesmo nome aparece no cabeçalho do sub-editor
(“Editor de elemento Fita LED”).

Detalhe técnico: o HA não tem registro público para elementos de
picture-elements (só para card, badge e feature), então o nome vem do bloco
compartilhado `mw-element-identity v1`, que responde à chave de tradução do
tipo. Se um dia o HA mudar isso, o elemento volta a mostrar o tipo cru e
**nada mais muda** — não é caminho de render.

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
