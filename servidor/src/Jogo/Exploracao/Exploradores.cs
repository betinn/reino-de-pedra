using System.Text.Json.Nodes;
using ReinoDePedra.Jogo.Config;
using ReinoDePedra.Jogo.Mapa;
using ReinoDePedra.Jogo.Marchas;
using ReinoDePedra.Jogo.Nucleo;
using ReinoDePedra.Jogo.Reinos;
using ReinoDePedra.Jogo.Social;
using GT = ReinoDePedra.Jogo.Reinos.Tropas;

using PS = ReinoDePedra.Jogo.Pessoas.Pessoas;

namespace ReinoDePedra.Jogo.Exploracao
{
    /// <summary>
    /// Explorador em campo (a pé, a cavalo, prospector ou batedor de elite), com escolta opcional em <see cref="Marcha.Tropas"/>.
    /// Cada perna da ordem é uma marcha com evento de chegada: explorar (vai e fica no destino esperando nova ordem), seguir
    /// rota (pontos; no fim espera, ou recomeça se for circuito), patrulhar (ida e volta até nova ordem), espionar (batedor,
    /// fica no local) e retornar. Parado ("aguardar"), mantém a área à vista. Ocupa 1 de população (+ a escolta).
    /// Não é interceptável; o batedor é furtivo (outros reinos não o veem no mapa).
    /// </summary>
    public sealed class Explorador : Marcha
    {
        public override string Tipo => "explorador";
        /// <summary>A pessoa que explora (ofício do tipo; a escolta vai em <see cref="Marcha.PessoaIds"/> também).</summary>
        public long PessoaId { get; set; }
        /// <summary>"pe", "cavalo", "prospector" ou "batedor" (chaves de <c>P.exploradores</c>).</summary>
        public string TipoExp { get; set; } = "pe";
        /// <summary>"explorar", "rota", "patrulhar", "espionar" ou "retornar".</summary>
        public string Ordem { get; set; } = Exploradores.Explorar;
        public int Alvo { get; set; }
        /// <summary>Pontos da ordem "rota", em ordem; <see cref="Ponto"/> é o índice do ponto para onde está indo.</summary>
        public List<int> Pontos { get; set; } = new();
        public int Ponto { get; set; }
        /// <summary>Rota em circuito: ao chegar ao último ponto, recomeça do primeiro, até nova ordem.</summary>
        public bool Circuito { get; set; }
        /// <summary>Patrulha: indo para o alvo (true) ou voltando ao ponto de partida (false).</summary>
        public bool Ida { get; set; } = true;
        /// <summary>De onde saiu e onde mora (o castelo).</summary>
        public long CasaLocalId { get; set; }
        /// <summary>Hexágono de partida (a patrulha vai e volta entre ele e o alvo).</summary>
        public int Base { get; set; }
        public bool Seguro { get; set; }
        /// <summary>Espionagem em andamento: fim da estadia no local.</summary>
        public long? EspionagemEventoId { get; set; }
        public long? EspionandoAte { get; set; }
        public int JazidasAchadas { get; set; }

        public override bool Interceptavel => false;
        public override bool Furtiva => TipoExp == Exploradores.Batedor;
        public override int RaioVisao(Mundo m) => m.P.Exploradores.TryGetValue(TipoExp, out var x) ? x.Visao : m.P.Visao.Tropa;
        public override int PopOcupada(Mundo m) => 1 + Economia.PopDeGrupo(m, Tropas);
        public override double ForcaContraFauna(Mundo m) =>
            (m.P.Exploradores.TryGetValue(TipoExp, out var x) ? x.Forca : 0) + GT.ForcaFauna(m, Tropas);

        /// <summary>Sozinho, o explorador morre; com escolta, a escolta sofre as baixas e ele segue.</summary>
        public override PerdaFauna SofrerFauna(Mundo m, double perda)
        {
            if (GT.Total(Tropas) == 0) return new PerdaFauna(new(), new(), true);
            return base.SofrerFauna(m, perda) with { Acabou = false };
        }

