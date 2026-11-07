# 0034 — Resgate de explorador e força inimiga antes da batalha

**Problema.** Quando um explorador era capturado, o dono não tinha o que fazer: só quem capturou decidia (resgate, libertar, executar). E o ataque era às cegas: as tropas chegavam e lutavam sem que o jogador visse a força do local.

## Decisão

### Explorador capturado

- **O preso fica num local de quem capturou** (`Prisioneiro.LocalId`): a guarnição que o viu, o local espionado ou, se foram tropas em campo, o local do captor mais perto de onde ele foi pego. Sem registro (documentos antigos), vale o castelo do captor. Solto, ele sai desse local.
- **Negociar sem saber com quem.** O dono oferece um pagamento (`POST /prisioneiros/{id}/oferta`, `Comercio.OferecerResgate`), com ou sem resgate pedido. Quem capturou aceita, recusa ou pede outro valor (`/prisioneiros/{id}` com `aceitar`, `recusar` ou `resgate`). Aceita, a oferta vira o resgate e o pagamento sai na hora, pelas mesmas remessas do resgate pago: viaja visível e pode ser roubado. Oferecer, só o dono pode, e só o que tem. Enquanto o pagamento viaja, ninguém muda o valor.
- **O que revela quem capturou** (`Prisioneiro.CaptorRevelado`): pedir resgate (inclusive a contraproposta), aceitar a oferta e a espionagem do local. Oferecer e recusar não revelam. A recusa chega ao dono sem o nome do captor.
- **Resgate à força.** Qualquer ataque vitorioso no local onde o explorador está preso o liberta (`Capturas.AoTerminarBatalha`, gancho de `Combates.AoTerminar`). Só os exploradores do atacante saem. Se o local deixa de ser do captor (ocupado, arruinado, perdido na queda do castelo), todos os presos dali são soltos (`Capturas.Conferir`). Derrota não liberta.
- **Onde ele está.** O dono sabe onde ele foi pego e a direção para onde foi levado. O local exato só se sabe se ele foi pego espionando aquele local, ou se um batedor espiona o local e o vê lá: o relatório de espionagem lista os presos do reino que espiona, pelo nome, e conta os de outros reinos. Com o local conhecido, a tela de exploradores oferece "Resgatar à força", que abre o envio de ataque para ele.
- **IA**: aceita a oferta que paga pelo menos o custo do explorador (o comerciante, com a margem dele) e recusa a menor. Ofertas aparecem em "precisa de você" para quem capturou.

### Força inimiga antes da batalha

- **Estimativa única** (`Reconhecimentos.Estimar`), na prévia do ataque (`/ataques/previa`, campo `forcaInimiga`), na prévia de tropas para um local alheio (`/tropas/previa`) e no relatório de reconhecimento. Mostra guarnição por unidade, milícia (civis presentes), torres conhecidas, portões e a batalha estimada pela mesma fórmula (`F.Batalha`): força dos dois lados, perdas estimadas, recuo pela tática e um veredito (vantagem, apertado, desvantagem).
- **O que se sabe vem de onde se sabe.** À vista agora: o que se vê, sem os bônus de defesa. Fora da vista: o último relatório de espionagem, com a idade. A espionagem guarda agora a guarnição por unidade, os civis, os portões e o bônus de defesa (`LocalEspionado`), e só ela revela o bônus. Sem vista nem espionagem, só as torres conhecidas, sem estimativa. Nada revela o dono, o escudo ou o pacto: continuam descobertos ao chegar.
- **Ordem "reconhecer"** (`OrdemReconhecer`): as tropas vão em direção ao local e param à vista dele, a até 3 hexágonos (ou a visão do grupo, se menor), sem atacar. Na chegada, o relatório traz a estimativa e os botões "Atacar daqui" (o ataque de tropa em campo da 0032) e "Voltar". Já à vista do alvo, a ordem é recusada: a prévia do ataque já mostra a força.
- **No cliente**, o cartão "Força inimiga" (`RP.forcaInimigaHTML`) aparece no envio de ataque, com o botão "Reconhecer antes" quando o local não está à vista, e na confirmação rápida do envio de tropas. A ordem "Reconhecer" entra nas ordens do mapa.

## Consequências

- O ataque deixa de ser às cegas, mas a informação tem custo: aproximar as tropas (que podem ser vistas e atacadas por uma guarnição que ataca qualquer ameaça) ou mandar um batedor. A estimativa à vista ignora armaduras, veterania e relíquias; pode errar para menos.
- O resgate à força dá um motivo para atacar um local específico e para espionar perto de onde o explorador foi pego. Um resgate já pago que esteja a caminho quando o explorador é libertado à força fica com o captor.
- Nenhum valor de balanceamento mudou: a distância do reconhecimento (3) fica no código, como regra de interface.
