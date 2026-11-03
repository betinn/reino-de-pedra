# Reino de Pedra

**Estratégia e Conquista.** MMO de estratégia medieval, persistente e em tempo real, mobile-first.

- Regras de jogo e de negócio: [`CLAUDE.md`](CLAUDE.md)
- Balanceamento (modelo, tabelas, metas): [`balanceamento/`](balanceamento/)
- Protótipo de telas (referência visual): [`prototipo/`](prototipo/)
- Arquitetura e convenções do código: [`docs/arquitetura.md`](docs/arquitetura.md)
- Decisões técnicas: [`docs/decisoes/`](docs/decisoes/)
- Correções de usabilidade (vêm antes dos próximos passos): [`docs/correcoes-usabilidade.md`](docs/correcoes-usabilidade.md)
- Próximos passos (o que falta e como testar): [`docs/proximos-passos.md`](docs/proximos-passos.md)

## Rodar localmente

Requisitos: .NET SDK 10 e Node.js (só para o modelo de balanceamento).

```bash
scripts/rodar-local.sh
# abra http://localhost:5080
```

Os dados ficam em `./dados` (ignorado pelo git). Para testar mais rápido, `REINO_ACELERACAO=60 scripts/rodar-local.sh` faz 1 minuto real valer 1 hora de jogo.

## Testes

```bash
cd servidor && dotnet test
```

## Mudar um número do jogo

1. Edite `balanceamento/modelo.js`.
2. `node balanceamento/modelo.js > balanceamento/tabelas.md` e confira as metas.
3. `node balanceamento/modelo.js --json > balanceamento/config.json` (o servidor lê daqui).

## Publicar

`scripts/publicar.sh` gera o pacote; passo a passo em [`docs/publicar.md`](docs/publicar.md).