        public override void AoPassar(Mundo m, int hex, long quando)
        {
            if (TipoExp == Exploradores.Prospector) Exploradores.Prospectar(m, this, hex);
        }

        public override void Chegou(Mundo m) => Exploradores.Chegou(m, this);

        public string NomeTipo(Mundo m) => Exploradores.NomeTipo(m, TipoExp);
    }

    /// <summary>Item da fila de recrutamento que treina exploradores no castelo (Param = tipo, Qtd). Cada um fica livre ao ficar pronto.</summary>
    public sealed class ItemExplorador : ITipoItemPorUnidade
    {
        public const string Id = "explorador";
        public string Tipo => Id;
        public void Entregar(Mundo m, Reino r, ItemFila item, int n)
        {
            if (item.Param == null || n <= 0) return;
            var casa = m.Locais.Obter(r.CasteloId) ?? m.LocaisDe(r.Id).FirstOrDefault(x => !x.Ruina);
            if (casa == null) { PS.DevolverDoTreino(m, r, item, n); return; }
            PS.TreinoPronto(m, r, item, n, casa);
        }
        public void Concluir(Mundo m, Reino r, ItemFila item) =>
            Registros.Notificar(m, r.Id, "exploracao", item.Qtd > 1 ? "Exploradores prontos" : "Explorador pronto", item.Rotulo, "exploradores");
        public void Cancelado(Mundo m, Reino r, ItemFila item) => PS.TreinoCancelado(m, r, item);
    }

    [Sistema]
    public static class Exploradores
    {
        public const string Explorar = "explorar", SeguirRota = "rota", Patrulhar = "patrulhar", Espionar = "espionar", Retornar = "retornar", Aguardar = "aguardar";
        public const string Pe = "pe", Cavalo = "cavalo", Prospector = "prospector", Batedor = "batedor";
        public static readonly string[] Ordens = [Explorar, SeguirRota, Patrulhar, Espionar];

        public static void AoIniciar(Mundo m) => Sistemas.UmaVez("exploradores", () =>
        {
            Economia.OcupantesExtras.Add(Ocupantes);
        });

        /// <summary>Exploradores livres no castelo e em treino (ocupam o teto; os em campo contam pela marcha).</summary>
        public static int Ocupantes(Mundo m, Reino r) =>
            r.ExploradoresLivres.Values.Sum() + EmTreino(r).Sum(i => i.Restantes);

        public static IEnumerable<ItemFila> EmTreino(Reino r) =>
            r.Filas.TryGetValue(Recrutamento.Fila, out var f) ? f.Itens.Where(i => i.Tipo == ItemExplorador.Id) : [];

        public static IEnumerable<Explorador> De(Mundo m, long reinoId) => m.Marchas.OfType<Explorador>().Where(e => e.ReinoId == reinoId);

        public static string NomeTipo(Mundo m, string tipo)
        {
            if (!m.P.Exploradores.TryGetValue(tipo, out var x)) return "Explorador";
            return tipo is Pe or Cavalo ? "Explorador " + x.Nome.ToLowerInvariant() : x.Nome;
        }

        private static ExploradorP Tipo(Mundo m, string? tipo) =>
            tipo != null && m.P.Exploradores.TryGetValue(tipo, out var x) ? x : throw new RegraException("Tipo de explorador desconhecido.");

        // ---------------------------------------------------------------- treino

