# Desempenho

O servidor precisa caber numa VM de 1/8 de OCPU (≈ 12,5% de um núcleo) com o mundo cheio (30 reinos). O mundo fica na memória, só o motor mexe nele e nada varre o mundo: tudo o que acontece no futuro é um evento ([0002](decisoes/0002-mundo-em-memoria.md)).

## Teste de carga

`servidor/testes/Testes/CargaIATestes.cs` (traço `Categoria=carga`, roda junto com `dotnet test`): 30 reinos (25 de IA e 5 jogadores simulados), com fauna, por dias de jogo, avançando o relógio falso evento a evento. `REINO_CARGA_DIAS` muda a duração (padrão 10). Para rodar só ele:

```
cd servidor && REINO_CARGA_DIAS=35 dotnet test --filter "Categoria=carga" --logger "console;verbosity=detailed"
```

Números medidos (máquina de desenvolvimento x86-64 de 2,1 GHz, um núcleo; detalhes em [0021](decisoes/0021-ia.md)):

| | 10 dias | 35 dias |
|---|---|---|
| Eventos por dia de jogo | 2 500 | 2 579 |
| CPU por dia de jogo | 1,27 s | 1,36 s |
| CPU por evento (sessões de IA incluídas) | 510 µs | 525 µs |
| Sessão de IA | 5,7 ms | 6,6 ms |
| Fração de um núcleo em tempo real | 0,0015% | 0,0016% |
| Memória gerenciada viva no fim | 24 MB | 59 MB |
| Banco | 5,2 MB | 11,8 MB |

Limites afirmados no teste: menos de 43 s de CPU por dia de jogo (0,05% de um núcleo), pico de memória gerenciada abaixo de 400 MB e banco abaixo de 64 MB.
