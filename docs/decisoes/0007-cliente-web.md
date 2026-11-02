# 0007 — Cliente sem framework e sem build, portado do protótipo

**Decisão.** O cliente web reaproveita o protótipo: mesmo CSS (tokens, base, telas), ícones SVG, brasão e núcleo (folha, modal, avisos, timers, rotas em hash). Scripts simples com o namespace `RP`, sem bundler. Os dados vêm da API; o servidor diz o que o reino pode ver.

**Por quê.** O protótipo já é a referência visual e de fluxos aprovada e já é leve; reaproveitá-lo é o caminho mais curto para o design system e mantém o cliente pequeno (sem framework, sem etapa de build, servido direto pelo Kestrel com compressão).
