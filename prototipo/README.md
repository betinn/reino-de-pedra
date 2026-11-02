# Reino de Pedra — Protótipo de telas

Protótipo navegável das telas principais, usado como referência visual para a implementação. É **apenas design**: não há regra de jogo real, servidor, persistência nem simulação. Todos os dados são fictícios e fixos (`js/dados.js`); timers e recursos "andam" só para dar vida às telas.

Identidade visual, tokens e componentes: [`design-system.md`](design-system.md).

---

## Como abrir

- **Local:** abra `prototipo/index.html` no navegador (funciona direto do arquivo, sem servidor e sem build).
- **GitHub Pages:** publique o repositório; o protótipo fica em `.../prototipo/` (todos os caminhos são relativos).
- **Comparar direções:** `prototipo/direcoes.html` mostra as duas direções lado a lado, com paleta, tipografia, componentes e o protótipo real em cada uma.
- **Escolher direção:** `index.html?dir=a` ou `index.html?dir=b`; também pelo seletor na tela de entrada ou na aba "Mais".
- Melhor experiência em viewport de celular (375–430 px). No computador, use o modo dispositivo do navegador; a roda do mouse faz zoom no mapa.

Fontes vêm do Google Fonts quando há rede; sem rede o protótipo usa as fontes de fallback e continua funcional.

---

## Mapa de telas

| # | Tela | Rota | Status |
|---|---|---|---|
| 1 | Entrada (tela inicial) | `#/inicio` | Entregue |
| 1 | Criação do reino (nome e brasão) | `#/criar` | Entregue |
| 2 | Mapa do mundo | `#/mapa` (`?foco=<local>` centraliza) | Entregue |
| 3 | Meu reino | `#/reino` (`?local=<id>` abre o local) | Entregue |
| 4 | Construção | — | Próximo bloco |
| 5 | Recrutamento | — | Próximo bloco |
| 6 | Exploradores | — | Próximo bloco |
| 7 | Extração de recurso | — | Próximo bloco |
| 8 | Envio de ataque | — | Próximo bloco |
| 9 | Posturas | — | Próximo bloco |
| 10 | Batalha em andamento | — | Próximo bloco |
| 11 | Relatórios | `#/relatorios` (guia) | Próximo bloco |
| 12 | Bandeiras | — | Próximo bloco |
| 13 | Notificações | — | Próximo bloco |
| 14 | Temporada e legado | — | Próximo bloco |
| 15 | Exílio | — | Próximo bloco |

Botões que levam a telas ainda não prototipadas mostram um aviso "entra no próximo bloco". As abas Tropas, Relatórios e Mais mostram, por enquanto, a lista do que vem em cada área.

### Navegação principal

`Mapa · Reino · Tropas · Relatórios · Mais` (barra inferior). Notificações ficam no sino, sempre visível no topo.

### Fluxos navegáveis nesta entrega

1. **Primeira vez:** Entrada → Fundar meu reino → nome + brasão (forma, divisão, cores, símbolo) → Fundar → modal "reino fundado" (escudo de novato) → Meu reino ou Mapa. O nome e o brasão escolhidos aparecem no reino e no castelo do mapa.
2. **Retorno:** Entrada → Continuar → Meu reino.
3. **Ameaça:** Mapa → faixa "Forças desconhecidas" → mapa centraliza no exército → folha com forças, direção de origem, alvo provável e chegada → Enviar reforços / Espionar.
4. **Explorar o mapa:** arrastar, pinça, botões e minimapa → tocar em hexágono (terreno, estado de névoa, conteúdo) → tocar em local, jazida, bandeira ou marcha → ações contextuais.
5. **Do reino ao mapa:** Meu reino → local (card ou vista do território) → Ver no mapa.
6. **Recursos:** tocar na barra de recursos → produção, capacidade do armazém e valiosos.

---

## Estrutura

```
prototipo/
  index.html          entrada do protótipo (SPA por hash, sem build)
  direcoes.html       comparação das direções A e B
  README.md           este arquivo
  design-system.md    paleta, tipografia, ícones, mapa e componentes
  css/
    tokens.css        tokens das duas direções
    base.css          base e componentes
    telas.css         estilos de cada tela e do mapa
  js/
    icones.js         sprite SVG de ícones e símbolos de terreno (arte própria)
    brasao.js         gerador de brasão
    hex.js            geometria hexagonal e terreno fixo do mapa mock
    dados.js          dados fictícios
    nucleo.js         rotas de tela, folha, modal, avisos, timers, barra de recursos
    mapa.js           mapa do mundo (camadas, névoa, gestos, minimapa)
    telas.js          entrada, criação do reino, meu reino e telas-guia
```

Scripts clássicos (não módulos) para funcionar abrindo o arquivo localmente. Sem dependências externas obrigatórias.

---

## Decisões de design

- **Mobile-first em coluna única**; em telas largas o conteúdo centraliza (máx. 640 px) e o mapa ocupa a tela toda.
- **Mapa em hexágonos SVG** com camadas; marcadores com contraescala para continuarem legíveis em qualquer zoom; nomes aparecem por nível de zoom.
- **Névoa em três estados**, cada um com tratamento próprio e sem ambiguidade: visível (cor cheia), explorado (véu + hachura + "Visto há X" + relógio nos marcadores), desconhecido (sem terreno desenhado). O terreno desconhecido nunca é desenhado, para não vazar informação.
- **Reino como conjunto de locais**: no mapa, cada local é um alvo próprio com a cor do dono; o castelo carrega o brasão. Em "Meu reino", a vista do território mostra os locais espalhados sobre o terreno real.
- **Anonimato**: forças sem estandarte aparecem em vermelho com "?" e só informam tropas, tipo e direção de origem; um exército com estandarte mostra brasão e nome.
- **Rotas públicas** desenhadas como estradas iguais para todos, com autor indicado na folha e ponte onde cruzam rio; vau marcado com pedras.
- **Ações sempre visíveis**: todo gesto do mapa tem botão equivalente; a folha inferior concentra detalhes e ações do que foi tocado.
- **Tempo ao vivo**: timers, chegadas e recursos atualizam a cada segundo; recurso perto do limite do armazém fica em cor de alerta.
- **População** explica a decisão tropas × economia na própria tela: teto por moradias, crescimento acelerado pela comida, milícia na defesa e custo de recrutar.

---

## Pontos em aberto (perguntas, não regras)

Nada abaixo altera o `CLAUDE.md`; são escolhas provisórias do protótipo que precisam de confirmação.

1. **Rotas públicas e névoa:** "qualquer jogador vê" significa ver através da névoa ou só ao explorar? O protótipo mostra rotas apenas em áreas conhecidas.
2. **Autoria das bandeiras:** a bandeira mostra quem a colocou? O protótipo mostra o brasão do autor. Bandeiras anônimas seriam possíveis?
3. **Dono de locais explorados:** ao explorar um local de outro reino, o jogador vê a quem ele pertence? O protótipo mostra (o anonimato vale para ataques).
4. **Deslocamento em colina:** o `CLAUDE.md` não define a velocidade; a tela mostra só os recursos do terreno.

---

## Verificação

As telas são conferidas em navegador headless com viewport de celular (390 × 844) nas duas direções, incluindo gestos de arrastar, pinça, toque e minimapa.
