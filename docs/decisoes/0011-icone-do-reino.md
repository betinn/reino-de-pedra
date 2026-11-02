# 0011 — Ícone do reino: brasão sorteado ou imagem própria

**Decisão.** Na criação, o servidor sorteia 8 brasões legíveis (gerador do protótipo: forma, divisão, cores, símbolo); o jogador escolhe um, ajusta se quiser, ou envia uma imagem. O cliente reduz a imagem para até 256 × 256 e envia PNG. O servidor aceita PNG, JPEG ou WebP até 200 KB e de 16 a 512 px, conferindo a assinatura e o cabeçalho, guarda no SQLite e serve só para quem está logado, com `Content-Security-Policy: sandbox` e `nosniff`.

**Por quê.** Brasão procedural é leve e combina com o design system; a imagem própria atende o pedido sem biblioteca de imagens no servidor (a redução acontece no navegador). O ícone só aparece para outros jogadores quando a identidade é revelada (estandarte, aliança, espionagem).