        /// <summary>Treina exploradores no castelo (fila de recrutamento). A população sai na hora; volta se cancelar.</summary>
        public static ItemFila Treinar(Mundo m, Reino r, string tipo, int qtd)
        {
            var x = Tipo(m, tipo);
            if (qtd < 1) throw new RegraException("Escolha pelo menos 1 explorador.");
            var c = m.Locais.Obter(r.CasteloId);
            if (c == null || c.ReinoId != r.Id || c.Ruina) throw new RegraException("Exploradores são treinados no castelo.");
            Economia.Atualizar(m, r);
            var livre = PS.LivresParaTreino(m, r);
            if (livre < qtd) throw new RegraException($"Falta população civil livre: precisa de {qtd}, há {livre}.");
            var custo = new Recursos(); custo.Somar(x.Custo, qtd);
            var item = Filas.Enfileirar(m, r, Recrutamento.Fila, new ItemFila
            {
                Tipo = ItemExplorador.Id, LocalId = c.Id, Hex = c.Hex, Param = tipo, Qtd = qtd,
                Rotulo = qtd + " × " + NomeTipo(m, tipo).ToLowerInvariant(), Custo = custo, DuracaoSeg = x.Tempo * qtd,
            });
            PS.ParaTreino(m, r, qtd, Pessoas.Oficios.DeExplorador(tipo), item, c);
            m.Sujar(r);
            return item;
        }

        // ---------------------------------------------------------------- caminho

        /// <summary>Ajuste de terreno do explorador sozinho (a pé sem penalidade em floresta e pântano; a cavalo penalizado em floresta e montanha).</summary>
        public static Func<Terreno, double, double>? Ajuste(Mundo m, string tipo)
        {
            var p = m.P.ExploracaoServ;
            var sem = p.SemPenalidade.GetValueOrDefault(tipo) ?? [];
            var pen = p.Penalidade.GetValueOrDefault(tipo);
            if (sem.Length == 0 && (pen == null || pen.Count == 0)) return null;
            return (t, f) =>
            {
                var k = t.Chave();
                if (sem.Contains(k)) return f / m.P.Terreno[k];   // tira o custo do terreno (o vau continua)
                if (pen != null && pen.TryGetValue(k, out var x)) return f * x;
                return f;
            };
        }

        /// <summary>Velocidade: a do explorador; com escolta, a do mais lento.</summary>
        public static string Velocidade(Mundo m, string tipo, IReadOnlyDictionary<string, int> escolta)
        {
            var v = Tipo(m, tipo).Vel;
            if (GT.Total(escolta) == 0) return v;
            var ve = GT.Velocidade(m, escolta);
            return m.P.MinPor[ve] > m.P.MinPor[v] ? ve : v;
        }

        public static OpcoesCaminho Opcoes(Mundo m, long reinoId, string tipo, IReadOnlyDictionary<string, int> escolta, bool seguro) => new()
        {
            Seguro = seguro, ReinoId = reinoId,
            Forca = Tipo(m, tipo).Forca + GT.ForcaFauna(m, escolta),
            AjusteTerreno = GT.Total(escolta) == 0 ? Ajuste(m, tipo) : null,
        };

        public static Rota Rota(Mundo m, Explorador e, int de, int para)
        {
            var rota = Caminhos.Calcular(m, de, para, e.Vel, Opcoes(m, e.ReinoId, e.TipoExp, e.Tropas, e.Seguro));
            if (rota.Hexes[^1] != para) throw new RegraException("Não há caminho até o destino.");
            return rota;
        }

        // ---------------------------------------------------------------- envio e ordens

