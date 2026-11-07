# 0032 — Serraria mais forte e ataque de tropa em campo

**Problema.** Jogando, faltou madeira o tempo todo. Uma tropa em campo não conseguia mudar a tática do ataque. Um ataque voltou com "sem combate", sem motivo à vista, e o castelo alvo apareceu desenhado várias vezes.

## Decisão

- **Serraria rende 1,5×** (`fatorSerraria`). As obras gastam 45% em madeira, mas todo local rendia igual. O estoque do local acompanha a produção.
- **Tropa em campo abre a tela completa do ataque**: `#/envio?alvo=<hex>&marcha=<id>`. "Ajustar tática e objetivos" aparece na confirmação de qualquer origem. `/ataques` aceita `pessoas` para mandar só parte da tropa.
- **A notificação "sem combate" diz o motivo**, sem precisar abrir o relatório.
- **A foto da névoa desenha um local só, no centro.** Ela guarda o local em cada hexágono da pegada, e o mapa mandava um objeto por hexágono: 7 castelos, 3 serrarias. Agora o mapa manda um objeto com `ocupa`. Se o centro está à vista, vale o local ao vivo.
- **O relógio acelerado continua de onde o mundo parou.** `RelogioReal` começava da hora real a cada início. Com aceleração, reiniciar voltava o tempo do mundo: escudos vencidos voltavam a valer e obras e marchas se esticavam. Só afeta `REINO_ACELERACAO`.

## Consequências

Com a serraria mais forte, três metas do modelo saem do alvo: M12 (ferraria custa 15% do gasto em obras; alvo de 25% a 50%), M16 (eras custam 1,8 h e 3,6 h de produção; alvos de 2 a 4 h e 4 a 8 h) e M21 (recuperação da queda em 1,8 dia; alvo de 2 a 6 dias). O jogador médio chega ao máximo no dia 46, ainda depois do dia 40. O teste `Metas_do_modelo_no_alvo` falha até que se decida entre mudar essas metas ou subir os custos da ferraria e das eras.
