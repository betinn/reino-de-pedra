# Modelos 3D e bibliotecas de terceiros

Todos os arquivos desta pasta e de `web/vendor/` são de uso livre, inclusive comercial, e podem ficar num repositório público.

| Arquivo | Origem | Autor | Licença |
|---|---|---|---|
| `personagem.glb` | "Animated Characters Survivors" (modelo `characterMedium`, animações idle e run), convertido de FBX para GLB e sem as skins originais (a roupa é pintada pelo jogo) | [Kenney](https://kenney.nl) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `cavalo.glb` | "Horse" do "Animated Animal Pack" (animações Idle, Walk, Gallop e Eating), via [Poly Pizza](https://poly.pizza/m/qvTrSG9pZF) | [Quaternius](https://quaternius.com) | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `../vendor/three/` | three.js r160 (`three.module.min.js`, `GLTFLoader.js`, `BufferGeometryUtils.js`), com os imports trocados por caminhos relativos | three.js authors | MIT (ver `../vendor/three/LICENSE`) |

CC0 não exige crédito; fica registrado por gratidão aos autores.

Conversão: os FBX da Kenney foram carregados com o `FBXLoader` do three.js, as trilhas de escala tiradas, só as animações usadas mantidas, e exportados com o `GLTFExporter` (binário). O cavalo passou pelo mesmo caminho para ficar só com as quatro animações que o jogo usa.