        /// <summary>Manda um explorador livre do castelo com uma ordem. Escolta opcional, tirada da guarnição do castelo. Rota segura por padrão (desvia do perigo conhecido).</summary>
        public static Explorador Enviar(Mundo m, Reino r, string tipo, string ordem, int? destino, IReadOnlyList<int>? pontos = null,
            bool seguro = true, IReadOnlyDictionary<string, int>? escolta = null, bool circuito = false)
        {
            Tipo(m, tipo);
            var casa = m.Locais.Obter(r.CasteloId);
            if (casa == null || casa.ReinoId != r.Id || casa.Ruina) throw new RegraException("Exploradores saem do castelo.");
            PS.SincronizarLivres(m, r);
            if (r.ExploradoresLivres.GetValueOrDefault(tipo) < 1)
                throw new RegraException("Nenhum " + NomeTipo(m, tipo).ToLowerInvariant() + " livre. Treine um no castelo.");
            var grupo = GT.Limpo(escolta);
            if (grupo.Count > 0) grupo = GT.Validar(m, casa, grupo);
            var e = new Explorador
            {
                ReinoId = r.Id, TipoExp = tipo, CasaLocalId = casa.Id, Base = casa.Hex, Seguro = seguro, Tropas = grupo, Circuito = circuito,
            };
            e.Vel = Velocidade(m, tipo, grupo);
            var primeiro = Preparar(m, r, e, ordem, destino, pontos, casa.Hex);
            var rota = Rota(m, e, casa.Hex, primeiro);
            Economia.Atualizar(m, r);
            var pessoa = PS.Livre(m, r, Pessoas.Oficios.DeExplorador(tipo)) ?? throw new RegraException("Nenhum " + NomeTipo(m, tipo).ToLowerInvariant() + " livre. Treine um no castelo.");
            m.Marchas.Adicionar(e);
            e.PessoaId = pessoa.Id;
            PS.Embarcar(m, e, [pessoa]);
            PS.RecontarLivres(m, r);
            if (grupo.Count > 0) GT.Retirar(m, casa, grupo);
            e.Partir(m, rota);
            m.Avisar(r.Id, "reino");
            return e;
        }

        /// <summary>Confere e grava a ordem no explorador; devolve o primeiro destino.</summary>
        private static int Preparar(Mundo m, Reino r, Explorador e, string ordem, int? destino, IReadOnlyList<int>? pontos, int de)
        {
            if (!Ordens.Contains(ordem)) throw new RegraException("Ordem desconhecida.");
            if (ordem == SeguirRota)
            {
                var ps = (pontos ?? []).ToList();
                if (ps.Count == 0 && destino is int d0) ps.Add(d0);
                while (ps.Count > 0 && ps[0] == de) ps.RemoveAt(0);
                if (ps.Count == 0) throw new RegraException("Escolha os pontos da rota.");
                if (ps.Count > m.P.Patrulha.MaxHexes) throw new RegraException("A rota tem no máximo " + m.P.Patrulha.MaxHexes + " pontos.");
                if (ps.Any(h => !m.G.Valido(h))) throw new RegraException("Ponto fora do mapa.");
                e.Ordem = ordem; e.Pontos = ps; e.Ponto = 0; e.Alvo = ps[^1];
                return ps[0];
            }
            if (destino is not int dd || !m.G.Valido(dd)) throw new RegraException("Escolha o destino.");
            var d = m.CentroDoLocal(dd);
            if (d == de) throw new RegraException("O explorador já está aqui.");
            if (ordem == Espionar)
            {
                if (e.TipoExp != Batedor) throw new RegraException("Só o batedor de elite espiona.");
                if (GT.Total(e.Tropas) > 0) throw new RegraException("O batedor espiona sozinho, sem escolta.");
                if (!Nevoas.Explorado(m, r.Id, d)) throw new RegraException("Explore a área antes de espionar.");
                var l = m.LocalNoHex(d);
                if (l != null && l.ReinoId == r.Id) throw new RegraException("Esse local é seu.");
            }
            e.Ordem = ordem; e.Alvo = d; e.Ida = true; e.Pontos = new();
            return d;
        }

        public static Explorador Do(Mundo m, Reino r, long marchaId) =>
            m.Marchas.Obter(marchaId) is Explorador e && e.ReinoId == r.Id ? e : throw new RegraException("Explorador não encontrado.", 404);

