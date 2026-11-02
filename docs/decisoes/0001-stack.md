# 0001 — Servidor em .NET 10 (C#), um único processo

**Decisão.** Servidor em C# com .NET 10 (LTS), ASP.NET Core "slim" (Kestrel, minimal APIs), um único processo que serve API, avisos em tempo real e o cliente web.

**Por quê.**
- É a linguagem principal de quem vai manter o jogo.
- Kestrel é rápido e leve; o processo fica na casa de 60–100 MB com GC de estação de trabalho, sem concorrência (`ServerGarbageCollection=false`, `ConcurrentGarbageCollection=false`), o que cabe com folga em 1 GB.
- Um processo só: nada de fila externa, cache externo ou banco servidor para operar numa VM de 1/8 de OCPU.
- Sem trimming/AOT por enquanto: o código usa reflexão (registro de sistemas, JSON polimórfico). A publicação é self-contained em arquivo único, sem precisar instalar o .NET na VM.