        /// <summary>Nova ordem a um explorador em campo (andando, patrulhando ou espionando).</summary>
        public static void DarOrdem(Mundo m, Reino r, long marchaId, string ordem, int? destino, IReadOnlyList<int>? pontos = null, bool? seguro = null, bool circuito = false)
        {
            var e = Do(m, r, marchaId);
            if (seguro != null) e.Seguro = seguro.Value;
            e.Circuito = circuito && ordem == SeguirRota;
            if (ordem == Retornar) { PararEspionagem(m, e); IrParaCasa(m, e); return; }
            var de = e.HexEm(m.Agora);
            var antes = (e.Ordem, e.Alvo, e.Pontos, e.Ponto, e.Ida);
            int primeiro; Rota rota;
            try { primeiro = Preparar(m, r, e, ordem, destino, pontos, de); rota = Rota(m, e, de, primeiro); }
            catch { (e.Ordem, e.Alvo, e.Pontos, e.Ponto, e.Ida) = antes; throw; }
            PararEspionagem(m, e);
            if (ordem == Patrulhar) e.Base = de;
            e.Retornando = false;
            e.Partir(m, rota);
        }

        private static void PararEspionagem(Mundo m, Explorador e)
        {
            m.Cancelar(e.EspionagemEventoId);
            e.EspionagemEventoId = null; e.EspionandoAte = null;
        }

        // ---------------------------------------------------------------- chegada

        public static void Chegou(Mundo m, Explorador e)
        {
            m.Sujar(e);
            e.RevelarPercorrido(m, m.Agora);
            var r = m.Reinos.Obter(e.ReinoId);
            if (r == null || !r.Ativo) { e.Encerrar(m); return; }
            if (e.Retornando)
            {
                var casa = Casa(m, e);
                if (casa != null && casa.Hex == e.Destino) { EntrarEmCasa(m, e, casa); return; }
                IrParaCasa(m, e);
                return;
            }
            switch (e.Ordem)
            {
                case SeguirRota:
                    e.Ponto++;
                    if (e.Ponto >= e.Pontos.Count && e.Circuito && e.Pontos.Count > 1) e.Ponto = 0;   // circuito: recomeça
                    if (e.Ponto < e.Pontos.Count && TentarIr(m, e, e.Pontos[e.Ponto])) return;
                    Esperar(m, e);
                    return;
                case Patrulhar:
                    e.Ida = !e.Ida;
                    if (TentarIr(m, e, e.Ida ? e.Alvo : e.Base)) return;
                    IrParaCasa(m, e);
                    return;
                case Espionar:
                    Espionagem.Comecar(m, e);
                    return;
                case Aguardar:
                    Esperar(m, e);
                    return;
                default:
                    Esperar(m, e);
                    return;
            }
        }

        /// <summary>
        /// O explorador fica onde está, à espera de nova ordem (explorar outro lugar, seguir rota, patrulhar ou voltar): não
        /// volta sozinho ao castelo. Parado, continua vendo a área em volta (a visão de toda marcha é a do hexágono onde ela está).
        /// </summary>
        public static void Esperar(Mundo m, Explorador e)
        {
            var h = e.HexEm(m.Agora);
            m.Cancelar(e.EventoId);
            e.EventoId = null;
            e.Caminho = [h]; e.Tempos = [m.Agora]; e.Origem = e.Destino = h;
            e.Retornando = false; e.Ordem = Aguardar;
            m.Sujar(e);
            Registros.Notificar(m, e.ReinoId, "exploracao", e.NomeTipo(m) + " no destino",
                "Espera nova ordem no hexágono " + m.G.C(h) + ", " + m.G.L(h) + ".", "mapa?foco=" + h);
            m.Avisar(e.ReinoId, "marchas");
        }

        private static bool TentarIr(Mundo m, Explorador e, int para)
        {
            var de = e.HexEm(m.Agora);
            if (de == para) return false;
            var rota = Caminhos.Calcular(m, de, para, e.Vel, Opcoes(m, e.ReinoId, e.TipoExp, e.Tropas, e.Seguro));
            if (rota.Hexes[^1] != para) return false;
            e.Partir(m, rota);
            return true;
        }

        /// <summary>Casa do explorador: o local de origem, ou o castelo, ou o local próprio mais próximo.</summary>
        private static Local? Casa(Mundo m, Explorador e)
        {
            var c = m.Locais.Obter(e.CasaLocalId);
            if (Exercitos.LocalProprio(c, e.ReinoId)) return c;
            var r = m.Reinos.Obter(e.ReinoId);
            c = r != null ? m.Locais.Obter(r.CasteloId) : null;
            if (Exercitos.LocalProprio(c, e.ReinoId)) return c;
            var de = e.HexEm(m.Agora);
            return m.LocaisDe(e.ReinoId).Where(l => !l.Ruina).OrderBy(l => m.G.Distancia(l.Hex, de)).FirstOrDefault();
        }

        /// <summary>Volta para casa (entra no castelo e fica livre para outra ordem).</summary>
        public static void IrParaCasa(Mundo m, Explorador e)
        {
            var casa = Casa(m, e);
            if (casa == null) { e.Encerrar(m); return; }   // o reino não tem mais para onde voltar
            e.CasaLocalId = casa.Id;
            e.Ordem = Retornar;
            var de = e.HexEm(m.Agora);
            if (de == casa.Hex) { EntrarEmCasa(m, e, casa); return; }
            var rota = Caminhos.Calcular(m, de, casa.Hex, e.Vel, Opcoes(m, e.ReinoId, e.TipoExp, e.Tropas, e.Seguro));
            if (rota.Hexes[^1] != casa.Hex) rota = Caminhos.Calcular(m, de, casa.Hex, e.Vel);
            e.Retornando = true;
            e.Partir(m, rota);
        }

        private static void EntrarEmCasa(Mundo m, Explorador e, Local casa)
        {
            var r = m.Reinos.Obter(e.ReinoId);
            if (r == null) { e.Encerrar(m); return; }
            Economia.Atualizar(m, r);
            PS.Desembarcar(m, e, casa);
            PS.Livrar(m, e, e.PessoaId, casa);   // o explorador volta a ficar livre no castelo
            PS.RecontarLivres(m, r);
            if (e.HexesRevelados > 0 || e.JazidasAchadas > 0)
            {
                var linhas = new JsonArray { Fauna.Linha("Hexágonos revelados", e.HexesRevelados.ToString()) };
                if (e.JazidasAchadas > 0) linhas.Add(Fauna.Linha("Jazidas descobertas", e.JazidasAchadas.ToString()));
                Registros.Relatar(m, r.Id, "exploracao", "Exploração concluída", new JsonObject
                {
                    ["resumo"] = e.NomeTipo(m) + " voltou a " + casa.Nome + ".", ["linhas"] = linhas, ["hex"] = e.Alvo,
                }, "exploracao");
            }
            e.Tropas = new();
            e.Encerrar(m);
            m.Avisar(r.Id, "reino");
        }

        // ---------------------------------------------------------------- prospector

        /// <summary>O prospector descobre as jazidas valiosas e lendárias a até <c>P.exploradores.prospector.jazidas</c> do caminho.</summary>
        public static void Prospectar(Mundo m, Explorador e, int hex)
        {
            var alcance = m.P.Exploradores[Prospector].Jazidas;
            foreach (var j in m.Jazidas)
            {
                if (j.DescobertaPor.Contains(e.ReinoId) || m.G.Distancia(j.Hex, hex) > alcance) continue;
                j.DescobertaPor.Add(e.ReinoId);
                m.Sujar(j);
                e.JazidasAchadas++;
                Registros.Notificar(m, e.ReinoId, "exploracao", "Jazida descoberta: " + Logistica.NomeRecurso(j.Recurso),
                    "Hexágono " + m.G.C(j.Hex) + ", " + m.G.L(j.Hex), "mapa?foco=" + j.Hex);
                m.Avisar(e.ReinoId, "mapa");
            }
        }

        // ---------------------------------------------------------------- captura no caminho

        /// <summary>
        /// Explorador sem escolta que passa no alcance de visão de uma guarnição (ou exército parado) de outro reino pode
        /// ser capturado: chance = base + porTropa × tropas, até o máximo; batedor de elite é furtivo. Sorteado na partida,
        /// cada vigia uma vez; a primeira captura é agendada no instante da passagem.
        /// </summary>
        public static void SortearCaptura(Mundo m, Marcha mc)
        {
            if (mc is not Explorador e || GT.Total(e.Tropas) > 0 || e.Caminho.Count < 2) return;
            var dono = m.Reinos.Obter(e.ReinoId);
            if (dono == null) return;
            var p = m.P.ExploracaoServ.Captura;
            var furtivo = e.TipoExp == Batedor ? p.Furtivo : 1;
            if (furtivo <= 0) return;
            var vigias = m.Locais.Where(l => l.ReinoId != 0 && l.ReinoId != e.ReinoId && !l.Ruina && l.TropasNaGuarnicao > 0)
                .Select(l => (chave: "l" + l.Id, reino: l.ReinoId, hex: l.Hex, raio: Nevoas.RaioLocal(m, l), tropas: l.TropasNaGuarnicao, local: (long?)l.Id))
                .Concat(m.Marchas.OfType<Exercito>().Where(x => x.Parado && x.ReinoId != e.ReinoId && x.ReinoId != 0)
                    .Select(x => (chave: "m" + x.Id, reino: x.ReinoId, hex: x.HexEm(m.Agora), raio: x.RaioVisao(m), tropas: GT.Total(x.Tropas), local: (long?)null)))
                .ToList();
            if (vigias.Count == 0) return;
            var vistos = new HashSet<string>();
            for (var i = 1; i < e.Caminho.Count; i++)
            {
                var h = e.Caminho[i];
                foreach (var v in vigias)
                {
                    if (m.G.Distancia(v.hex, h) > v.raio || !vistos.Add(v.chave)) continue;
                    var captor = m.Reinos.Obter(v.reino);
                    if (captor == null || !captor.Ativo || Capturas.Ignorar.Any(f => f(m, captor, dono))) continue;
                    var chance = Math.Min(p.Max, p.Base + p.PorTropa * v.tropas) * furtivo;
                    if (!m.Sorte.Chance(chance)) continue;
                    e.EventosCaminho.Add(m.Agendar(new CapturaExploradorEvento
                    {
                        MarchaId = e.Id, Partida = e.Partida, CaptorId = v.reino, LocalId = v.local, Hex = h,
                        Quando = Math.Min(e.Tempos[i], e.Chegada - 1),
                    }).Id);
                    return;
                }
            }
        }
    }

    /// <summary>Captura agendada de um explorador sozinho que passou à vista de tropas de outro reino.</summary>
    public sealed class CapturaExploradorEvento : Evento
    {
        public long MarchaId { get; set; }
        public long Partida { get; set; }
        public long CaptorId { get; set; }
        public long? LocalId { get; set; }
        public int Hex { get; set; }
        public override void Executar(Mundo m)
        {
            if (m.Marchas.Obter(MarchaId) is not Explorador e || e.Partida != Partida || GT.Total(e.Tropas) > 0) return;
            if (m.Reinos.Obter(CaptorId) is not { Ativo: true } captor) return;
            if (LocalId is long lid && (m.Locais.Obter(lid) is not { } l || l.ReinoId != CaptorId || l.TropasNaGuarnicao == 0)) return;
            e.RevelarPercorrido(m, m.Agora);
            Capturas.Capturar(m, e, captor, Hex);
        }
    }
}

namespace ReinoDePedra.Jogo.Reinos
{
    public sealed partial class Reino
    {
        /// <summary>Exploradores livres no castelo, por tipo (ocupam o teto).</summary>
        public Dictionary<string, int> ExploradoresLivres { get; set; } = new();
    }
}
